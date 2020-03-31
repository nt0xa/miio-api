import dgram from "dgram";
import { reusePromise } from "./utils";

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
  async send<T>(
    data: Buffer,
    parse: (msg: Buffer) => T,
    match: (data: T) => boolean,
    timeout: number = 5000,
  ): Promise<T> {
    if (!this._isConnected()) {
      await this._connect();
    }

    let timer: NodeJS.Timer = null;

    const resultPromise: Promise<T> = new Promise((resolve, reject) => {
      const onMessage = (msg: Buffer) => {
        const parsed = parse(msg);

        if (match(parsed)) {
          clearTimeout(timer);
          this.socket.removeListener("message", onMessage);
          resolve(parsed);
        }
      };

      if (timeout) {
        timer = setTimeout(() => {
          this.socket.removeListener("message", onMessage);
          reject(new Error("Socket timeout"));
        }, timeout);
      }

      this.socket.on("message", onMessage);

      this.socket.send(data, (err) => {
        if (err) {
          clearTimeout(timer);
          this.socket.removeListener("message", onMessage);
          reject(err);
        }
      });
    });

    return resultPromise;
  }
}

export default Socket;
