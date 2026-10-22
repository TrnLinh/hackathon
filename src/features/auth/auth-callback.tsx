"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useAuthConfiguration } from "@/components/providers";
import { useTideSession } from "./auth-provider";

function CallbackSession() {
  const router = useRouter();
  const session = useTideSession();
  const convex = useConvexAuth();
  useEffect(() => {
    if (
      session.phase === "anonymous" ||
      (session.phase === "authenticated" && convex.isAuthenticated)
    )
      router.replace("/app");
  }, [router, session.phase, convex.isAuthenticated]);
  return (
    <p role="status">
      {session.message ??
        (session.phase === "loading" || convex.isLoading
          ? "Completing sign-in…"
          : session.phase === "authenticated" && convex.isAuthenticated
            ? "Opening your workspace…"
            : "Sign-in did not complete. Return to Project setup to check your connection and try again.")}
    </p>
  );
}

export function AuthCallback() {
  const { configured, error } = useAuthConfiguration();
  return (
    <main className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="font-serif text-3xl">Signing you in</h1>
      {configured ? (
        <CallbackSession />
      ) : (
        <p role="alert">{error ?? "Sign-in is not configured."}</p>
      )}
      <Link href="/app/settings" className="text-sm underline">
        Return to Project setup
      </Link>
    </main>
  );
}
