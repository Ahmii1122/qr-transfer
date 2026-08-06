import { decodeSymbols } from "@/lib/lt-code/decoder";
import { selectBlockIndices } from "@/lib/lt-code/prng";
import type { DecodeResult, LTSymbol } from "@/lib/lt-code/types";
import { sha256 } from "@/lib/file-chunking";
import type { ParsedHeaderFrame, ParsedSymbolFrame } from "@/lib/qr-payload/decode";
import { estimateSymbolsNeeded, symbolProgressPercent } from "./progress";

export interface ReceiverHeader {
  sessionIdHex: string;
  fileName: string;
  fileSize: number;
  blockCount: number;
  blockSize: number;
  hash: string;
}

export interface ReceiverStats {
  sessionIdHex: string | null;
  header: ReceiverHeader | null;
  uniqueSymbols: number;
  symbolsNeeded: number;
  symbolProgress: number;
  duplicateSymbols: number;
  ignoredSymbols: number;
  pendingSymbols: number;
  resolvedBlocks: number;
  totalBlocks: number;
  isComplete: boolean;
  hashVerified: boolean;
  elapsedSec: number;
  goodputKbps: number;
}

export interface ReceiverSnapshot {
  stats: ReceiverStats;
  decode: DecodeResult | null;
  fileBytes: Uint8Array | null;
}

export class ReceiverStore {
  private sessionIdHex: string | null = null;
  private header: ReceiverHeader | null = null;
  private symbols = new Map<number, LTSymbol>();
  private duplicateCount = 0;
  private ignoredCount = 0;
  private pendingSymbols = new Map<number, ParsedSymbolFrame>();
  private startedAt = Date.now();
  private lastDecodeSymbolCount = -1;
  private cachedDecode: DecodeResult | null = null;

  reset(): void {
    this.sessionIdHex = null;
    this.header = null;
    this.symbols.clear();
    this.duplicateCount = 0;
    this.ignoredCount = 0;
    this.pendingSymbols.clear();
    this.startedAt = Date.now();
    this.lastDecodeSymbolCount = -1;
    this.cachedDecode = null;
  }

  ingestHeader(frame: ParsedHeaderFrame): boolean {
    const sessionChanged = this.sessionIdHex !== frame.sessionIdHex;
    if (sessionChanged) {
      this.symbols.clear();
      this.duplicateCount = 0;
      this.ignoredCount = 0;
      this.pendingSymbols.clear();
      this.startedAt = Date.now();
      this.lastDecodeSymbolCount = -1;
      this.cachedDecode = null;
    }

    this.sessionIdHex = frame.sessionIdHex;
    this.header = {
      sessionIdHex: frame.sessionIdHex,
      fileName: frame.fileName,
      fileSize: frame.fileSize,
      blockCount: frame.blockCount,
      blockSize: frame.blockSize,
      hash: frame.hash,
    };

    for (const pending of this.pendingSymbols.values()) {
      if (pending.sessionIdHex === frame.sessionIdHex) {
        this.ingestSymbolInternal(pending);
      }
    }
    this.pendingSymbols.clear();

    return sessionChanged;
  }

  ingestSymbol(frame: ParsedSymbolFrame): "new" | "duplicate" | "ignored" | "pending" {
    if (!this.header) {
      if (!this.sessionIdHex) {
        this.sessionIdHex = frame.sessionIdHex;
      } else if (frame.sessionIdHex !== this.sessionIdHex) {
        this.ignoredCount += 1;
        return "ignored";
      }

      if (!this.pendingSymbols.has(frame.seed)) {
        this.pendingSymbols.set(frame.seed, frame);
      }
      return "pending";
    }

    return this.ingestSymbolInternal(frame);
  }

  private ingestSymbolInternal(
    frame: ParsedSymbolFrame
  ): "new" | "duplicate" | "ignored" {
    if (!this.sessionIdHex || frame.sessionIdHex !== this.sessionIdHex) {
      this.ignoredCount += 1;
      return "ignored";
    }

    if (!this.header) {
      this.ignoredCount += 1;
      return "ignored";
    }

    if (this.symbols.has(frame.seed)) {
      this.duplicateCount += 1;
      return "duplicate";
    }

    const indices = selectBlockIndices(frame.seed, frame.degree, frame.blockCount);
    this.symbols.set(frame.seed, {
      seed: frame.seed,
      degree: frame.degree,
      indices,
      data: frame.data,
    });

    return "new";
  }

  snapshot(): ReceiverSnapshot {
    const decode = this.tryDecode();
    const elapsedSec = (Date.now() - this.startedAt) / 1000;
    const goodputKbps =
      elapsedSec > 0 && this.header
        ? (this.symbols.size * this.header.blockSize) / 1024 / elapsedSec
        : 0;

    const symbolsNeeded = this.header ? estimateSymbolsNeeded(this.header.blockCount) : 0;

    return {
      stats: {
        sessionIdHex: this.sessionIdHex,
        header: this.header,
        uniqueSymbols: this.symbols.size,
        symbolsNeeded,
        symbolProgress: symbolProgressPercent(this.symbols.size, this.header?.blockCount ?? 0),
        duplicateSymbols: this.duplicateCount,
        ignoredSymbols: this.ignoredCount,
        pendingSymbols: this.pendingSymbols.size,
        resolvedBlocks: decode?.resolvedBlockCount ?? 0,
        totalBlocks: this.header?.blockCount ?? 0,
        isComplete: decode?.success ?? false,
        hashVerified: false,
        elapsedSec,
        goodputKbps,
      },
      decode,
      fileBytes: decode?.fileBytes ?? null,
    };
  }

  async snapshotWithHashCheck(): Promise<ReceiverSnapshot & { hashVerified: boolean }> {
    const base = this.snapshot();
    let hashVerified = false;

    if (base.decode?.success && base.fileBytes && this.header) {
      const reconstructed = await sha256(base.fileBytes);
      hashVerified = reconstructed === this.header.hash;
    }

    return {
      ...base,
      stats: { ...base.stats, hashVerified, isComplete: base.stats.isComplete && hashVerified },
      hashVerified,
    };
  }

  private tryDecode(): DecodeResult | null {
    if (!this.header || this.symbols.size === 0) return null;

    if (this.symbols.size === this.lastDecodeSymbolCount && this.cachedDecode) {
      return this.cachedDecode;
    }

    this.lastDecodeSymbolCount = this.symbols.size;
    this.cachedDecode = decodeSymbols(
      Array.from(this.symbols.values()),
      this.header.blockCount,
      this.header.blockSize,
      this.header.fileSize
    );

    return this.cachedDecode;
  }
}

export function downloadFile(fileBytes: Uint8Array, fileName: string): void {
  const blob = new Blob([fileBytes as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
