import Packet, { PacketDataRequired } from "./packet";
import { hash, encrypt, decrypt } from "./crypto";

export type Request<ParamsType extends Array<unknown>> = {
  id: number;
  method: string;
  params?: ParamsType | [];
};

export type Response<ResultType> =
  | {
      id: number;
      result: ResultType;
    }
  | {
      id: number;
      error: {
        code: number;
        message: string;
      };
    };

class Protocol {
  static HANDSHAKE_PACKET = new Packet(
    {
      deviceId: 0xffffffff,
      timestamp: 0xffffffff,
      checksum: Buffer.alloc(Packet.CHECKSUM_SIZE, 0xff),
      data: Buffer.alloc(0),
    },
    0xffffffff,
  );

  private deviceId: number;
  private key: Buffer;
  private iv: Buffer;
  private token: Buffer;

  /**
   * Represents miIO protocol.
   *
   * @param deviceId - device id
   * @param token - device token
   */
  constructor(deviceId: number, token: Buffer) {
    this.deviceId = deviceId;
    this.token = token;
    this.key = hash(token);
    this.iv = hash(Buffer.concat([this.key, token]));
  }

  /**
   * Checks if `Packet` is handshake packet.
   *
   * @param packet - `Packet` to check
   * @returns `true` if packet is handshake packet and `false` otherwise
   */
  static isHandshake(packet: Packet): boolean {
    return packet.length === Packet.HEADER_SIZE;
  }

  /**
   * Returns ready to send `Packet` for the given `Request`.
   *
   * @param req - request
   * @param req.id - random int
   * @param req.method - device method to call
   * @param req.params - method params
   * @param timestamp - device timestamp
   * @returns `Packet` for the given `req` and `timestamp`
   */
  packRequest<ParamsType extends Array<unknown>>(
    req: Request<ParamsType>,
    timestamp: number,
  ): Packet {
    // If no params, set default to []
    const payload = {
      ...req,
      params: req.params || [],
    };

    const data = Buffer.from(JSON.stringify(payload) + "\x00");
    const encryptedData = encrypt(this.key, this.iv, data);

    // Fields required to calculate checksum
    const fields = {
      deviceId: this.deviceId,
      timestamp: timestamp,
      data: encryptedData,
    };

    return new Packet({ ...fields, checksum: this.calcChecksum(fields) });
  }

  /**
   * Extracts device reponse from `Packet`.
   *
   * @param packet - response `Packet`
   * @returns `Response` extracted from the given `packet`
   */
  unpackResponse<ResultType>(packet: Packet): Response<ResultType> {
    if (!this.validateChecksum(packet)) {
      throw new Error("Invalid packet checksum");
    }

    const decrypted = decrypt(this.key, this.iv, packet.data);
    const response = JSON.parse(decrypted.toString());

    return response;
  }

  /**
   * Calculates a checksum for the given `Packet`.
   *
   * @param fields - `Packet` fields required for checksum calculation.
   * @returns checksum for `Packet` constructed from `fields`
   */
  private calcChecksum(fields: Omit<PacketDataRequired, "checksum">): Buffer {
    // Build dummy packet with token in "checksum" field
    // to calculate actual checksum.
    const dummy = new Packet({
      ...fields,
      checksum: this.token,
    });

    return hash(dummy.toBuffer());
  }

  /**
   * Validates checksum of the given `Packet`.
   *
   * @param packet - `Packet` to validate
   * @returns `true` if checksum is correct and `false` otherwise
   */
  private validateChecksum(packet: Packet): boolean {
    const { checksum: actual, ...fields } = packet;
    const expected = this.calcChecksum(fields);
    return expected.equals(actual);
  }
}

export default Protocol;
