import { padBlocks, xorBlocks } from "./block-utils";
import { createDegreeSampler } from "./degree-distribution";
import { selectBlockIndices } from "./prng";
import type { EncodeOptions, LTSymbol } from "./types";

export class LTEncoder {
  private readonly paddedBlocks: Uint8Array[];
  private readonly blockSize: number;
  private readonly blockCount: number;
  private readonly sampleDegree: () => number;
  private seedCounter: number;

  constructor(
    blocks: Uint8Array[],
    blockSize: number,
    startSeed = 1
  ) {
    this.paddedBlocks = padBlocks(blocks, blockSize);
    this.blockSize = blockSize;
    this.blockCount = blocks.length;
    this.sampleDegree = createDegreeSampler(this.blockCount);
    this.seedCounter = startSeed;
  }

  /** Generate the next encoded symbol in the endless stream. */
  next(): LTSymbol {
    const seed = this.seedCounter++;
    const degree = this.sampleDegree();
    const indices = selectBlockIndices(seed, degree, this.blockCount);
    const data = xorBlocks(this.paddedBlocks, indices, this.blockSize);

    return { seed, degree, indices, data };
  }

  /** Generate a batch of symbols. */
  generate(count: number): LTSymbol[] {
    return Array.from({ length: count }, () => this.next());
  }
}

export function encodeBlocks(
  blocks: Uint8Array[],
  blockSize: number,
  options: EncodeOptions = {}
): LTSymbol[] {
  const {
    overheadFactor = 2.0,
    startSeed = 1,
    symbolCount = Math.ceil(blocks.length * overheadFactor),
  } = options;

  const encoder = new LTEncoder(blocks, blockSize, startSeed);
  return encoder.generate(Math.max(symbolCount, blocks.length));
}
