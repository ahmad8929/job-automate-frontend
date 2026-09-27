"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginInner() {
  const error = useSearchParams().get("error");
  return (
    <div className="mx-auto mt-24 max-w-sm rounded-xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
      <h1 className="text-xl font-semibold">Job Apply</h1>
      <p className="mt-2 text-sm text-zinc-500">Private tool. Sign in with the owner&apos;s Google account.</p>
      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error === "AccessDenied" ? "This Google account is not allowed." : "Sign-in failed, try again."}
        </p>
      )}
      <button
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className="mt-6 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
      >
        Sign in with Google
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
