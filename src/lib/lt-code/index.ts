import { sha256, type ChunkedFile } from "@/lib/file-chunking";
import { decodeSymbols } from "./decoder";
import { encodeBlocks } from "./encoder";
import { selectBlockIndices } from "./prng";
import type { EncodeOptions, RoundTripResult, LTSymbol } from "./types";

export type { LTSymbol, EncodeOptions, DecodeResult, RoundTripResult } from "./types";
export { LTEncoder, encodeBlocks } from "./encoder";
export { decodeSymbols } from "./decoder";
export { robustSolitonDistribution } from "./degree-distribution";
export { selectBlockIndices } from "./prng";

/**
 * In-memory encode → decode round-trip test.
 * Confirms fountain code math works before QR integration.
 */
export async function runRoundTripTest(
  chunked: ChunkedFile,
  options: EncodeOptions = {}
): Promise<RoundTripResult> {
  const start = performance.now();

  const symbols = encodeBlocks(chunked.blocks, chunked.blockSize, options);
  const decode = decodeSymbols(
    symbols,
    chunked.blockCount,
    chunked.blockSize,
    chunked.fileSize
  );

  let reconstructedHash: string | null = null;

  if (decode.success && decode.fileBytes) {
    reconstructedHash = await sha256(decode.fileBytes);
  }

  return {
    symbolCount: symbols.length,
    decode,
    originalHash: chunked.hash,
    reconstructedHash,
    hashMatch: reconstructedHash === chunked.hash,
    elapsedMs: performance.now() - start,
  };
}

/** Reconstruct indices on the receiver side from seed + degree. */
export function resolveSymbolIndices(symbol: LTSymbol, blockCount: number): number[] {
  return symbol.indices.length > 0
    ? symbol.indices
    : selectBlockIndices(symbol.seed, symbol.degree, blockCount);
}
