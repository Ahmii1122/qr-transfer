"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppNav() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      pathname === href
        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    }`;

  return (
    <nav className="flex gap-2">
      <Link href="/" className={linkClass("/")}>
        Send
      </Link>
      <Link href="/receive" className={linkClass("/receive")}>
        Receive
      </Link>
    </nav>
  );
}
