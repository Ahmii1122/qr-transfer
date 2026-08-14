"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChunkedFile } from "@/lib/file-chunking";
import { formatBytes } from "@/lib/file-chunking";
import { LTEncoder } from "@/lib/lt-code";
import { estimateSymbolsNeeded } from "@/lib/receiver";
import { encodeHeaderPayload, encodeSymbolPayload } from "@/lib/qr-payload";
import {
  createTransferSession,
  payloadToCanvas,
  QR_DISPLAY_PX,
  type TransferSession,
} from "@/lib/qr";

interface SenderStats {
  sessionIdHex: string;
  elapsedSec: number;
  symbolsSent: number;
  frameType: "header" | "symbol";
}

interface QRSenderProps {
  chunked: ChunkedFile;
}

const DEFAULT_SYMBOL_MS = 90;
const DEFAULT_HEADER_EVERY = 12;

const SPEED_PRESETS = [
  { label: "Turbo", symbolMs: 50 },
  { label: "Fast", symbolMs: 90 },
  { label: "Balanced", symbolMs: 160 },
  { label: "Safe", symbolMs: 400 },
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function QRSender({ chunked }: QRSenderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [symbolDurationMs, setSymbolDurationMs] = useState(DEFAULT_SYMBOL_MS);
  const [headerEvery, setHeaderEvery] = useState(DEFAULT_HEADER_EVERY);
  const [hasFrame, setHasFrame] = useState(false);
  const [stats, setStats] = useState<SenderStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<TransferSession>(createTransferSession());
  const encoderRef = useRef<LTEncoder | null>(null);
  const symbolsSentRef = useRef(0);
  const runningRef = useRef(false);
  const symbolDurationRef = useRef(symbolDurationMs);
  const headerEveryRef = useRef(headerEvery);

  const symbolsNeeded = estimateSymbolsNeeded(chunked.blockCount);
  const symbolsPerSec = (1000 / symbolDurationMs).toFixed(1);
  const etaSec = Math.ceil((symbolsNeeded * symbolDurationMs) / 1000);
  const kbps = ((chunked.blockSize * (1000 / symbolDurationMs)) / 1024).toFixed(1);

  symbolDurationRef.current = symbolDurationMs;
  headerEveryRef.current = headerEvery;

  const resetSession = useCallback(() => {
    sessionRef.current = createTransferSession();
    encoderRef.current = new LTEncoder(chunked.blocks, chunked.blockSize);
    symbolsSentRef.current = 0;
    setHasFrame(false);
    setStats(null);
    setError(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [chunked]);

  useEffect(() => {
    resetSession();
  }, [resetSession]);

  const makeHeaderPayload = useCallback(() => {
    return encodeHeaderPayload(sessionRef.current.sessionId, {
      fileName: chunked.fileName,
      fileSize: chunked.fileSize,
      blockCount: chunked.blockCount,
      blockSize: chunked.blockSize,
      hash: chunked.hash,
    });
  }, [chunked]);

  const makeSymbolPayload = useCallback(() => {
    if (!encoderRef.current) {
      encoderRef.current = new LTEncoder(chunked.blocks, chunked.blockSize);
    }

    const symbol = encoderRef.current.next();
    symbolsSentRef.current += 1;

    return encodeSymbolPayload(sessionRef.current.sessionId, {
      seed: symbol.seed,
      degree: symbol.degree,
      blockCount: chunked.blockCount,
      data: symbol.data,
    });
  }, [chunked]);

  const blitToVisible = useCallback((source: HTMLCanvasElement) => {
    const visible = canvasRef.current;
    if (!visible) return;
    visible.width = source.width;
    visible.height = source.height;
    const ctx = visible.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0);
    setHasFrame((shown) => shown || true);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      runningRef.current = false;
      return;
    }

    runningRef.current = true;
    sessionRef.current.startedAt = Date.now();
    let cancelled = false;

    const runLoop = async () => {
      const scratch = scratchRef.current ?? document.createElement("canvas");
      scratchRef.current = scratch;
      let headerPending = true;

      const prepare = async (kind: "header" | "symbol") => {
        const payload = kind === "header" ? makeHeaderPayload() : makeSymbolPayload();
        await payloadToCanvas(scratch, payload);
        return kind;
      };

      try {
        let nextKind = await prepare("header");
        headerPending = false;

        while (runningRef.current && !cancelled) {
          const shownAt = performance.now();
          blitToVisible(scratch);
          setStats({
            sessionIdHex: sessionRef.current.sessionIdHex,
            elapsedSec: (Date.now() - sessionRef.current.startedAt) / 1000,
            symbolsSent: symbolsSentRef.current,
            frameType: nextKind,
          });

          const upcoming: "header" | "symbol" = headerPending ? "header" : "symbol";
          if (upcoming === "header") headerPending = false;

          const nextPrepare = prepare(upcoming);
          if (
            upcoming === "symbol" &&
            symbolsSentRef.current % headerEveryRef.current === 0
          ) {
            headerPending = true;
          }

          const elapsed = performance.now() - shownAt;
          const wait = Math.max(0, symbolDurationRef.current - elapsed);
          const [, kind] = await Promise.all([sleep(wait), nextPrepare]);
          nextKind = kind;

          if (cancelled || !runningRef.current) break;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to generate QR frame");
          setIsRunning(false);
          runningRef.current = false;
        }
      }
    };

    void runLoop();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [isRunning, makeHeaderPayload, makeSymbolPayload, blitToVisible]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setStats((current) => {
        if (!current) return current;
        return {
          ...current,
          elapsedSec: (Date.now() - sessionRef.current.startedAt) / 1000,
        };
      });
    }, 250);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  const handleStart = () => {
    setError(null);
    setIsRunning(true);
  };

  const handleStop = () => {
    runningRef.current = false;
    setIsRunning(false);
  };

  const handleReset = () => {
    runningRef.current = false;
    setIsRunning(false);
    resetSession();
  };

  return (
    <div className="w-full max-w-xl space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex items-center justify-center rounded-lg bg-white p-2">
          <canvas
            ref={canvasRef}
            width={QR_DISPLAY_PX}
            height={QR_DISPLAY_PX}
            className={`size-[min(280px,70vw,42vh)] [image-rendering:pixelated] ${hasFrame ? "" : "hidden"}`}
          />
          {!hasFrame && (
            <div className="flex size-[min(280px,70vw,42vh)] items-center justify-center text-center text-sm text-zinc-400">
              {isRunning ? "Generating QR…" : "Press Start to begin sending"}
            </div>
          )}
        </div>

        {stats && (
          <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            <Stat label="Elapsed" value={`${stats.elapsedSec.toFixed(1)}s`} />
            <Stat label="Symbols sent" value={`${stats.symbolsSent} / ~${symbolsNeeded}`} />
            <Stat
              label="Frame"
              value={stats.frameType === "header" ? "Metadata" : "Symbol"}
            />
            <Stat label="Est. rate" value={`~${kbps} KB/s`} />
          </dl>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={isRunning}
              onClick={() => setSymbolDurationMs(preset.symbolMs)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                symbolDurationMs === preset.symbolMs
                  ? "bg-indigo-600 text-white"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
              }`}
            >
              {preset.label} ({preset.symbolMs} ms)
            </button>
          ))}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Frame time {symbolDurationMs} ms · ~{symbolsPerSec}/s · est. {etaSec}s
          </span>
          <input
            type="range"
            min={40}
            max={800}
            step={10}
            value={symbolDurationMs}
            onChange={(e) => setSymbolDurationMs(Number(e.target.value))}
            disabled={isRunning}
            className="h-2 w-full cursor-pointer accent-indigo-600 disabled:opacity-50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Metadata header every {headerEvery} symbols
          </span>
          <input
            type="range"
            min={5}
            max={40}
            step={1}
            value={headerEvery}
            onChange={(e) => setHeaderEvery(Number(e.target.value))}
            disabled={isRunning}
            className="h-2 w-full cursor-pointer accent-indigo-600 disabled:opacity-50"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3">
        {!isRunning ? (
          <button
            type="button"
            onClick={handleStart}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start sending
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 dark:bg-zinc-200 dark:text-zinc-900"
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Reset session
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        {chunked.fileName} ({formatBytes(chunked.fileSize)}) · {chunked.blockCount} blocks ×{" "}
        {chunked.blockSize} B · ~{symbolsNeeded} symbols needed on receiver
      </p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
