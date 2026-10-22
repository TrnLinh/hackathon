import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";

export const current = query({
  args: {},
  returns: v.object({
    subject: v.string(),
    issuer: v.string(),
    tokenIdentifier: v.string(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      throw new ConvexError("UNAUTHENTICATED");
    }
    return {
      subject: identity.subject,
      issuer: identity.issuer,
      tokenIdentifier: identity.tokenIdentifier,
    };
  },
});
