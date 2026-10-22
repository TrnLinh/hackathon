import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { boundedText, commitment } from "../../src/lib/consent/manifest";
import {
  isDevEnvelope,
  MAX_ENVELOPE_LENGTH,
} from "../../src/lib/consent/dev-envelope";
import { command, fail, recordMutation, user } from "./common";

// CH-04 collection and membership persistence. Public adapters in
// convex/collections.ts and convex/memberships.ts derive the actor from
// ctx.auth; these functions re-check every rule.

/**
 * Only the labelled dev envelope exists until CH-02 delivers real encryption,
 * and it is accepted only where the deployment explicitly allows it.
 */
export function requireEnvelope(value: string) {
  if (!value || value.length > MAX_ENVELOPE_LENGTH)
    return fail("INVALID_ENVELOPE");
  if (!isDevEnvelope(value)) return fail("UNSUPPORTED_ENVELOPE");
  if (process.env.CHORUS_ALLOW_DEV_ENVELOPE !== "1")
    return fail("DEV_ENVELOPE_DISABLED");
}

// No 0/O, 1/I/L or U: easy to read aloud and type.
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function normalizeJoinCode(code: string) {
  return code.trim().toUpperCase();
}

async function newJoinCode(ctx: Pick<QueryCtx, "db">) {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
    const code = `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
    const taken = await ctx.db
      .query("collections")
      .withIndex("by_join_code", (q) => q.eq("joinCode", code))
      .first();
    if (!taken) return code;
  }
}

export async function membershipOf(
  ctx: Pick<QueryCtx, "db">,
  collectionId: Id<"collections">,
  userId: Id<"users">,
) {
  return ctx.db
    .query("memberships")
    .withIndex("by_collection_and_user", (q) =>
      q.eq("collectionId", collectionId).eq("userId", userId),
    )
    .unique();
}

export const createCollection = internalMutation({
  args: {
    actorId: v.id("users"),
    retryKey: v.string(),
    encryptedMetadata: v.string(),
  },
  handler: async (ctx, args) => {
    await user(ctx, args.actorId);
    boundedText(args.retryKey);
    const inputDigest = await commitment(args);
    const receipt = await ctx.db
      .query("collectionReceipts")
      .withIndex("by_retry", (q) =>
        q.eq("actorId", args.actorId).eq("retryKey", args.retryKey),
      )
      .unique();
    if (receipt) {
      if (receipt.inputDigest !== inputDigest) return fail("RETRY_KEY_REUSED");
      return receipt.collectionId;
    }
    requireEnvelope(args.encryptedMetadata);
    const createdAt = Date.now();
    const collectionId = await ctx.db.insert("collections", {
      ownerId: args.actorId,
      encryptedMetadata: args.encryptedMetadata,
      status: "active",
      eventSequence: 1,
      createdAt,
      joinCode: await newJoinCode(ctx),
    });
    await ctx.db.insert("memberships", {
      collectionId,
      userId: args.actorId,
      role: "creator",
      status: "active",
      admittedAt: createdAt,
    });
    await ctx.db.insert("auditEvents", {
      collectionId,
      actorId: args.actorId,
      createdAt,
      sequence: 1,
      operation: "collection-create",
      resourceId: collectionId,
      outcome: "recorded",
    });
    await ctx.db.insert("collectionReceipts", {
      actorId: args.actorId,
      retryKey: args.retryKey,
      inputDigest,
      collectionId,
    });
    return collectionId;
  },
});

/** Asking to join needs no membership; it never grants access by itself. */
export const requestJoin = internalMutation({
  args: command,
  handler: (ctx, args) =>
    recordMutation(
      ctx,
      "membership-request",
      args,
      async () => {
        const existing = await membershipOf(
          ctx,
          args.collectionId,
          args.actorId,
        );
        if (!existing)
          return ctx.db.insert("memberships", {
            collectionId: args.collectionId,
            userId: args.actorId,
            role: "contributor",
            status: "requested",
          });
        if (existing.status === "declined" || existing.status === "removed")
          await ctx.db.patch(existing._id, { status: "requested" });
        return existing._id;
      },
      { membership: "none" },
    ),
});

/** Admit, decline and remove are the creator's decisions only. */
async function creatorDecision(
  ctx: MutationCtx,
  args: {
    collectionId: Id<"collections">;
    actorId: Id<"users">;
    userId: Id<"users">;
  },
  from: "requested" | "active",
  to: "active" | "declined" | "removed",
) {
  const actor = await membershipOf(ctx, args.collectionId, args.actorId);
  if (actor?.role !== "creator") return fail("NOT_COLLECTION_CREATOR");
  const target = await membershipOf(ctx, args.collectionId, args.userId);
  if (!target || target.role === "creator" || target.status !== from)
    return fail("INVALID_MEMBERSHIP_TRANSITION");
  await ctx.db.patch(target._id, {
    status: to,
    ...(to === "active" && target.admittedAt === undefined
      ? { admittedAt: Date.now() }
      : {}),
  });
  return target._id;
}

const decision = { ...command, userId: v.id("users") };

export const admit = internalMutation({
  args: decision,
  handler: (ctx, args) =>
    recordMutation(ctx, "membership-admit", args, () =>
      creatorDecision(ctx, args, "requested", "active"),
    ),
});
export const decline = internalMutation({
  args: decision,
  handler: (ctx, args) =>
    recordMutation(ctx, "membership-decline", args, () =>
      creatorDecision(ctx, args, "requested", "declined"),
    ),
});
/**
 * Removal stops new application access. Approved audiences, decisions and
 * already-received files are unchanged; the person keeps withdraw rights.
 */
export const remove = internalMutation({
  args: decision,
  handler: (ctx, args) =>
    recordMutation(ctx, "membership-remove", args, () =>
      creatorDecision(ctx, args, "active", "removed"),
    ),
});
