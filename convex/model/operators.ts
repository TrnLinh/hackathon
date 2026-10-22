import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { fail } from "./common";

// Operator provisioning is an administrative path: these are internal, so only
// a holder of the deployment admin key can run them, e.g.
//   npx convex run model/operators:grant '{"tokenIdentifier":"<iss>|<sub>"}'
// The person must have signed in once so their registry row exists.

async function setOperator(
  ctx: MutationCtx,
  tokenIdentifier: string,
  active: boolean,
) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
  if (!user) return fail("UNRESOLVED_IDENTITY");
  const existing = await ctx.db
    .query("operators")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .unique();
  if ((existing?.active ?? false) === active) return user._id;
  if (existing) await ctx.db.patch(existing._id, { active });
  else await ctx.db.insert("operators", { userId: user._id, active });
  await ctx.db.insert("operatorChanges", {
    userId: user._id,
    active,
    createdAt: Date.now(),
  });
  return user._id;
}

export const grant = internalMutation({
  args: { tokenIdentifier: v.string() },
  handler: (ctx, args) => setOperator(ctx, args.tokenIdentifier, true),
});
export const revoke = internalMutation({
  args: { tokenIdentifier: v.string() },
  handler: (ctx, args) => setOperator(ctx, args.tokenIdentifier, false),
});
