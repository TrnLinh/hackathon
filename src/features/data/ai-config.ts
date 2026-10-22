"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import { attempt, useRetryKeys } from "./backend";

// CH-22: server-authoritative AI availability. Replaces state.aiConfig and
// actions.setAiEnabled from the prototype store.

/** Sanitized public state; undefined while loading. */
export function useAiConfig() {
  return useQuery(api.aiConfig.current);
}

export function useAiCapabilities() {
  return useQuery(api.aiConfig.capabilities);
}

export function useAiHistory() {
  return useQuery(api.aiConfig.history);
}

/** Mirrors actions.setAiEnabled. The server re-checks operator status. */
export function useSetAiEnabled() {
  const setEnabled = useMutation(api.aiConfig.setEnabled);
  const withRetryKey = useRetryKeys();
  return useCallback(
    (enabled: boolean, expectedRevision: number) =>
      attempt(() =>
        withRetryKey(`${enabled}:${expectedRevision}`, (retryKey) =>
          setEnabled({ enabled, expectedRevision, retryKey }),
        ),
      ),
    [setEnabled, withRetryKey],
  );
}
