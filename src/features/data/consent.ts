"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { attempt, useRetryKeys } from "./backend";

// CH-06/07, local half: submission and decisions with LOCAL, UNVERIFIED
// evidence. Replaces submitMemory, decide, requestEdit and withdraw from the
// prototype store for collections on Convex. Statuses are local projections;
// they never stand in for Tide-verified consent.

export type DecisionAction =
  "approve" | "decline" | "request-edit" | "withdraw";

export function useInbox() {
  return useQuery(api.consent.inbox);
}

export function useConsentActions() {
  const submit = useMutation(api.consent.submit);
  const decide = useMutation(api.consent.decide);
  const withRetryKey = useRetryKeys();

  const submitMemory = useCallback(
    (memoryId: Id<"memories">) =>
      attempt(() =>
        withRetryKey(`submit:${memoryId}`, (retryKey) =>
          submit({ memoryId, retryKey }),
        ),
      ),
    [submit, withRetryKey],
  );
  const decidePermission = useCallback(
    (permissionId: Id<"compositionPermissions">, action: DecisionAction) =>
      attempt(() =>
        withRetryKey(`${action}:${permissionId}`, (retryKey) =>
          decide({ permissionId, action, retryKey }),
        ),
      ),
    [decide, withRetryKey],
  );
  return useMemo(
    () => ({ submitMemory, decide: decidePermission }),
    [submitMemory, decidePermission],
  );
}
