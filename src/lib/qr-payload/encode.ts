function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, false);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, false);
}

function writeHeader(
  buffer: Uint8Array,
  offset: number,
  sessionId: Uint8Array,
  frameType: number
): number {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  writeUint16(view, offset, 0x4651);
  buffer[offset + 2] = 1;
  buffer[offset + 3] = frameType;
  buffer.set(sessionId, offset + 4);
  return offset + 4 + sessionId.length;
}

export function encodeHeaderPayload(
  sessionId: Uint8Array,
  header: {
    fileName: string;
    fileSize: number;
    blockCount: number;
    blockSize: number;
    hash: string;
  }
): Uint8Array {
  const fileNameBytes = new TextEncoder().encode(header.fileName);
  const hashBytes = hexToBytes(header.hash);
  const totalSize =
    4 + sessionId.length + 2 + fileNameBytes.length + 4 + 4 + 2 + hashBytes.length;
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  let offset = writeHeader(buffer, 0, sessionId, 1);
  writeUint16(view, offset, fileNameBytes.length);
  offset += 2;
  buffer.set(fileNameBytes, offset);
  offset += fileNameBytes.length;
  writeUint32(view, offset, header.fileSize);
  offset += 4;
  writeUint32(view, offset, header.blockCount);
  offset += 4;
  writeUint16(view, offset, header.blockSize);
  offset += 2;
  buffer.set(hashBytes, offset);

  return buffer;
}

export function encodeSymbolPayload(
  sessionId: Uint8Array,
  symbol: {
    seed: number;
    degree: number;
    blockCount: number;
    data: Uint8Array;
  }
): Uint8Array {
  // Indices are omitted — receiver reproduces them from seed + degree + blockCount.
  const totalSize = 4 + sessionId.length + 4 + 2 + 4 + 2 + symbol.data.length;
  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);

  let offset = writeHeader(buffer, 0, sessionId, 2);
  writeUint32(view, offset, symbol.seed);
  offset += 4;
  writeUint16(view, offset, symbol.degree);
  offset += 2;
  writeUint32(view, offset, symbol.blockCount);
  offset += 4;
  writeUint16(view, offset, symbol.data.length);
  offset += 2;
  buffer.set(symbol.data, offset);

  return buffer;
}

export { hexToBytes };
