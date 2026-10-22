import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { fail } from "./model/common";
import { membershipOf, normalizeJoinCode } from "./model/collections";
import { optionalViewer, requireViewer } from "./lib/viewer";

// CH-04 public membership API. A join code lets a signed-in person ask to
// join; only the creator admits, declines or removes.

async function byJoinCode(ctx: Pick<QueryCtx, "db">, code: string) {
  const collection = await ctx.db
    .query("collections")
    .withIndex("by_join_code", (q) => q.eq("joinCode", normalizeJoinCode(code)))
    .unique();
  return collection?.status === "active" ? collection : null;
}

/**
 * What the join page may show before admission: who invited you and how many
 * people are in it, never the encrypted title.
 */
export const preview = query({
  args: { joinCode: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      collectionId: v.id("collections"),
      creatorName: v.union(v.string(), v.null()),
      memberCount: v.number(),
      viewerStatus: v.union(
        v.literal("none"),
        v.literal("requested"),
        v.literal("active"),
        v.literal("declined"),
        v.literal("removed"),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer || args.joinCode.length > 64) return null;
    const collection = await byJoinCode(ctx, args.joinCode);
    if (!collection) return null;
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_collection_and_user", (q) =>
        q.eq("collectionId", collection._id),
      )
      .collect();
    const mine = rows.find((m) => m.userId === viewer._id);
    return {
      collectionId: collection._id,
      creatorName: (await ctx.db.get(collection.ownerId))?.name ?? null,
      memberCount: rows.filter((m) => m.status === "active").length,
      viewerStatus: mine?.status ?? ("none" as const),
    };
  },
});

/** Join requests, visible to the creator only. */
export const requests = query({
  args: { collectionId: v.id("collections") },
  returns: v.array(
    v.object({ userId: v.id("users"), name: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, args) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer) return [];
    const mine = await membershipOf(ctx, args.collectionId, viewer._id);
    if (mine?.status !== "active" || mine.role !== "creator") return [];
    const rows = await ctx.db
      .query("memberships")
      .withIndex("by_collection_and_user", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();
    return Promise.all(
      rows
        .filter((m) => m.status === "requested")
        .map(async (m) => ({
          userId: m.userId,
          name: (await ctx.db.get(m.userId))?.name ?? null,
        })),
    );
  },
});

export const requestJoin = mutation({
  args: { joinCode: v.string(), retryKey: v.string() },
  returns: v.id("collections"),
  handler: async (ctx, args): Promise<Id<"collections">> => {
    const viewer = await requireViewer(ctx);
    if (args.joinCode.length > 64) return fail("INVALID_JOIN_CODE");
    const collection = await byJoinCode(ctx, args.joinCode);
    if (!collection) return fail("INVALID_JOIN_CODE");
    await ctx.runMutation(internal.model.collections.requestJoin, {
      collectionId: collection._id,
      actorId: viewer._id,
      retryKey: args.retryKey,
    });
    return collection._id;
  },
});

const decision = {
  collectionId: v.id("collections"),
  userId: v.id("users"),
  retryKey: v.string(),
};

export const admit = mutation({
  args: decision,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const viewer = await requireViewer(ctx);
    await ctx.runMutation(internal.model.collections.admit, {
      ...args,
      actorId: viewer._id,
    });
    return null;
  },
});

export const decline = mutation({
  args: decision,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const viewer = await requireViewer(ctx);
    await ctx.runMutation(internal.model.collections.decline, {
      ...args,
      actorId: viewer._id,
    });
    return null;
  },
});

export const remove = mutation({
  args: decision,
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const viewer = await requireViewer(ctx);
    await ctx.runMutation(internal.model.collections.remove, {
      ...args,
      actorId: viewer._id,
    });
    return null;
  },
});
