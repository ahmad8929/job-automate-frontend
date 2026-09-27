"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/", label: "Apply" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/profile", label: "Profile" },
];

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sticky top-0 z-10">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <span className="font-semibold tracking-tight">Job Apply</span>
        <nav className="flex gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 ${
                pathname === l.href
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm text-zinc-500">
          <span className="hidden sm:inline">{email}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
