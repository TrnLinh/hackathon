import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { canonicalJson } from "../../src/lib/consent/manifest";
import { fail, sameCollection, user } from "./common";
import { lineageInput, sourceDependency, sourceUse } from "./validators";

export type Lineage = {
  processingJobIds: Id<"processingJobs">[];
  sources: Infer<typeof sourceDependency>[];
  derivativeIds: Id<"derivedArtifacts">[];
};
export function mergeLineage(...parts: Lineage[]): Lineage {
  const sources = new Map<string, Infer<typeof sourceDependency>>();
  for (const part of parts)
    for (const source of part.sources) {
      const key = canonicalJson([source.versionId, source.permissionId]);
      const previous = sources.get(key);
      sources.set(key, {
        ...source,
        influence:
          previous && previous.influence !== source.influence
            ? "both"
            : source.influence,
      });
    }
  const processingJobIds = [
    ...new Set(parts.flatMap((p) => p.processingJobIds)),
  ].sort();
  const derivativeIds = [
    ...new Set(parts.flatMap((p) => p.derivativeIds)),
  ].sort();
  if (
    sources.size > 64 ||
    derivativeIds.length > 64 ||
    processingJobIds.length > 64
  )
    return fail("LINEAGE_LIMIT");
  return {
    processingJobIds,
    sources: [...sources.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, value]) => value),
    derivativeIds,
  };
}
export async function loadLineage(
  ctx: Pick<QueryCtx, "db">,
  collectionId: Id<"collections">,
  uses: Infer<typeof sourceUse>[],
  derivativeIds: Id<"derivedArtifacts">[],
): Promise<Lineage> {
  if (
    uses.length > 64 ||
    derivativeIds.length > 64 ||
    new Set(uses.map((u) => u.permissionId)).size !== uses.length ||
    new Set(derivativeIds).size !== derivativeIds.length
  )
    return fail("INVALID_LINEAGE_SET");
  const parts: Lineage[] = [];
  for (const use of uses) {
    const permission = await sameCollection(
      ctx,
      use.permissionId,
      collectionId,
    );
    const version = await sameCollection(
      ctx,
      permission.versionId,
      collectionId,
    );
    const requiredApprovers = (
      await Promise.all(
        version.requiredApproverIds.map(
          async (id) => (await user(ctx, id)).tokenIdentifier,
        ),
      )
    ).sort();
    parts.push({
      processingJobIds: [],
      sources: [
        {
          versionId: version._id,
          contentDigest: version.contentDigest,
          permissionId: permission._id,
          permissionDigest: permission.requestDigest,
          revision: permission.revision,
          influence: use.influence,
          requiredApprovers,
        },
      ],
      derivativeIds: [],
    });
  }
  for (const id of derivativeIds) {
    const artifact = await sameCollection(ctx, id, collectionId);
    parts.push({
      processingJobIds: artifact.processingJobIds,
      sources: artifact.sources,
      derivativeIds: [id, ...artifact.derivativeIds],
    });
  }
  return mergeLineage(...parts);
}

export function inputPermissionIds(input: Infer<typeof lineageInput>) {
  const ids = [
    input.permissionId,
    ...(input.kind === "derivative"
      ? (input.additionalPermissionIds ?? [])
      : []),
  ];
  if (ids.length > 64 || new Set(ids).size !== ids.length)
    return fail("INVALID_PROCESSOR_GRANT_SET");
  return ids;
}
