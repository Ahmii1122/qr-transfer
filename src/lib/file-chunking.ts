import { maxSymbolDataBytes } from "@/lib/qr-payload/limits";

/** Compact default — easier for phone cameras than a full Version 40 QR. */
export const DEFAULT_BLOCK_SIZE = 512;

export const MIN_BLOCK_SIZE = 200;
/** Max fountain block that still fits a Version 40 QR (ECC L) after frame overhead. */
export const MAX_BLOCK_SIZE = maxSymbolDataBytes();

export const DENSITY_PRESETS = [
  {
    id: "compact",
    label: "Compact",
    blockSize: 512,
    hint: "Smaller QR, easiest to scan",
  },
  {
    id: "balanced",
    label: "Balanced",
    blockSize: 1200,
    hint: "More data per frame",
  },
  {
    id: "dense",
    label: "Dense (v40)",
    blockSize: MAX_BLOCK_SIZE,
    hint: "Max QR capacity — fill the camera frame",
  },
] as const;

export interface ChunkedFile {
  fileName: string;
  fileSize: number;
  blockSize: number;
  blockCount: number;
  hash: string;
  blocks: Uint8Array[];
}

export async function sha256(data: Uint8Array): Promise<string> {
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function splitIntoBlocks(data: Uint8Array, blockSize: number): Uint8Array[] {
  const blocks: Uint8Array[] = [];

  for (let offset = 0; offset < data.length; offset += blockSize) {
    blocks.push(data.slice(offset, offset + blockSize));
  }

  return blocks;
}

export async function chunkFile(
  file: File,
  blockSize: number = DEFAULT_BLOCK_SIZE
): Promise<ChunkedFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await sha256(bytes);
  const blocks = splitIntoBlocks(bytes, blockSize);

  const result: ChunkedFile = {
    fileName: file.name,
    fileSize: file.size,
    blockSize,
    blockCount: blocks.length,
    hash,
    blocks,
  };

  return result;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
