import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail, sameCollection } from "./common";

export type ApprovalStatus = "pending" | "approved" | "declined" | "withdrawn";

/**
 * Local projection of the latest decision by every required approver. It is a
 * persistence consistency check only; protected release still depends on the
 * verified Tide operation (CH-02/CH-06), never on this status alone.
 */
export async function approvalStatus(
  ctx: Pick<QueryCtx, "db">,
  target: {
    _id: Id<"compositionPermissions"> | Id<"candidates">;
    requiredApproverIds: Id<"users">[];
  },
): Promise<ApprovalStatus> {
  let pending = false;
  let declined = false;
  for (const actorId of target.requiredApproverIds) {
    const latest = await ctx.db
      .query("decisions")
      .withIndex("by_target_and_actor", (q) =>
        q.eq("target", target._id).eq("actorId", actorId),
      )
      .order("desc")
      .first();
    if (!latest) pending = true;
    else if (latest.action === "withdraw") return "withdrawn";
    else if (latest.action === "decline") declined = true;
  }
  return declined ? "declined" : pending ? "pending" : "approved";
}

/** Rejects use of a permission unless every required approver currently approves it. */
export async function requireApproved(
  ctx: Pick<QueryCtx, "db">,
  collectionId: Id<"collections">,
  permissionId: Id<"compositionPermissions">,
): Promise<Doc<"compositionPermissions">> {
  const permission = await sameCollection(ctx, permissionId, collectionId);
  const status = await approvalStatus(ctx, permission);
  if (status !== "approved") return fail(`PERMISSION_${status.toUpperCase()}`);
  return permission;
}

export async function requireAllApproved(
  ctx: Pick<QueryCtx, "db">,
  collectionId: Id<"collections">,
  permissionIds: Iterable<Id<"compositionPermissions">>,
) {
  for (const id of new Set(permissionIds))
    await requireApproved(ctx, collectionId, id);
}
