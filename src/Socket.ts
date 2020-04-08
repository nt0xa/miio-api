import dgram from "dgram";
import { reusePromise } from "./utils";

class SocketError extends Error {
  /**
   * Represents socket error.
   *
   * @param message - error message
   */
  constructor(message: string) {
    super(message);
  }
}

class Socket {
  ip: string;
  port: number;

  socket: dgram.Socket;

  /**
   * Represents a UDP socket.
   *
   * @param ip - IP address
   * @param port - port
   */
  constructor(ip: string, port: number) {
    this.ip = ip;
    this.port = port;
    this.socket = dgram.createSocket("udp4");
  }

  /**
   * Checks if socket is connected.
   *
   * @returns `true` if socket is connected and `false` otherwise
   */
  _isConnected(): boolean {
    try {
      this.socket.remoteAddress();
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Connects socket to the provided IP and port.
   *
   * @returns `Promise` which will be resolved when socket is connected
   *
   * @remarks
   * Method is wrapped by `reusePromise` decorator to be sure that `socket.connect`
   * is called only once in case of multiple simultaneous method calls.
   */
  @reusePromise()
  _connect(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.connect(this.port, this.ip, () => {
        resolve();
      });
    });
  }

  /**
   * Sends data to the socket and returns response wrapped in `Promise`.
   *
   * @remarks
   * Because data is sent using UDP, responses may come in random order
   * and it is requred to parse binary response and check if it matches
   * the request.
   *
   * @param data - data to send
   * @param parse - parse function
   * @param match - match function (checks if response matches the request)
   * @param timeout - response timeout
   * @returns `Promise` which will be resolved when matched response come or
   *    rejected in case of error or timeout
   */
  async send<ResponseType>(
    data: Buffer,
    parse: (msg: Buffer) => ResponseType,
    match: (data: ResponseType) => boolean,
    timeout = 5000,
  ): Promise<ResponseType> {
    if (!this._isConnected()) {
      await this._connect();
    }

    let timer: NodeJS.Timer;
    let onMessage: (msg: Buffer) => void, onError: (err: Error) => void;

    const done = (onFinish: () => void): void => {
      if (timer) {
        clearTimeout(timer);
      }
      this.socket.removeListener("message", onMessage);
      this.socket.removeListener("error", onError);
      onFinish();
    };

    const resultPromise: Promise<ResponseType> = new Promise(
      (resolve, reject) => {
        onMessage = (msg: Buffer): void => {
          const parsed = parse(msg);

          if (match(parsed)) {
            done(() => resolve(parsed));
          }
        };

        onError = (err: Error): void => {
          done(() => reject(new SocketError(err.message)));
        };

        if (timeout) {
          timer = setTimeout(() => {
            done(() => reject(new SocketError("Timeout")));
          }, timeout);
        }

        this.socket.on("message", onMessage);
        this.socket.on("error", onError);

        this.socket.send(data, (err) => {
          if (err) {
            done(() => reject(new SocketError(err.message)));
          }
        });
      },
    );

    return resultPromise;
  }

  /**
   * Closes socket.
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      try {
        this.socket.close(() => {
          resolve();
        });
      } catch (err) {
        resolve();
      }
    });
  }
}

export default Socket;
