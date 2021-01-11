import { ProtocolError } from "./errors";

export type PacketData = {
  magic: number;
  size: number;
  unknown: number;
  deviceId: number;
  timestamp: number;
  checksum: Buffer;
  data: Buffer;
};

export type PacketDataRequired = Omit<PacketData, "magic" | "size" | "unknown">;

class Packet {
  static MAGIC = 0x2131;

  static OFFSETS = {
    MAGIC: 0,
    SIZE: 2,
    UNKNOWN: 4,
    DEVICE_ID: 8,
    TIMESTAMP: 12,
    CHECKSUM: 16,
    DATA: 32,
  };

  static HEADER_SIZE = 32;
  static CHECKSUM_SIZE = 16;

  unknown: number;
  deviceId: number;
  timestamp: number;
  checksum: Buffer;
  data: Buffer;

  /**
   * Represent miIO protocol `Packet`.
   *
   * @param fields - fields required to build a `Packet`
   * @param unknown - "unknown" field of packet (0xffffffff for handshake and 0 for any other packet)
   */
  constructor(fields: PacketDataRequired, unknown = 0) {
    this.deviceId = fields.deviceId;
    this.timestamp = fields.timestamp;
    this.checksum = fields.checksum;
    this.data = fields.data;
    this.unknown = unknown;
  }

  /**
   * Parses binary `Buffer` into a `Packet`.
   *
   * @param buf - `Buffer` to parse
   * @returns `Packet` parsed from `buf`
   */
  static fromBuffer(buf: Buffer): Packet {
    const magic = buf.readUInt16BE(Packet.OFFSETS.MAGIC);

    if (magic !== Packet.MAGIC) {
      throw new Error(`Invalid magic: 0x${magic.toString(16)}}`);
    }

    const size = buf.readUInt16BE(Packet.OFFSETS.SIZE);

    if (size !== buf.byteLength) {
      throw new ProtocolError(
        `Invalid packet size, expected ${size} got ${buf.byteLength}`,
      );
    }

    const unknown = buf.readUInt32BE(Packet.OFFSETS.UNKNOWN);

    if (unknown !== 0 && unknown !== 0xffffffff) {
      throw new ProtocolError(`Invalid unknown: 0x${unknown.toString(16)}`);
    }
    const deviceId = buf.readUInt32BE(Packet.OFFSETS.DEVICE_ID);
    const timestamp = buf.readUInt32BE(Packet.OFFSETS.TIMESTAMP);
    const checksum = buf.slice(Packet.OFFSETS.CHECKSUM, Packet.OFFSETS.DATA);
    const data = buf.slice(Packet.OFFSETS.DATA);

    return new Packet({ deviceId, timestamp, checksum, data });
  }

  /**
   * Returns `Packet` length.
   *
   * @returns `Packet` length in bytes
   */
  get length(): number {
    return Packet.HEADER_SIZE + this.data.byteLength;
  }

  /**
   * Packs `Packet` into a `Buffer`.
   *
   * @returns `Buffer` with `Packet` data
   */
  toBuffer(): Buffer {
    const buf = Buffer.alloc(this.length);

    buf.writeUInt16BE(Packet.MAGIC, Packet.OFFSETS.MAGIC);
    buf.writeUInt16BE(this.length, Packet.OFFSETS.SIZE);
    buf.writeUInt32BE(this.unknown, Packet.OFFSETS.UNKNOWN);
    buf.writeUInt32BE(this.deviceId, Packet.OFFSETS.DEVICE_ID);
    buf.writeUInt32BE(this.timestamp, Packet.OFFSETS.TIMESTAMP);

    this.checksum.copy(buf, Packet.OFFSETS.CHECKSUM, 0);
    this.data.copy(buf, Packet.OFFSETS.DATA, 0);

    return buf;
  }
}

export default Packet;
