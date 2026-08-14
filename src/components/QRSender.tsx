"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChunkedFile } from "@/lib/file-chunking";
import { formatBytes } from "@/lib/file-chunking";
import { LTEncoder } from "@/lib/lt-code";
import { estimateSymbolsNeeded } from "@/lib/receiver";
import { encodeHeaderPayload, encodeSymbolPayload } from "@/lib/qr-payload";
import { createTransferSession, payloadToDataUrl, type TransferSession } from "@/lib/qr";

interface SenderStats {
  sessionIdHex: string;
  elapsedSec: number;
  symbolsSent: number;
  frameType: "header" | "symbol";
}

interface QRSenderProps {
  chunked: ChunkedFile;
}

const DEFAULT_SYMBOL_MS = 350;
const DEFAULT_HEADER_EVERY = 5;

const SPEED_PRESETS = [
  { label: "Fast", symbolMs: 200 },
  { label: "Balanced", symbolMs: 600 },
  { label: "Safe", symbolMs: 1500 },
] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function QRSender({ chunked }: QRSenderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [symbolDurationMs, setSymbolDurationMs] = useState(DEFAULT_SYMBOL_MS);
  const [headerEvery, setHeaderEvery] = useState(DEFAULT_HEADER_EVERY);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<SenderStats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setQrDataUrl(null);
    setStats(null);
    setError(null);
  }, [chunked]);

  useEffect(() => {
    resetSession();
  }, [resetSession]);

  const emitHeader = useCallback(async () => {
    const session = sessionRef.current;
    const payload = encodeHeaderPayload(session.sessionId, {
      fileName: chunked.fileName,
      fileSize: chunked.fileSize,
      blockCount: chunked.blockCount,
      blockSize: chunked.blockSize,
      hash: chunked.hash,
    });
    const url = await payloadToDataUrl(payload);
    return { url, kind: "header" as const };
  }, [chunked]);

  const emitSymbol = useCallback(async () => {
    if (!encoderRef.current) {
      encoderRef.current = new LTEncoder(chunked.blocks, chunked.blockSize);
    }

    const symbol = encoderRef.current.next();
    symbolsSentRef.current += 1;

    const payload = encodeSymbolPayload(sessionRef.current.sessionId, {
      seed: symbol.seed,
      degree: symbol.degree,
      blockCount: chunked.blockCount,
      data: symbol.data,
    });
    const url = await payloadToDataUrl(payload);
    return { url, kind: "symbol" as const };
  }, [chunked]);

  useEffect(() => {
    if (!isRunning) {
      runningRef.current = false;
      return;
    }

    runningRef.current = true;
    sessionRef.current.startedAt = Date.now();
    let cancelled = false;

    const runLoop = async () => {
      let headerPending = true;

      while (runningRef.current && !cancelled) {
        try {
          let frame: { url: string; kind: "header" | "symbol" };

          if (headerPending) {
            frame = await emitHeader();
            headerPending = false;
          } else {
            frame = await emitSymbol();
            if (symbolsSentRef.current % headerEveryRef.current === 0) {
              headerPending = true;
            }
          }

          if (cancelled || !runningRef.current) break;

          setQrDataUrl(frame.url);
          setStats({
            sessionIdHex: sessionRef.current.sessionIdHex,
            elapsedSec: (Date.now() - sessionRef.current.startedAt) / 1000,
            symbolsSent: symbolsSentRef.current,
            frameType: frame.kind,
          });

          await sleep(symbolDurationRef.current);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Failed to generate QR frame");
            setIsRunning(false);
            runningRef.current = false;
          }
          break;
        }
      }
    };

    void runLoop();

    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [isRunning, emitHeader, emitSymbol]);

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
    <div className="w-full max-w-3xl space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex aspect-square items-center justify-center rounded-lg bg-white p-2 sm:p-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Live transfer QR code"
              className="h-full w-full max-w-[880px] object-contain"
            />
          ) : (
            <div className="text-center text-sm text-zinc-400">
              {isRunning ? "Generating QR…" : "Press Start to begin sending"}
            </div>
          )}
        </div>

        {stats && (
          <dl className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2 dark:border-zinc-800">
            <Stat label="Session ID" value={stats.sessionIdHex} mono className="sm:col-span-2" />
            <Stat label="Elapsed" value={`${stats.elapsedSec.toFixed(1)}s`} />
            <Stat label="Unique symbols sent" value={`${stats.symbolsSent} / ~${symbolsNeeded}`} />
            <Stat
              label="Frame type"
              value={stats.frameType === "header" ? "Metadata" : "Symbol"}
              className="sm:col-span-2"
            />
          </dl>
        )}
      </div>

      <div className="space-y-4">
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

        {chunked.blockSize >= 2000 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Dense Version 40 codes need the phone close, the screen bright, and usually Balanced
            or Safe display time — Fast often misses frames.
          </p>
        )}

        <label className="block space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Symbol display time ({symbolDurationMs} ms) · ~{symbolsPerSec} frames/sec · ~{kbps}{" "}
            KB/s · est. {etaSec}s for full send
          </span>
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
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
            min={3}
            max={30}
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
