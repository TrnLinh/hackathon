"use client";

import { ConvexError } from "convex/values";
import { Component, useCallback, useRef, type ReactNode } from "react";
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

/** Shows the fallback instead of crashing the page when a query fails. */
export class QueryBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function newRetryKey() {
  return crypto.randomUUID();
}

/**
 * Keeps one retry key per intended change until it succeeds, so retrying the
 * same change after a lost response recovers the committed result.
 */
export function useRetryKeys() {
  const keys = useRef(new Map<string, string>());
  return useCallback(
    async <T,>(intent: string, run: (retryKey: string) => Promise<T>) => {
      let key = keys.current.get(intent);
      if (!key) {
        key = newRetryKey();
        keys.current.set(intent, key);
      }
      const result = await run(key);
      keys.current.delete(intent);
      return result;
    },
    [],
  );
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
