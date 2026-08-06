"use client";

import { useEffect, useState } from "react";
import {
  formatFileSize,
  getFilePreviewKind,
  getMimeType,
} from "@/lib/receiver/file-preview";

interface ReceivedFilePreviewProps {
  bytes: Uint8Array;
  fileName: string;
}

export default function ReceivedFilePreview({ bytes, fileName }: ReceivedFilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const mime = getMimeType(fileName);
  const kind = getFilePreviewKind(fileName, mime);

  useEffect(() => {
    const blob = new Blob([bytes as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);

    if (kind === "text") {
      blob.text().then(setTextContent).catch(() => setTextContent(null));
    }

    return () => URL.revokeObjectURL(url);
  }, [bytes, mime, kind]);

  if (!objectUrl) return null;

  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs text-zinc-500">
        {fileName} · {formatFileSize(bytes.length)}
      </p>

      {kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={objectUrl}
          alt={fileName}
          className="max-h-[480px] w-full rounded-lg border border-zinc-200 object-contain dark:border-zinc-700"
        />
      )}

      {kind === "video" && (
        <video
          src={objectUrl}
          controls
          playsInline
          className="max-h-[480px] w-full rounded-lg border border-zinc-200 bg-black dark:border-zinc-700"
        />
      )}

      {kind === "audio" && (
        <audio src={objectUrl} controls className="w-full" />
      )}

      {kind === "pdf" && (
        <iframe
          src={objectUrl}
          title={fileName}
          className="h-[480px] w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
        />
      )}

      {kind === "text" && textContent !== null && (
        <pre className="max-h-[480px] overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs whitespace-pre-wrap dark:border-zinc-700 dark:bg-zinc-950">
          {textContent}
        </pre>
      )}

      {kind === "other" && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          File received and verified. Preview is not available for this file type.
        </div>
      )}
    </div>
  );
}
