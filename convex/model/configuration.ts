import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import { boundedText, commitment } from "../../src/lib/consent/manifest";
import { fail, user } from "./common";

export async function latestConfiguration(ctx: Pick<QueryCtx, "db">) {
  return ctx.db
    .query("aiConfigurations")
    .withIndex("by_revision")
    .order("desc")
    .first();
}
export const current = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await latestConfiguration(ctx)) ?? { enabled: false, revision: 0 },
});
// Internal persistence primitive. CH-22 must expose an authenticated operator API
// and enforce current configuration immediately before every real dispatch.
export const configure = internalMutation({
  args: {
    actorId: v.id("users"),
    retryKey: v.string(),
    expectedRevision: v.number(),
    enabled: v.boolean(),
    processorConfigRef: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await user(ctx, args.actorId);
    const operator = await ctx.db
      .query("operators")
      .withIndex("by_user", (q) => q.eq("userId", args.actorId))
      .unique();
    if (!operator?.active) return fail("NOT_OPERATOR");
    boundedText(args.retryKey);
    const inputDigest = await commitment(args);
    const receipt = await ctx.db
      .query("configurationReceipts")
      .withIndex("by_retry", (q) =>
        q.eq("actorId", args.actorId).eq("retryKey", args.retryKey),
      )
      .unique();
    if (receipt) {
      if (receipt.inputDigest !== inputDigest) return fail("RETRY_KEY_REUSED");
      return receipt.configId;
    }
    const previous = await latestConfiguration(ctx);
    if (args.expectedRevision !== (previous?.revision ?? 0))
      return fail("STALE_CONFIG_REVISION");
    if (args.enabled && !args.processorConfigRef)
      return fail("PROCESSOR_CONFIG_REQUIRED");
    if (args.processorConfigRef) boundedText(args.processorConfigRef);
    const configId = await ctx.db.insert("aiConfigurations", {
      actorId: args.actorId,
      createdAt: Date.now(),
      revision: args.expectedRevision + 1,
      enabled: args.enabled,
      ...(args.processorConfigRef
        ? { processorConfigRef: args.processorConfigRef }
        : {}),
      ...(previous ? { previousId: previous._id } : {}),
    });
    await ctx.db.insert("configurationReceipts", {
      actorId: args.actorId,
      retryKey: args.retryKey,
      inputDigest,
      configId,
    });
    return configId;
  },
});
