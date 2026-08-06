/** Default block size in bytes (within spec range 200–1000). */
export const DEFAULT_BLOCK_SIZE = 512;

export const MIN_BLOCK_SIZE = 200;
export const MAX_BLOCK_SIZE = 1000;

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

  console.log("[Fountain QR] File chunked successfully");
  console.log("  File name:   ", result.fileName);
  console.log("  File size:   ", result.fileSize, "bytes");
  console.log("  Block size:  ", result.blockSize, "bytes");
  console.log("  Block count: ", result.blockCount);
  console.log("  SHA-256:     ", result.hash);
  console.log(
    "  Block sizes: ",
    blocks.map((b) => b.length)
  );

  return result;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
