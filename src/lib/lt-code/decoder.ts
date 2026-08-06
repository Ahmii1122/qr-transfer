import { selectBlockIndices } from "./prng";
import { reassembleFile } from "./block-utils";
import type { DecodeResult, LTSymbol } from "./types";

interface ActiveSymbol {
  data: Uint8Array;
  unknown: Set<number>;
}

/**
 * LT peeling decoder (belief-propagation style).
 * XORs out known blocks until all source blocks are recovered.
 */
export function decodeSymbols(
  symbols: LTSymbol[],
  blockCount: number,
  blockSize: number,
  fileSize: number
): DecodeResult {
  const blocks: (Uint8Array | null)[] = new Array(blockCount).fill(null);

  const active: ActiveSymbol[] = symbols.map((symbol) => ({
    data: new Uint8Array(symbol.data),
    unknown: new Set(
      symbol.indices.length > 0
        ? symbol.indices
        : selectBlockIndices(symbol.seed, symbol.degree, blockCount)
    ),
  }));

  let progress = true;

  while (progress) {
    progress = false;

    for (const symbol of active) {
      if (symbol.unknown.size !== 1) continue;

      const [blockIndex] = symbol.unknown;
      if (blocks[blockIndex] !== null) {
        symbol.unknown.clear();
        continue;
      }

      blocks[blockIndex] = new Uint8Array(symbol.data);
      symbol.unknown.clear();
      progress = true;

      for (const other of active) {
        if (!other.unknown.has(blockIndex)) continue;

        const knownBlock = blocks[blockIndex]!;
        for (let i = 0; i < blockSize; i++) {
          other.data[i] ^= knownBlock[i];
        }
        other.unknown.delete(blockIndex);
      }
    }
  }

  const resolvedBlockCount = blocks.filter((block) => block !== null).length;
  const success = resolvedBlockCount === blockCount;

  if (!success) {
    return {
      success: false,
      blocks: null,
      fileBytes: null,
      resolvedBlockCount,
      totalBlockCount: blockCount,
    };
  }

  const decodedBlocks = blocks as Uint8Array[];

  return {
    success: true,
    blocks: decodedBlocks,
    fileBytes: reassembleFile(decodedBlocks, fileSize),
    resolvedBlockCount,
    totalBlockCount: blockCount,
  };
}
