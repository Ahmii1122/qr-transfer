/** Estimated unique LT symbols needed to reconstruct all blocks. */
export function estimateSymbolsNeeded(blockCount: number): number {
  return Math.ceil(blockCount * 2.2);
}

export function symbolProgressPercent(uniqueSymbols: number, blockCount: number): number {
  if (blockCount <= 0) return 0;
  const needed = estimateSymbolsNeeded(blockCount);
  return Math.min(100, Math.round((uniqueSymbols / needed) * 100));
}
