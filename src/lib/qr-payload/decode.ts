import {
  FRAME_HEADER,
  FRAME_SYMBOL,
  QR_MAGIC,
  SESSION_ID_BYTES,
} from "./constants";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readUint16(view: DataView, offset: number): number {
  return view.getUint16(offset, false);
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

function readHeader(buffer: Uint8Array, offset: number) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = readUint16(view, offset);
  if (magic !== QR_MAGIC) return null;

  const version = buffer[offset + 2];
  const frameType = buffer[offset + 3];
  const sessionId = buffer.slice(offset + 4, offset + 4 + SESSION_ID_BYTES);

  return {
    version,
    frameType,
    sessionId,
    sessionIdHex: bytesToHex(sessionId),
    nextOffset: offset + 4 + SESSION_ID_BYTES,
  };
}

export interface ParsedHeaderFrame {
  kind: "header";
  sessionId: Uint8Array;
  sessionIdHex: string;
  fileName: string;
  fileSize: number;
  blockCount: number;
  blockSize: number;
  hash: string;
}

export interface ParsedSymbolFrame {
  kind: "symbol";
  sessionId: Uint8Array;
  sessionIdHex: string;
  seed: number;
  degree: number;
  blockCount: number;
  data: Uint8Array;
}

export type ParsedFrame = ParsedHeaderFrame | ParsedSymbolFrame;

export function parsePayload(buffer: Uint8Array): ParsedFrame | null {
  // Copy so DataView always reads a contiguous buffer (avoids subarray offset bugs).
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 12) return null;

  const header = readHeader(bytes, 0);
  if (!header) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = header.nextOffset;

  if (header.frameType === FRAME_HEADER) {
    if (bytes.length < offset + 2) return null;
    const fileNameLength = readUint16(view, offset);
    offset += 2;
    if (bytes.length < offset + fileNameLength + 4 + 4 + 2 + 32) return null;

    const fileName = new TextDecoder().decode(
      bytes.slice(offset, offset + fileNameLength)
    );
    offset += fileNameLength;
    const fileSize = readUint32(view, offset);
    offset += 4;
    const blockCount = readUint32(view, offset);
    offset += 4;
    const blockSize = readUint16(view, offset);
    offset += 2;
    const hash = bytesToHex(bytes.slice(offset, offset + 32));

    return {
      kind: "header",
      sessionId: header.sessionId,
      sessionIdHex: header.sessionIdHex,
      fileName,
      fileSize,
      blockCount,
      blockSize,
      hash,
    };
  }

  if (header.frameType === FRAME_SYMBOL) {
    if (bytes.length < offset + 4 + 2 + 4 + 2) return null;

    const seed = readUint32(view, offset);
    offset += 4;
    const degree = readUint16(view, offset);
    offset += 2;
    const blockCount = readUint32(view, offset);
    offset += 4;
    const dataLength = readUint16(view, offset);
    offset += 2;

    if (bytes.length < offset + dataLength) return null;

    return {
      kind: "symbol",
      sessionId: header.sessionId,
      sessionIdHex: header.sessionIdHex,
      seed,
      degree,
      blockCount,
      data: bytes.slice(offset, offset + dataLength),
    };
  }

  return null;
}

export function decodeQrBytes(data: Uint8Array | number[]): ParsedFrame | null {
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
  return parsePayload(buffer);
}
