import { ConvexError, v } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { boundedText, commitment } from "../../src/lib/consent/manifest";

export const command = {
  collectionId: v.id("collections"),
  actorId: v.id("users"),
  retryKey: v.string(),
};
type Reader = Pick<QueryCtx, "db">;
export function fail(code: string): never {
  throw new ConvexError(code);
}
export async function user(ctx: Reader, id: Id<"users">) {
  const result = await ctx.db.get(id);
  if (!result) return fail("UNRESOLVED_IDENTITY");
  boundedText(result.subject);
  boundedText(result.issuer);
  boundedText(result.tokenIdentifier);
  // This registry is populated only from backend-verified CH-01 identities by future APIs.
  return result;
}
export async function member(
  ctx: Reader,
  collectionId: Id<"collections">,
  userId: Id<"users">,
) {
  const identity = await user(ctx, userId);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_collection_and_user", (q) =>
      q.eq("collectionId", collectionId).eq("userId", userId),
    )
    .unique();
  if (membership?.status !== "active") return fail("NOT_COLLECTION_MEMBER");
  return identity;
}
/**
 * Current or former member: admitted at some point. A join request that was
 * never admitted (requested/declined) confers nothing.
 */
export async function anyMember(
  ctx: Reader,
  collectionId: Id<"collections">,
  userId: Id<"users">,
) {
  const identity = await user(ctx, userId);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_collection_and_user", (q) =>
      q.eq("collectionId", collectionId).eq("userId", userId),
    )
    .unique();
  const admitted =
    membership?.status === "active" ||
    membership?.status === "removed" ||
    membership?.admittedAt !== undefined;
  if (!admitted) return fail("NOT_COLLECTION_MEMBER");
  return identity;
}
export async function sameCollection<
  T extends Exclude<TableNames, "users" | "collections">,
>(ctx: Reader, id: Id<T>, collectionId: Id<"collections">): Promise<Doc<T>> {
  const value = await ctx.db.get(id);
  if (
    !value ||
    !("collectionId" in value) ||
    value.collectionId !== collectionId
  )
    return fail("CROSS_COLLECTION_REFERENCE");
  return value as Doc<T>;
}
export async function approvers(
  ctx: Reader,
  collectionId: Id<"collections">,
  ids: Id<"users">[],
) {
  if (!ids.length || ids.length > 64 || new Set(ids).size !== ids.length)
    return fail("INVALID_APPROVER_SET");
  const identities = await Promise.all(
    ids.map((id) => member(ctx, collectionId, id)),
  );
  if (new Set(identities.map((i) => i.tokenIdentifier)).size !== ids.length)
    return fail("DUPLICATE_IDENTITY");
  return ids.slice().sort();
}
/**
 * Who may record a new mutation. "active" requires current membership. "any"
 * also admits removed members, for operations they must still be able to make,
 * such as withdrawing a decision they gave while a member. "join-request"
 * skips the membership check and exists only for model/collections.requestJoin,
 * which must authorize the request itself.
 */
export type MembershipRequirement = "active" | "any" | "join-request";

export async function recordMutation<T extends string>(
  ctx: MutationCtx,
  operation: string,
  args: {
    collectionId: Id<"collections">;
    actorId: Id<"users">;
    retryKey: string;
  },
  write: () => Promise<T>,
  options: { membership?: MembershipRequirement } = {},
): Promise<T> {
  boundedText(args.retryKey);
  await user(ctx, args.actorId);
  const inputDigest = await commitment(args);
  // Look up the receipt first: a lost-response retry must recover the
  // committed result even if the actor has since been removed (CH-14).
  const existing = await ctx.db
    .query("mutationReceipts")
    .withIndex("by_retry", (q) =>
      q
        .eq("collectionId", args.collectionId)
        .eq("actorId", args.actorId)
        .eq("operation", operation)
        .eq("retryKey", args.retryKey),
    )
    .unique();
  if (existing) {
    if (existing.inputDigest !== inputDigest) return fail("RETRY_KEY_REUSED");
    return existing.resultId as T;
  }
  const membership = options.membership ?? "active";
  if (membership === "active")
    await member(ctx, args.collectionId, args.actorId);
  else if (membership === "any")
    await anyMember(ctx, args.collectionId, args.actorId);
  const collection = await ctx.db.get(args.collectionId);
  if (!collection || collection.status !== "active")
    return fail("COLLECTION_UNAVAILABLE");
  const resultId = await write();
  const createdAt = Date.now();
  const base = {
    collectionId: args.collectionId,
    actorId: args.actorId,
    createdAt,
  };
  await ctx.db.insert("mutationReceipts", {
    ...base,
    operation,
    retryKey: args.retryKey,
    inputDigest,
    resultId,
  });
  // Re-read: nested recordMutation calls inside write() may have advanced it.
  const current = await ctx.db.get(collection._id);
  const sequence = (current?.eventSequence ?? collection.eventSequence) + 1;
  await ctx.db.patch(collection._id, { eventSequence: sequence });
  await ctx.db.insert("auditEvents", {
    ...base,
    sequence,
    operation,
    resourceId: resultId,
    outcome: "recorded",
  });
  return resultId;
}
export function recorded(args: {
  collectionId: Id<"collections">;
  actorId: Id<"users">;
}) {
  return {
    collectionId: args.collectionId,
    actorId: args.actorId,
    createdAt: Date.now(),
  };
}
