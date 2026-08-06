import FileUploader from "@/components/FileUploader";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Fountain QR
          </h1>
          <p className="text-sm text-zinc-500">Send files via animated QR codes</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-12">
        <div className="mb-10 max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Select a file to send
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Upload a file, then start the live QR stream to transfer it
            optically to another device.
          </p>
        </div>

        <FileUploader />
      </main>
    </div>
  );
}
