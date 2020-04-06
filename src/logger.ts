import debug from "debug";

const logger = debug("miio-api");

/**
 * Returns hex dump of provided binary data.
 *
 * @param buffer - data to dump
 * @param blockSize - number of bytes on line
 * @returns hex dump of `buffer` with `blockSize` bytes per line.
 */
export function hexdump(buffer: Buffer, blockSize = 16): string {
  const lines = [];
  for (let i = 0; i < buffer.length; i += blockSize) {
    const block = buffer.slice(i, Math.min(i + blockSize, buffer.length));
    const hex = block.toString("hex");
    const addr = ("0000" + i.toString(16)).slice(-4);
    let line = "";
    for (let j = 0; j < hex.length; j += 2) {
      line += hex[j] + hex[j + 1] + " ";
    }
    line += "  ".repeat(blockSize - block.length);
    lines.push(addr + "    " + line);
  }
  return lines.join("\n");
}

/**
 * Debug formatter for binary data.
 */
debug.formatters.H = (buffer: Buffer): string => {
  return hexdump(buffer);
};

export default logger;
