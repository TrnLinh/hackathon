import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { membershipOf } from "./model/collections";
import { optionalViewer, requireViewer } from "./lib/viewer";

// CH-04 public collection API. Metadata is returned only to active members,
// as the envelope the client opens; the server never decodes it.

const role = v.union(v.literal("creator"), v.literal("contributor"));

async function activeMembers(
  ctx: Pick<QueryCtx, "db">,
  collectionId: Id<"collections">,
) {
  const rows = await ctx.db
    .query("memberships")
    .withIndex("by_collection_and_user", (q) =>
      q.eq("collectionId", collectionId),
    )
    .collect();
  return {
    // Creator first, then contributors in a stable order.
    active: rows
      .filter((m) => m.status === "active")
      .sort((a, b) => (a.role === b.role ? 0 : a.role === "creator" ? -1 : 1)),
    requested: rows.filter((m) => m.status === "requested"),
  };
}

async function person(ctx: Pick<QueryCtx, "db">, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  return { userId, name: user?.name ?? null };
}

const personValidator = v.object({
  userId: v.id("users"),
  name: v.union(v.string(), v.null()),
});

export const create = mutation({
  args: { encryptedMetadata: v.string(), retryKey: v.string() },
  returns: v.id("collections"),
  handler: async (ctx, args): Promise<Id<"collections">> => {
    const viewer = await requireViewer(ctx);
    return ctx.runMutation(internal.model.collections.createCollection, {
      actorId: viewer._id,
      retryKey: args.retryKey,
      encryptedMetadata: args.encryptedMetadata,
    });
  },
});

const summary = v.union(
  v.object({
    status: v.literal("active"),
    collectionId: v.id("collections"),
    encryptedMetadata: v.string(),
    role,
    createdAt: v.number(),
    members: v.array(personValidator),
    pendingCount: v.number(),
  }),
  v.object({
    status: v.literal("requested"),
    collectionId: v.id("collections"),
    creator: personValidator,
  }),
);

/** The caller's collections, plus join requests still awaiting admission. */
export const listMine = query({
  args: {},
  returns: v.array(summary),
  handler: async (ctx) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect();
    const results = await Promise.all(
      memberships.map(async (m) => {
        const collection = await ctx.db.get(m.collectionId);
        if (!collection || collection.status !== "active") return null;
        if (m.status === "requested")
          return {
            status: "requested" as const,
            collectionId: collection._id,
            creator: await person(ctx, collection.ownerId),
          };
        if (m.status !== "active") return null;
        const { active, requested } = await activeMembers(ctx, collection._id);
        return {
          status: "active" as const,
          collectionId: collection._id,
          encryptedMetadata: collection.encryptedMetadata,
          role: m.role,
          createdAt: collection.createdAt,
          members: await Promise.all(active.map((a) => person(ctx, a.userId))),
          pendingCount: m.role === "creator" ? requested.length : 0,
        };
      }),
    );
    return results
      .filter((r) => r !== null)
      .sort((a, b) =>
        a.status === b.status ? 0 : a.status === "active" ? -1 : 1,
      );
  },
});

function collectionDetail(
  collection: Doc<"collections">,
  membership: Doc<"memberships">,
) {
  return {
    access: "member" as const,
    collectionId: collection._id,
    encryptedMetadata: collection.encryptedMetadata,
    role: membership.role,
    ownerId: collection.ownerId,
    createdAt: collection.createdAt,
    // Only the creator shares the join code.
    joinCode:
      membership.role === "creator" ? (collection.joinCode ?? null) : null,
  };
}

/**
 * One collection for an active member. Anyone else learns only whether their
 * own request is pending; unknown, malformed and foreign IDs look the same.
 */
export const get = query({
  args: { collectionId: v.string() },
  returns: v.union(
    v.object({
      access: v.literal("member"),
      collectionId: v.id("collections"),
      encryptedMetadata: v.string(),
      role,
      ownerId: v.id("users"),
      createdAt: v.number(),
      joinCode: v.union(v.string(), v.null()),
      members: v.array(v.object({ ...personValidator.fields, role })),
    }),
    v.object({ access: v.literal("requested") }),
    v.object({ access: v.literal("none") }),
  ),
  handler: async (ctx, args) => {
    const viewer = await optionalViewer(ctx);
    const id = ctx.db.normalizeId("collections", args.collectionId);
    const collection = id && (await ctx.db.get(id));
    if (!viewer || !collection || collection.status !== "active")
      return { access: "none" as const };
    const membership = await membershipOf(ctx, collection._id, viewer._id);
    if (membership?.status === "requested")
      return { access: "requested" as const };
    if (membership?.status !== "active") return { access: "none" as const };
    const { active } = await activeMembers(ctx, collection._id);
    return {
      ...collectionDetail(collection, membership),
      members: await Promise.all(
        active.map(async (a) => ({
          ...(await person(ctx, a.userId)),
          role: a.role,
        })),
      ),
    };
  },
});
