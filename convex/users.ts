import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { boundedText } from "../src/lib/consent/manifest";
import {
  claimedName,
  isOperator,
  optionalViewer,
  verifiedIdentity,
} from "./lib/viewer";

/**
 * Creates or resolves the caller's registry row from the backend-verified
 * token. Takes no arguments: the identity comes only from ctx.auth.
 */
export const ensureCurrent = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await verifiedIdentity(ctx);
    boundedText(identity.subject);
    boundedText(identity.issuer);
    boundedText(identity.tokenIdentifier);
    const name = claimedName(identity);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (existing) {
      if (existing.name !== name) await ctx.db.patch(existing._id, { name });
      return existing._id;
    }
    return ctx.db.insert("users", {
      issuer: identity.issuer,
      subject: identity.subject,
      tokenIdentifier: identity.tokenIdentifier,
      ...(name ? { name } : {}),
    });
  },
});

/** The signed-in caller's own registry summary, or null before registration. */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      name: v.optional(v.string()),
      isOperator: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer) return null;
    return {
      userId: viewer._id,
      ...(viewer.name ? { name: viewer.name } : {}),
      isOperator: await isOperator(ctx, viewer),
    };
  },
});
