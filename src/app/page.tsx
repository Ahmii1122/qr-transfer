import FileUploader from "@/components/FileUploader";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Fountain QR
            </h1>
            <p className="text-sm text-zinc-500">Phase 2 — Fountain Code Encoder</p>
          </div>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
            Next.js + Tailwind
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-12">
        <div className="mb-10 max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Upload a file to test LT encoding
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Chunk a file into blocks, then run an in-memory LT encode → decode
            round-trip. The reconstructed file hash must match the original.
          </p>
        </div>

        <FileUploader />
      </main>
    </div>
  );
}
