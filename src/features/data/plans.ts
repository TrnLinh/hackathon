"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { openDevEnvelope, sealDevEnvelope } from "@/lib/consent/dev-envelope";
import type { DesignPlan } from "@/lib/design-plan";
import { attempt, useRetryKeys } from "./backend";

// CH-09: design plan revisions on Convex. Replaces startTemplate and
// savePlanRevision from the prototype store for collections on Convex. The
// plan body is the shared DesignPlan contract, validated in the browser and
// stored in a labelled dev-envelope payload (NOT encryption) until CH-02.

export function usePlans(collectionId: Id<"collections"> | null) {
  const rows = useQuery(
    api.plans.list,
    collectionId ? { collectionId } : "skip",
  );
  return useMemo(
    () =>
      rows?.map((row) => ({
        ...row,
        plan: row.envelope
          ? (openDevEnvelope(row.envelope) as DesignPlan | null)
          : null,
      })),
    [rows],
  );
}

export type SavePlanInput = {
  collectionId: Id<"collections">;
  parentId?: Id<"designPlans">;
  plan: DesignPlan;
  digest: string;
  origin:
    | { kind: "template"; templateId: string; templateVersion: string }
    | { kind: "manual" };
  sourceUses: {
    permissionId: Id<"compositionPermissions">;
    influence: "visible" | "style";
  }[];
};

/** Mirrors startTemplate/savePlanRevision. Validate with commitPlan first. */
export function useSavePlan() {
  const save = useMutation(api.plans.save);
  const withRetryKey = useRetryKeys();
  return useCallback(
    (input: SavePlanInput) =>
      attempt(() =>
        withRetryKey(
          `${input.parentId ?? "root"}:${input.digest}`,
          (retryKey) =>
            save({
              collectionId: input.collectionId,
              ...(input.parentId ? { parentId: input.parentId } : {}),
              plan: {
                envelope: sealDevEnvelope(input.plan),
                contentDigest: input.digest,
              },
              revisionOrigin: input.origin,
              sourceUses: input.sourceUses,
              retryKey,
            }),
        ),
      ),
    [save, withRetryKey],
  );
}
