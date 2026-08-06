"use client";

import { useCallback, useRef, useState } from "react";
import {
  chunkFile,
  DEFAULT_BLOCK_SIZE,
  formatBytes,
  MAX_BLOCK_SIZE,
  MIN_BLOCK_SIZE,
  type ChunkedFile,
} from "@/lib/file-chunking";
import { runRoundTripTest, type RoundTripResult } from "@/lib/lt-code";

export default function FileUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [blockSize, setBlockSize] = useState(DEFAULT_BLOCK_SIZE);
  const [result, setResult] = useState<ChunkedFile | null>(null);
  const [roundTrip, setRoundTrip] = useState<RoundTripResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      setRoundTrip(null);

      try {
        const chunked = await chunkFile(file, blockSize);
        setResult(chunked);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process file";
        setError(message);
        setResult(null);
        console.error("[Fountain QR] Chunking failed:", err);
      } finally {
        setLoading(false);
      }
    },
    [blockSize]
  );

  const handleRoundTripTest = useCallback(async () => {
    if (!result) return;

    setTesting(true);
    setError(null);

    try {
      const testResult = await runRoundTripTest(result);
      setRoundTrip(testResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Round-trip test failed";
      setError(message);
      console.error("[Fountain QR] Round-trip failed:", err);
    } finally {
      setTesting(false);
    }
  }, [result]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  return (
    <div className="w-full max-w-2xl space-y-8">
      <div className="space-y-2">
        <label htmlFor="block-size" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Block size (bytes)
        </label>
        <div className="flex items-center gap-4">
          <input
            id="block-size"
            type="range"
            min={MIN_BLOCK_SIZE}
            max={MAX_BLOCK_SIZE}
            step={50}
            value={blockSize}
            onChange={(e) => setBlockSize(Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer accent-indigo-600"
          />
          <span className="w-16 text-right font-mono text-sm text-zinc-600 dark:text-zinc-400">
            {blockSize}
          </span>
        </div>
        <p className="text-xs text-zinc-500">
          Range: {MIN_BLOCK_SIZE}–{MAX_BLOCK_SIZE} bytes per spec
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-8 py-14 text-center transition-colors ${
          dragOver
            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
            : "border-zinc-300 hover:border-indigo-400 dark:border-zinc-700 dark:hover:border-indigo-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
          <svg
            className="h-7 w-7 text-indigo-600 dark:text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200">
          {loading ? "Processing file…" : "Drop a file here or click to browse"}
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Any file type — results logged to browser console
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Chunking Result
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Stat label="File name" value={result.fileName} className="sm:col-span-2" />
            <Stat label="File size" value={formatBytes(result.fileSize)} />
            <Stat label="Block size" value={`${result.blockSize} bytes`} />
            <Stat label="Block count" value={String(result.blockCount)} />
            <Stat
              label="SHA-256"
              value={result.hash}
              mono
              className="sm:col-span-2"
            />
          </dl>
          <p className="mt-4 text-xs text-zinc-500">
            Open DevTools console to see full block breakdown.
          </p>

          <button
            type="button"
            onClick={() => void handleRoundTripTest()}
            disabled={testing}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testing ? "Running LT encode → decode…" : "Run LT round-trip test"}
          </button>
        </div>
      )}

      {roundTrip && (
        <div
          className={`rounded-xl border p-6 ${
            roundTrip.hashMatch
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          }`}
        >
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            LT Round-Trip Result
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Stat label="Symbols generated" value={String(roundTrip.symbolCount)} />
            <Stat
              label="Decode status"
              value={roundTrip.decode.success ? "Success" : "Incomplete"}
            />
            <Stat
              label="Blocks resolved"
              value={`${roundTrip.decode.resolvedBlockCount}/${roundTrip.decode.totalBlockCount}`}
            />
            <Stat label="Elapsed" value={`${roundTrip.elapsedMs.toFixed(1)} ms`} />
            <Stat
              label="Hash match"
              value={roundTrip.hashMatch ? "✓ Identical file" : "✗ Mismatch"}
              className="sm:col-span-2"
            />
          </dl>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
  className = "",
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-zinc-900 dark:text-zinc-100 ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
