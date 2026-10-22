"use client";

import { ConvexError } from "convex/values";
import type { ReactNode } from "react";
import { useBackendConfigured } from "@/components/providers";

// Shared plumbing for the Convex data layer. Screens move off the prototype
// store one at a time by importing hooks from src/features/data/*.

/** Renders children only when a Convex client exists (hooks need one). */
export function BackendOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useBackendConfigured() ? children : fallback;
}

/** One key per intended change; reuse it when retrying that same change. */
export function newRetryKey() {
  return crypto.randomUUID();
}

const messages: Record<string, string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  UNREGISTERED_USER: "Your account is still being set up. Try again shortly.",
  NOT_OPERATOR: "Only an authorized operator can change AI availability.",
  STALE_CONFIG_REVISION:
    "Someone changed AI availability first. Review the current state and try again.",
  PROCESSOR_CONFIG_REQUIRED: "Configure processor roles before enabling AI.",
  RETRY_KEY_REUSED: "This change conflicts with an earlier request. Try again.",
};

export type ActionResult = { ok: true } | { ok: false; reason: string };

/** Maps server error codes to user-facing copy without leaking internals. */
export function describeError(error: unknown) {
  const code =
    error instanceof ConvexError && typeof error.data === "string"
      ? error.data
      : null;
  return (code && messages[code]) ?? "Something went wrong. Please try again.";
}

export async function attempt(
  run: () => Promise<unknown>,
): Promise<ActionResult> {
  try {
    await run();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: describeError(error) };
  }
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
