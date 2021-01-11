/**
 * Represents miIO protocol error.
 */
export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Represents miIO device error.
 */
export class DeviceError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Represents socket error.
 */
export class SocketError extends Error {
  constructor(message: string) {
    super(message);
  }
}
