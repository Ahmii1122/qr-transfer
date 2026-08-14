"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { parseQrResult, parseQrText } from "@/lib/qr";
import { ReceiverStore, type ReceiverSnapshot } from "@/lib/receiver";
import ReceivedFilePreview from "@/components/ReceivedFilePreview";

interface ScanStats {
  captureFps: number;
  decodeFps: number;
  scansAttempted: number;
  qrDetections: number;
  validFrames: number;
}

const MAX_SCAN_DIMENSION = 960;
const SCAN_INTERVAL_MS = 30;

interface NativeBarcodeDetector {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}

type BarcodeDetectorCtor = new (options?: { formats: string[] }) => NativeBarcodeDetector;

function getBarcodeDetector(): NativeBarcodeDetector | null {
  const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

function tryDecodeQr(
  data: Uint8ClampedArray,
  width: number,
  height: number
): ReturnType<typeof jsQR> {
  if (width < 1 || height < 1 || data.length < width * height * 4) {
    return null;
  }

  try {
    let code = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
    if (!code) {
      code = jsQR(data, width, height, { inversionAttempts: "onlyInvert" });
    }
    return code;
  } catch {
    return null;
  }
}

export default function QRReceiver() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const storeRef = useRef(new ReceiverStore());
  const runningRef = useRef(false);
  const scanningRef = useRef(false);
  const detectorRef = useRef<NativeBarcodeDetector | null>(null);
  const scanStatsRef = useRef({
    captureTimes: [] as number[],
    decodeTimes: [] as number[],
    scansAttempted: 0,
    qrDetections: 0,
    validFrames: 0,
  });

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ReceiverSnapshot | null>(null);
  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [hashVerified, setHashVerified] = useState(false);
  const [completedFile, setCompletedFile] = useState<{
    bytes: Uint8Array;
    fileName: string;
  } | null>(null);

  const refreshSnapshot = useCallback(async () => {
    const result = await storeRef.current.snapshotWithHashCheck();
    setSnapshot(result);
    setHashVerified(result.hashVerified);

    if (result.hashVerified && result.fileBytes && result.stats.header) {
      setCompletedFile({
        bytes: result.fileBytes,
        fileName: result.stats.header.fileName,
      });
    }
  }, []);

  const ingestParsed = useCallback(
    (parsed: NonNullable<ReturnType<typeof parseQrResult>>) => {
      const store = storeRef.current;
      if (parsed.kind === "header") {
        store.ingestHeader(parsed);
      } else {
        store.ingestSymbol(parsed);
      }

      scanStatsRef.current.validFrames += 1;
      const now = performance.now();
      scanStatsRef.current.decodeTimes.push(now);
      if (scanStatsRef.current.decodeTimes.length > 30) {
        scanStatsRef.current.decodeTimes.shift();
      }

      void refreshSnapshot();
    },
    [refreshSnapshot]
  );

  const scanOnce = useCallback(() => {
    if (!runningRef.current || scanningRef.current) return;
    scanningRef.current = true;

    const finish = () => {
      scanningRef.current = false;
    };

    const run = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) return;

      const side = Math.min(video.videoWidth, video.videoHeight);
      const crop = Math.max(1, Math.floor(side * 0.92));
      const sx = Math.floor((video.videoWidth - crop) / 2);
      const sy = Math.floor((video.videoHeight - crop) / 2);

      const scanSize = Math.min(crop, MAX_SCAN_DIMENSION);

      canvas.width = scanSize;
      canvas.height = scanSize;
      ctx.drawImage(video, sx, sy, crop, crop, 0, 0, scanSize, scanSize);

      const now = performance.now();
      scanStatsRef.current.captureTimes.push(now);
      if (scanStatsRef.current.captureTimes.length > 30) {
        scanStatsRef.current.captureTimes.shift();
      }
      scanStatsRef.current.scansAttempted += 1;

      const imageData = ctx.getImageData(0, 0, scanSize, scanSize);
      const code = tryDecodeQr(imageData.data, imageData.width, imageData.height);

      if (code) {
        scanStatsRef.current.qrDetections += 1;
        const parsed = parseQrResult(code);
        if (parsed) ingestParsed(parsed);
      } else {
        const detector = detectorRef.current;
        if (detector) {
          try {
            const barcodes = await detector.detect(canvas);
            const rawValue = barcodes[0]?.rawValue;
            if (rawValue) {
              scanStatsRef.current.qrDetections += 1;
              const parsed = parseQrText(rawValue);
              if (parsed) ingestParsed(parsed);
            }
          } catch {
            // Native detector can throw on unsupported frames.
          }
        }
      }

      const captureTimes = scanStatsRef.current.captureTimes;
      const decodeTimes = scanStatsRef.current.decodeTimes;
      const captureFps =
        captureTimes.length > 1
          ? (1000 * (captureTimes.length - 1)) /
            (captureTimes[captureTimes.length - 1] - captureTimes[0])
          : 0;
      const decodeFps =
        decodeTimes.length > 1
          ? (1000 * (decodeTimes.length - 1)) /
            (decodeTimes[decodeTimes.length - 1] - decodeTimes[0])
          : 0;

      setScanStats({
        captureFps,
        decodeFps,
        scansAttempted: scanStatsRef.current.scansAttempted,
        qrDetections: scanStatsRef.current.qrDetections,
        validFrames: scanStatsRef.current.validFrames,
      });
    };

    void run().finally(finish);
  }, [ingestParsed]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCompletedFile(null);
    setHashVerified(false);
    detectorRef.current = getBarcodeDetector();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      runningRef.current = true;
      setIsScanning(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : "Camera access denied. Allow camera permission and use HTTPS."
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    setIsScanning(false);

    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    storeRef.current.reset();
    scanStatsRef.current = {
      captureTimes: [],
      decodeTimes: [],
      scansAttempted: 0,
      qrDetections: 0,
      validFrames: 0,
    };
    setSnapshot(null);
    setScanStats(null);
    setHashVerified(false);
    setCompletedFile(null);
  }, []);

  useEffect(() => {
    if (!isScanning) return;
    const scanTimer = window.setInterval(scanOnce, SCAN_INTERVAL_MS);
    return () => window.clearInterval(scanTimer);
  }, [isScanning, scanOnce]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (runningRef.current) void refreshSnapshot();
    }, 400);

    return () => window.clearInterval(interval);
  }, [refreshSnapshot]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const symbolProgress = snapshot?.stats.symbolProgress ?? 0;
  const blockProgress =
    snapshot && snapshot.stats.totalBlocks > 0
      ? Math.round((snapshot.stats.resolvedBlocks / snapshot.stats.totalBlocks) * 100)
      : 0;

  const noQrDetected =
    isScanning &&
    (scanStats?.scansAttempted ?? 0) > 40 &&
    (scanStats?.qrDetections ?? 0) === 0;

  return (
    <div className="w-full max-w-lg space-y-6">
      <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-black dark:border-zinc-800">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="aspect-square w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        {!isScanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 p-6 text-center text-sm text-zinc-200">
            Start scanning and fill the square with the sender QR code
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-[4%]">
          <div className="h-full w-full rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {!isScanning ? (
          <button
            type="button"
            onClick={() => void startCamera()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Start scanning
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="rounded-lg bg-zinc-800 px-5 py-2.5 text-sm font-medium text-white"
          >
            Stop
          </button>
        )}
        <button
          type="button"
          onClick={resetSession}
          className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Reset
        </button>
      </div>

      {cameraError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {cameraError}
        </div>
      )}

      {noQrDetected && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          No QR detected. Fill the square with the code, raise screen brightness, hold still, or
          switch the sender to Compact / Safe if using Dense + Fast.
        </div>
      )}

      {snapshot?.stats.header && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            {snapshot.stats.header.fileName}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {snapshot.stats.totalBlocks} blocks · {snapshot.stats.header.blockSize} bytes each
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-500">
                <span>Symbols collected</span>
                <span>
                  {snapshot.stats.uniqueSymbols} / ~{snapshot.stats.symbolsNeeded} ({symbolProgress}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${symbolProgress}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-zinc-500">
                <span>Blocks decoded</span>
                <span>{blockProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${blockProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Scan FPS" value={scanStats?.captureFps.toFixed(1) ?? "—"} />
          <Stat label="Decode FPS" value={scanStats?.decodeFps.toFixed(1) ?? "—"} />
          <Stat label="QR detections" value={String(scanStats?.qrDetections ?? 0)} />
          <Stat label="Valid frames" value={String(scanStats?.validFrames ?? 0)} />
          <Stat label="Unique symbols" value={String(snapshot?.stats.uniqueSymbols ?? 0)} />
          <Stat label="Duplicates" value={String(snapshot?.stats.duplicateSymbols ?? 0)} />
          <Stat label="Blocks locked" value={`${snapshot?.stats.resolvedBlocks ?? 0}/${snapshot?.stats.totalBlocks ?? 0}`} />
          <Stat label="Goodput" value={`${(snapshot?.stats.goodputKbps ?? 0).toFixed(1)} KB/s`} />
        </dl>
      </div>

      {completedFile && hashVerified && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            Transfer complete — file verified
          </p>
          <ReceivedFilePreview bytes={completedFile.bytes} fileName={completedFile.fileName} />
        </div>
      )}

      {symbolProgress >= 100 && !hashVerified && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          Enough symbols collected — keep scanning until blocks decode and hash verifies.
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
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  );
}
