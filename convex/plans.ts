import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { commitment } from "../src/lib/consent/manifest";
import { DEV_ENVELOPE_FORMAT } from "../src/lib/consent/dev-envelope";
import {
  PLAN_COMPONENT_VERSION,
  PLAN_SCHEMA_VERSION,
} from "../src/lib/design-plan";
import { sha256Hex } from "../src/lib/memory-content";
import { approvalStatus } from "./model/approval";
import { fail, recordMutation } from "./model/common";
import { membershipOf, requireEnvelope } from "./model/collections";
import { sourceUse } from "./model/validators";
import { optionalViewer, requireViewer } from "./lib/viewer";

// CH-09 public plan API. The collection creator composes; every saved plan is
// an immutable revision whose body (the shared DesignPlan contract) travels in
// a private payload. The server cannot read the body: the browser validates
// it with src/lib/design-plan before saving, and appendPlan enforces versions,
// approved sources, editor scope and lineage. AI origins come only from the
// CH-18 job flow, never from this endpoint.

const origin = v.union(
  v.object({
    kind: v.literal("template"),
    templateId: v.string(),
    templateVersion: v.string(),
  }),
  v.object({ kind: v.literal("manual") }),
);

export const save = mutation({
  args: {
    collectionId: v.id("collections"),
    parentId: v.optional(v.id("designPlans")),
    plan: v.object({ envelope: v.string(), contentDigest: v.string() }),
    revisionOrigin: origin,
    sourceUses: v.array(sourceUse),
    retryKey: v.string(),
  },
  returns: v.id("designPlans"),
  handler: async (ctx, args): Promise<Id<"designPlans">> => {
    const viewer = await requireViewer(ctx);
    const membership = await membershipOf(ctx, args.collectionId, viewer._id);
    if (membership?.status !== "active" || membership.role !== "creator")
      return fail("NOT_COLLECTION_CREATOR");
    requireEnvelope(args.plan.envelope);
    const actor = { collectionId: args.collectionId, actorId: viewer._id };
    const request = {
      ...actor,
      retryKey: args.retryKey,
      requestDigest: await commitment(args),
    };
    return recordMutation(ctx, "plan-save", request, async () => {
      const payloadId = await ctx.runMutation(
        internal.model.media.appendPayload,
        {
          ...actor,
          retryKey: `${args.retryKey}:plan-payload`,
          body: { kind: "inline", ciphertext: args.plan.envelope },
          encryptionFormat: DEV_ENVELOPE_FORMAT,
          ciphertextDigest: await sha256Hex(args.plan.envelope),
        },
      );
      return ctx.runMutation(internal.model.plans.appendPlan, {
        ...actor,
        retryKey: `${args.retryKey}:plan`,
        ...(args.parentId ? { parentId: args.parentId } : {}),
        payloadId,
        contentDigest: args.plan.contentDigest,
        schemaVersion: PLAN_SCHEMA_VERSION,
        componentVersion: PLAN_COMPONENT_VERSION,
        revisionOrigin: args.revisionOrigin,
        sourceUses: args.sourceUses,
        derivativeIds: [],
        acceptedText: [],
      });
    });
  },
});

/**
 * Saved revisions, newest first, for the creator only. A revision is usable
 * while every source it depends on is still approved.
 */
export const list = query({
  args: { collectionId: v.id("collections") },
  returns: v.array(
    v.object({
      planId: v.id("designPlans"),
      parentId: v.union(v.id("designPlans"), v.null()),
      createdAt: v.number(),
      revisionOrigin: v.string(),
      envelope: v.union(v.string(), v.null()),
      contentDigest: v.string(),
      sourceCount: v.number(),
      usable: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer) return [];
    const membership = await membershipOf(ctx, args.collectionId, viewer._id);
    if (membership?.status !== "active" || membership.role !== "creator")
      return [];
    const plans = await ctx.db
      .query("designPlans")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .order("desc")
      .take(50);
    return Promise.all(
      plans.map(async (plan) => {
        const payload = await ctx.db.get(plan.payloadId);
        let usable = true;
        for (const source of plan.sources) {
          const permission = await ctx.db.get(source.permissionId);
          if (
            !permission ||
            (await approvalStatus(ctx, permission)) !== "approved"
          )
            usable = false;
        }
        return {
          planId: plan._id,
          parentId: plan.parentId ?? null,
          createdAt: plan.createdAt,
          revisionOrigin: plan.revisionOrigin.kind,
          envelope:
            payload?.body.kind === "inline" ? payload.body.ciphertext : null,
          contentDigest: plan.contentDigest,
          sourceCount: plan.sources.length,
          usable,
        };
      }),
    );
  },
});
