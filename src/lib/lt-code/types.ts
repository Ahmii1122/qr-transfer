export interface LTSymbol {
  seed: number;
  degree: number;
  indices: number[];
  data: Uint8Array;
}

export interface EncodeOptions {
  /** Number of symbols to generate. Defaults to blockCount * overheadFactor. */
  symbolCount?: number;
  /** Multiplier on block count when symbolCount is omitted. Default 2.0. */
  overheadFactor?: number;
  /** Starting seed for the symbol stream. Default 1. */
  startSeed?: number;
}

export interface DecodeResult {
  success: boolean;
  blocks: Uint8Array[] | null;
  fileBytes: Uint8Array | null;
  resolvedBlockCount: number;
  totalBlockCount: number;
}

export interface RoundTripResult {
  symbolCount: number;
  decode: DecodeResult;
  originalHash: string;
  reconstructedHash: string | null;
  hashMatch: boolean;
  elapsedMs: number;
}
