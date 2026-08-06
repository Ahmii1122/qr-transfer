"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChunkedFile } from "@/lib/file-chunking";
import { formatBytes } from "@/lib/file-chunking";
import { LTEncoder } from "@/lib/lt-code";
import { encodeHeaderPayload, encodeSymbolPayload } from "@/lib/qr-payload";
import { createTransferSession, payloadToDataUrl, type TransferSession } from "@/lib/qr";

interface SenderStats {
  sessionIdHex: string;
  elapsedSec: number;
  displayFps: number;
  framesSent: number;
  frameType: "header" | "symbol";
}

interface QRSenderProps {
  chunked: ChunkedFile;
}

const DEFAULT_INTERVAL_MS = 100;
const DEFAULT_HEADER_EVERY = 30;

export default function QRSender({ chunked }: QRSenderProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [frameIntervalMs, setFrameIntervalMs] = useState(DEFAULT_INTERVAL_MS);
  const [headerEvery, setHeaderEvery] = useState(DEFAULT_HEADER_EVERY);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<SenderStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<TransferSession>(createTransferSession());
  const encoderRef = useRef<LTEncoder | null>(null);
  const frameCountRef = useRef(0);
  const busyRef = useRef(false);
  const lastFrameTimeRef = useRef(0);
  const fpsSamplesRef = useRef<number[]>([]);
  const elapsedTimerRef = useRef<number | null>(null);

  const resetSession = useCallback(() => {
    sessionRef.current = createTransferSession();
    encoderRef.current = new LTEncoder(chunked.blocks, chunked.blockSize);
    frameCountRef.current = 0;
    lastFrameTimeRef.current = 0;
    fpsSamplesRef.current = [];
    setQrDataUrl(null);
    setStats(null);
    setError(null);
  }, [chunked]);

  useEffect(() => {
    resetSession();
  }, [resetSession]);

  const updateElapsed = useCallback(() => {
    setStats((current) => {
      if (!current) return current;
      return {
        ...current,
        elapsedSec: (Date.now() - sessionRef.current.startedAt) / 1000,
      };
    });
  }, []);

  const renderFrame = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;

    try {
      if (!encoderRef.current) {
        encoderRef.current = new LTEncoder(chunked.blocks, chunked.blockSize);
      }

      const session = sessionRef.current;
      const frameIndex = frameCountRef.current++;
      const showHeader = frameIndex === 0 || frameIndex % headerEvery === 0;

      const payload = showHeader
        ? encodeHeaderPayload(session.sessionId, {
            fileName: chunked.fileName,
            fileSize: chunked.fileSize,
            blockCount: chunked.blockCount,
            blockSize: chunked.blockSize,
            hash: chunked.hash,
          })
        : encodeSymbolPayload(session.sessionId, encoderRef.current.next());

      const dataUrl = await payloadToDataUrl(payload);
      const now = performance.now();
      const frameType = showHeader ? "header" : "symbol";

      if (lastFrameTimeRef.current > 0) {
        const instantFps = 1000 / (now - lastFrameTimeRef.current);
        fpsSamplesRef.current.push(instantFps);
        if (fpsSamplesRef.current.length > 20) fpsSamplesRef.current.shift();
      }
      lastFrameTimeRef.current = now;

      const displayFps =
        fpsSamplesRef.current.length > 0
          ? fpsSamplesRef.current.reduce((sum, value) => sum + value, 0) /
            fpsSamplesRef.current.length
          : 0;

      setQrDataUrl(dataUrl);
      setStats({
        sessionIdHex: session.sessionIdHex,
        elapsedSec: (Date.now() - session.startedAt) / 1000,
        displayFps,
        framesSent: frameIndex + 1,
        frameType,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR frame");
      setIsRunning(false);
    } finally {
      busyRef.current = false;
    }
  }, [chunked, headerEvery]);

  useEffect(() => {
    if (!isRunning) {
      if (elapsedTimerRef.current !== null) {
        window.clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
      return;
    }

    sessionRef.current.startedAt = Date.now();
    void renderFrame();
    const frameTimer = window.setInterval(() => void renderFrame(), frameIntervalMs);
    elapsedTimerRef.current = window.setInterval(updateElapsed, 250);

    return () => {
      window.clearInterval(frameTimer);
      if (elapsedTimerRef.current !== null) {
        window.clearInterval(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    };
  }, [isRunning, frameIntervalMs, renderFrame, updateElapsed]);

  const handleStart = () => {
    setError(null);
    setIsRunning(true);
  };

  const handleStop = () => setIsRunning(false);

  const handleReset = () => {
    setIsRunning(false);
    resetSession();
  };

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex aspect-square items-center justify-center rounded-lg bg-white p-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Live transfer QR code"
              className="h-full w-full max-w-[320px] object-contain"
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
            <Stat label="Display FPS" value={stats.displayFps.toFixed(1)} />
            <Stat label="Frames sent" value={String(stats.framesSent)} />
            <Stat
              label="Frame type"
              value={stats.frameType === "header" ? "Metadata" : "Symbol"}
            />
          </dl>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Frame interval ({frameIntervalMs} ms)
          </span>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={frameIntervalMs}
            onChange={(e) => setFrameIntervalMs(Number(e.target.value))}
            disabled={isRunning}
            className="h-2 w-full cursor-pointer accent-indigo-600 disabled:opacity-50"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Header every {headerEvery} frames
          </span>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
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
        Sending {chunked.fileName} ({formatBytes(chunked.fileSize)}) ·{" "}
        {chunked.blockCount} blocks · {chunked.blockSize} bytes each
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
