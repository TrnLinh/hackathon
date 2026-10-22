import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import { modelRecordId, workflowTarget } from "./validators";
import { fail } from "./common";

// Internal reads only. Future public APIs must authorize each exact resource.
export const get = internalQuery({
  args: { collectionId: v.id("collections"), id: modelRecordId },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record || record.collectionId !== args.collectionId)
      return fail("CROSS_COLLECTION_REFERENCE");
    return record;
  },
});
export const history = internalQuery({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) =>
    ctx.db
      .query("auditEvents")
      .withIndex("by_collection_order", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect(),
});
export const projection = internalQuery({
  args: {
    target: workflowTarget,
  },
  handler: async (ctx, args) =>
    ctx.db
      .query("workflowProjections")
      .withIndex("by_target", (q) => q.eq("target", args.target))
      .unique(),
});
