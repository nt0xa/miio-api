import Device from "./device";
import { SocketError, DeviceError, ProtocolError } from "./errors";

const device = Device.discover;

export { Device, device, SocketError, DeviceError, ProtocolError };
export default { Device, device, SocketError, DeviceError, ProtocolError };
