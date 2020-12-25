import dgram from "dgram";

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
  version: number;

  socket: dgram.Socket;

  private connectPromise: Promise<void> | null;

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
    this.version = parseInt(process.versions.node.split(".")[0]);
    this.connectPromise = null;
  }

  /**
   * Checks if socket is connected.
   *
   * @returns `true` if socket is connected and `false` otherwise
   */
  private isConnected(): boolean {
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
   * If called simultaneous do connect only once and return same promise for
   * all callers
   */
  private connect(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = new Promise<void>((resolve) => {
        this.socket.connect(this.port, this.ip, () => {
          resolve();
        });
      }).finally(() => {
        this.connectPromise = null;
      });
    }

    return this.connectPromise;
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
    // `connect` function was added in v12 of NodeJS.
    // https://nodejs.org/api/dgram.html#dgram_socket_connect_port_address_callback
    if (this.version >= 12) {
      if (!this.isConnected()) {
        await this.connect();
      }
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

        const callback = (err: Error | null) => {
          if (err) {
            onError(err);
          }
        };

        if (this.version >= 12) {
          this.socket.send(data, callback);
        } else {
          // Older NodeJS versions don't have "connected UDP socket",
          // so we need to pass address and port.
          this.socket.send(data, this.port, this.ip, callback);
        }
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
