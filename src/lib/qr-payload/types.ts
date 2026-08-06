export interface TransferHeader {
  fileName: string;
  fileSize: number;
  blockCount: number;
  blockSize: number;
  hash: string;
}

export interface SymbolFrameInput {
  seed: number;
  degree: number;
  indices: number[];
  data: Uint8Array;
}
