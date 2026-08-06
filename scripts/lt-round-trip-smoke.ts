/**
 * Quick CLI smoke test for LT encode/decode.
 * Run: npx tsx scripts/lt-round-trip-smoke.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

// Inline minimal versions to avoid Next.js path aliases in scripts
import { splitIntoBlocks, DEFAULT_BLOCK_SIZE } from "../src/lib/file-chunking";
import { encodeBlocks } from "../src/lib/lt-code/encoder";
import { decodeSymbols } from "../src/lib/lt-code/decoder";

function sha256Node(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

const sample = new TextEncoder().encode(
  "Hello Fountain QR! ".repeat(50) + "End of test file."
);
const blockSize = DEFAULT_BLOCK_SIZE;
const blocks = splitIntoBlocks(sample, blockSize);
const originalHash = sha256Node(sample);

const symbols = encodeBlocks(blocks, blockSize, { overheadFactor: 2.0 });
const decode = decodeSymbols(symbols, blocks.length, blockSize, sample.length);

if (!decode.success || !decode.fileBytes) {
  console.error("FAIL: decode incomplete", decode);
  process.exit(1);
}

const reconstructedHash = sha256Node(decode.fileBytes);

if (reconstructedHash !== originalHash) {
  console.error("FAIL: hash mismatch");
  console.error("  original:     ", originalHash);
  console.error("  reconstructed:", reconstructedHash);
  process.exit(1);
}

console.log("PASS: LT round-trip smoke test");
console.log("  blocks: ", blocks.length);
console.log("  symbols:", symbols.length);
console.log("  hash:   ", originalHash);
