import Protocol from "./protocol";
import Packet from "./packet";
import Socket from "./socket";
import logger from "./logger";
import { randomInt, retry, reusePromise, randomString } from "./utils";

const log = logger.extend("device");

export type DeviceParams = {
  address: string;
  token: string;
  deviceId: number;
  socket?: Socket;
  lastSeenAt?: number;
  timestamp?: number;
};

export type DiscoverParams = {
  address: string;
  token: string;
};

type HandshakeResult = {
  deviceId: number;
  timestamp: number;
};

export type CallOptions = {
  attempts?: number;
  delay?: number;
  timeout?: number;
};

class DeviceError extends Error {
  code: number;

  /**
   * Represents miIO device error.
   *
   * @param message - error message
   * @param code - error code
   */
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

class Device {
  static PORT = 54321;
  static MAX_CALL_INTERVAL = 60;
  static DEFAULT_CALL_OPTIONS: CallOptions = {
    attempts: 3,
    delay: 3000,
    timeout: 3000,
  };

  private protocol: Protocol;
  private socket: Socket;

  private timestamp: number;
  private lastSeenAt: number;

  /**
   * Device identifier.
   */
  id: number;

  /**
   * Represents a miIO `Device`.
   *
   * @param params - device parameters
   * @param params.address - device IP address
   * @param params.token - device token
   * @param params.deviceId - device identifier
   * @param params.socket - socket
   * @param params.lastSeenAt - time of last communication with device
   * @param params.timestamp - last device timestamp
   *
   * @remarks
   * It is recommended not to create device using this constructor but to
   * use `Device.discover` method instead.
   * Parameters `socket`, `lastSeenAt` and `timestamp` are optional and introduced only to
   * be able to avoid double handshake at the start.
   */
  constructor(params: DeviceParams) {
    this.id = params.deviceId;
    this.protocol = new Protocol(
      params.deviceId,
      Buffer.from(params.token, "hex"),
    );
    this.socket = params.socket || new Socket(params.address, Device.PORT);
    this.timestamp = params.timestamp || 0;
    this.lastSeenAt = params.lastSeenAt || 0;
  }

  /**
   * Makes handshake.
   *
   * @param socket - device socket
   * @param options - call options
   * @returns `Promise` with handshake result
   */
  private static async handshake(
    socket: Socket,
    callOptions?: CallOptions,
  ): Promise<HandshakeResult> {
    const options = { ...Device.DEFAULT_CALL_OPTIONS, ...callOptions };
    const packet = await retry(
      async () => {
        return await socket.send(
          Protocol.HANDSHAKE_PACKET.toBuffer(),
          (msg: Buffer) => Packet.fromBuffer(msg),
          (packet) => Protocol.isHandshake(packet),
          options.timeout,
        );
      },
      options.attempts,
      options.delay,
    );

    return {
      deviceId: packet.deviceId,
      timestamp: packet.timestamp,
    };
  }

  /**
   * Connects to device, makes handshake and returns ready to use `Device` instance.
   *
   * @param params - discover parameters
   * @param params.address - device IP address
   * @param params.token - device token
   * @param callOptions - additional options
   * @param callOptions.attempts - handshake attempts
   * @param callOptions.delay - delay between attempts
   * @param callOptions.timeout - handshake response timeout
   * @returns `Device` instance
   */
  static async discover(
    params: DiscoverParams,
    callOptions?: CallOptions,
  ): Promise<Device> {
    const options = { ...Device.DEFAULT_CALL_OPTIONS, ...callOptions };
    const socket = new Socket(params.address, Device.PORT);

    let handshake;

    // Exception is handled to be able to close socket in case of error.
    try {
      handshake = await Device.handshake(socket, options);
    } catch (err) {
      await socket.close();
      throw err;
    }

    return new Device({
      deviceId: handshake.deviceId,
      token: params.token,
      address: params.address,
      socket: socket,
      timestamp: handshake.timestamp,
      lastSeenAt: Date.now(),
    });
  }

  /**
   * Makes handshake.
   *
   * @param options - call options
   * @returns `Promise` with handshake result
   *
   * @remarks
   * Method is wrapped by `reusePromise` decorator to be sure that handshake
   * is done only once in case of multiple simultaneous method calls.
   *
   */
  @reusePromise()
  private handshake(options?: CallOptions): Promise<HandshakeResult> {
    return Device.handshake(this.socket, options);
  }

  /**
   * Returns result of device method call.
   *
   * @param method - device method to call
   * @param params - method parameters
   * @param callOptions - additional options
   * @param callOptions.attempts - call attempts
   * @param callOptions.delay - delay between attempts
   * @param callOptions.timeout - call response timeout
   * @returns result `method` call
   */
  async call<ParamsType extends Array<unknown>, ResultType>(
    method: string,
    params?: ParamsType,
    callOptions?: CallOptions,
  ): Promise<ResultType> {
    const logWithId = log.extend(randomString());

    const options = { ...Device.DEFAULT_CALL_OPTIONS, ...callOptions };

    const secondsPassed = Math.floor((Date.now() - this.lastSeenAt) / 1000);

    if (secondsPassed > Device.MAX_CALL_INTERVAL) {
      logWithId("-> handshake");

      const { timestamp } = await this.handshake(options);
      this.timestamp = timestamp;
      this.lastSeenAt = Date.now();
    }

    const id = randomInt();
    const req = { id, method, params };

    logWithId("-> %O", req);

    const request = this.protocol.packRequest(
      { id, method, params },
      this.timestamp,
    );

    const requestBuffer = request.toBuffer();

    logWithId("->\n%H", requestBuffer);

    const { responsePacket, response } = await retry(
      async () => {
        return await this.socket.send(
          requestBuffer,
          (responseBuffer: Buffer) => {
            const responsePacket = Packet.fromBuffer(responseBuffer);
            const response = !Protocol.isHandshake(responsePacket)
              ? this.protocol.unpackResponse<ResultType>(responsePacket)
              : undefined;
            return { responseBuffer, responsePacket, response };
          },
          ({ responseBuffer, response }) => {
            if (response?.id === id) {
              logWithId("<-\n%H", responseBuffer);
              return true;
            }
            return false;
          },
        );
      },
      options.attempts,
      options.timeout,
    );

    logWithId("<- %O", response);

    this.timestamp = responsePacket.timestamp;
    this.lastSeenAt = Date.now();

    if (!response) {
      throw new Error("Invalid response");
    }

    if ("error" in response) {
      const err = response.error;
      throw new DeviceError(err.message, err.code);
    }

    return response.result;
  }

  /**
   * Cleans resources associated with the device.
   */
  async destroy(): Promise<void> {
    await this.socket.close();
  }
}

export default Device;
