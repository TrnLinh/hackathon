import type { UserIdentity } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail } from "../model/common";

type Reader = Pick<QueryCtx, "db" | "auth">;

// Public adapters derive the actor from the verified token only. They never
// accept a user ID from the client.

export async function verifiedIdentity(ctx: Pick<QueryCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject || !identity.issuer) return fail("UNAUTHENTICATED");
  return identity;
}

/** Bounded display name from verified claims; never from client arguments. */
export function claimedName(identity: UserIdentity) {
  const name = (identity.name ?? identity.preferredUsername)?.trim();
  return name ? name.slice(0, 120) : undefined;
}

export async function optionalViewer(
  ctx: Reader,
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

/** The caller's registry row. Clients call users.ensureCurrent after sign-in. */
export async function requireViewer(ctx: Reader) {
  const identity = await verifiedIdentity(ctx);
  const viewer = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  return viewer ?? fail("UNREGISTERED_USER");
}

export async function isOperator(
  ctx: Pick<QueryCtx, "db">,
  viewer: Doc<"users">,
) {
  const operator = await ctx.db
    .query("operators")
    .withIndex("by_user", (q) => q.eq("userId", viewer._id))
    .unique();
  return operator?.active === true;
}
