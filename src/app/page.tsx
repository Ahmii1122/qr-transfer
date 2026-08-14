import AppNav from "@/components/AppNav";
import FileUploader from "@/components/FileUploader";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Fountain QR
            </h1>
            <p className="text-sm text-zinc-500">Send files via animated QR codes</p>
          </div>
          <AppNav />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-3 py-3 sm:px-6">
        <FileUploader />
      </main>
    </div>
  );
}
