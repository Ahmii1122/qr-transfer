export function padBlocks(blocks: Uint8Array[], blockSize: number): Uint8Array[] {
  return blocks.map((block) => {
    if (block.length === blockSize) return block;
    const padded = new Uint8Array(blockSize);
    padded.set(block);
    return padded;
  });
}

export function xorBlocks(
  blocks: Uint8Array[],
  indices: number[],
  blockSize: number
): Uint8Array {
  const result = new Uint8Array(blockSize);

  for (const index of indices) {
    const block = blocks[index];
    for (let i = 0; i < blockSize; i++) {
      result[i] ^= block[i];
    }
  }

  return result;
}

export function reassembleFile(blocks: Uint8Array[], fileSize: number): Uint8Array {
  const combined = new Uint8Array(blocks.length * (blocks[0]?.length ?? 0));
  let offset = 0;

  for (const block of blocks) {
    combined.set(block, offset);
    offset += block.length;
  }

  return combined.slice(0, fileSize);
}
