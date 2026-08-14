"use client";

import { useCallback, useRef, useState } from "react";
import {
  chunkFile,
  DEFAULT_BLOCK_SIZE,
  DENSITY_PRESETS,
  formatBytes,
  MAX_BLOCK_SIZE,
  MIN_BLOCK_SIZE,
  type ChunkedFile,
} from "@/lib/file-chunking";
import QRSender from "@/components/QRSender";

export default function FileUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [blockSize, setBlockSize] = useState(DEFAULT_BLOCK_SIZE);
  const [result, setResult] = useState<ChunkedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);

      try {
        const chunked = await chunkFile(file, blockSize);
        setResult(chunked);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process file";
        setError(message);
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [blockSize]
  );

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
    <div className="w-full max-w-xl space-y-5">
      {!result && (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              Select a file to send
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Upload a file, then start the live QR stream. Open Receive on your phone.
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                QR density
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Larger codes pack more bytes per frame. Dense needs a close, bright camera.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {DENSITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setBlockSize(preset.blockSize)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    blockSize === preset.blockSize
                      ? "bg-indigo-600 text-white"
                      : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label htmlFor="block-size" className="block space-y-2">
              <span className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Bytes per QR frame</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">{blockSize}</span>
              </span>
              <input
                id="block-size"
                type="range"
                min={MIN_BLOCK_SIZE}
                max={MAX_BLOCK_SIZE}
                step={50}
                value={blockSize}
                onChange={(e) => setBlockSize(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-indigo-600"
              />
            </label>
            <p className="text-xs text-zinc-500">
              {DENSITY_PRESETS.find((preset) => preset.blockSize === blockSize)?.hint ??
                "Custom size — bigger is faster if the camera can still decode it."}
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
          </div>
        </>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <QRSender chunked={result} />

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                {result.fileName}{" "}
                <span className="text-zinc-500">
                  · {formatBytes(result.fileSize)} · {result.blockSize} B/frame
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                }}
                className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                Change file
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
