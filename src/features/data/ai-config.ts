"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import { attempt, newRetryKey } from "./backend";

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
  return useCallback(
    (enabled: boolean, expectedRevision: number) =>
      attempt(() =>
        setEnabled({ enabled, expectedRevision, retryKey: newRetryKey() }),
      ),
    [setEnabled],
  );
}
