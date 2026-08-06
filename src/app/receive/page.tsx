import AppNav from "@/components/AppNav";
import QRReceiver from "@/components/QRReceiver";

export default function ReceivePage() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Fountain QR
            </h1>
            <p className="text-sm text-zinc-500">Receive files via camera</p>
          </div>
          <AppNav />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-6 py-8">
        <div className="mb-8 max-w-xl text-center">
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Scan QR codes to receive
          </h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Open this page on your phone, allow camera access, and point it at
            the sender screen. The file downloads automatically when complete.
          </p>
        </div>

        <QRReceiver />
      </main>
    </div>
  );
}
