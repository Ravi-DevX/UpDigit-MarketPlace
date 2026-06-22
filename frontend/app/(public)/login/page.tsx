"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DgenEmbeddedLogin } from "@/components/auth/DgenEmbeddedLogin";

function LoginPanel() {
  const params = useSearchParams();
  const next = params.get("next");
  const error = params.get("error");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4 py-10">
      <section className="w-full">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold">Sign in to Updigit</h1>
          <p className="mt-2 text-sm text-textSecondary">Sign in using your DGEN account.</p>
        </div>
        {error ? (
          <p className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Authentication failed: {error.replaceAll("_", " ")}
          </p>
        ) : null}
        <DgenEmbeddedLogin next={next} />
        <p className="mt-5 text-center text-sm text-textSecondary">
          New? Anyone with a DGEN account can join instantly.
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4" />}>
      <LoginPanel />
    </Suspense>
  );
}
