import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { boundedText, canonicalJson } from "../../src/lib/consent/manifest";
import {
  command,
  fail,
  recorded,
  recordMutation,
  sameCollection,
  user,
} from "./common";
import { latestConfiguration } from "./configuration";
import { loadLineage } from "./lineage";
import { lineageInput, processorSpec } from "./validators";

export async function completedJob(
  ctx: Pick<QueryCtx, "db">,
  collectionId: Id<"collections">,
  jobId: Id<"processingJobs">,
) {
  const job = await sameCollection(ctx, jobId, collectionId);
  const projection = await ctx.db
    .query("workflowProjections")
    .withIndex("by_target", (q) => q.eq("target", jobId))
    .unique();
  if (projection?.status !== "complete") return fail("JOB_NOT_COMPLETE");
  const config = await latestConfiguration(ctx);
  if (
    !config?.enabled ||
    config._id !== job.configId ||
    config.revision !== job.configRevision
  )
    return fail("STALE_JOB_CONFIGURATION");
  return job;
}
export const createJob = internalMutation({
  args: {
    ...command,
    inputs: v.array(lineageInput),
    processor: processorSpec,
    modelVersion: v.string(),
    configId: v.id("aiConfigurations"),
    configRevision: v.number(),
    limits: v.object({
      maxInputBytes: v.number(),
      maxOutputBytes: v.number(),
      timeoutMs: v.number(),
    }),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "processing-job", args, async () => {
      const config = await latestConfiguration(ctx);
      if (!config?.enabled) return fail("AI_DISABLED");
      if (
        config._id !== args.configId ||
        config.revision !== args.configRevision
      )
        return fail("STALE_JOB_CONFIGURATION");
      boundedText(args.modelVersion);
      await user(ctx, args.processor.recipientId);
      for (const value of Object.values(args.limits))
        if (!Number.isSafeInteger(value) || value <= 0)
          return fail("INVALID_JOB_LIMIT");
      if (!args.inputs.length || args.inputs.length > 64)
        return fail("INVALID_JOB_INPUTS");
      for (const input of args.inputs) {
        const grant = await sameCollection(
          ctx,
          input.permissionId,
          args.collectionId,
        );
        if (grant.scope.kind !== "processor")
          return fail("PROCESSOR_SCOPE_REQUIRED");
        const { inputDigest, ...processor } = grant.scope.processor;
        if (canonicalJson(processor) !== canonicalJson(args.processor))
          return fail("PROCESSOR_SCOPE_MISMATCH");
        const version = await sameCollection(
          ctx,
          grant.versionId,
          args.collectionId,
        );
        let actualDigest = version.contentDigest;
        let actualType: string = version.mediaKind;
        if (input.kind === "derivative") {
          const artifact = await sameCollection(
            ctx,
            input.artifactId,
            args.collectionId,
          );
          if (artifact.versionId !== version._id)
            return fail("WRONG_DERIVATIVE_SOURCE");
          actualDigest = artifact.contentDigest;
          actualType = artifact.kind;
        }
        if (
          inputDigest !== actualDigest ||
          processor.derivativeType !== actualType
        )
          return fail("PROCESSOR_INPUT_MISMATCH");
      }
      const lineage = await loadLineage(
        ctx,
        args.collectionId,
        args.inputs.map((i) => ({
          permissionId: i.permissionId,
          influence: "style",
        })),
        args.inputs.flatMap((i) =>
          i.kind === "derivative" ? [i.artifactId] : [],
        ),
      );
      const id = await ctx.db.insert("processingJobs", {
        ...recorded(args),
        inputs: args.inputs,
        ...lineage,
        processor: args.processor,
        modelVersion: args.modelVersion,
        configId: args.configId,
        configRevision: args.configRevision,
        limits: args.limits,
        dispatchIdentityId: args.processor.recipientId,
      });
      await ctx.db.insert("workflowProjections", {
        collectionId: args.collectionId,
        target: id,
        status: "queued",
        updatedAt: Date.now(),
      });
      return id;
    }),
});
export const setJobState = internalMutation({
  args: {
    ...command,
    jobId: v.id("processingJobs"),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("invalidated"),
      v.literal("failed"),
    ),
    invalidationReason: v.optional(
      v.union(
        v.literal("ai-disabled"),
        v.literal("source-withdrawn"),
        v.literal("superseded"),
      ),
    ),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "job-state", args, async () => {
      await sameCollection(ctx, args.jobId, args.collectionId);
      const projection = await ctx.db
        .query("workflowProjections")
        .withIndex("by_target", (q) => q.eq("target", args.jobId))
        .unique();
      const allowed =
        projection &&
        (args.status === "invalidated"
          ? projection.status !== "invalidated"
          : projection.status === "queued"
            ? args.status === "running" || args.status === "failed"
            : projection.status === "running" &&
              (args.status === "complete" || args.status === "failed"));
      if (!projection || !allowed) return fail("INVALID_JOB_TRANSITION");
      if ((args.status === "invalidated") !== !!args.invalidationReason)
        return fail("INVALIDATION_REASON_REQUIRED");
      await ctx.db.patch(projection._id, {
        status: args.status,
        ...(args.invalidationReason
          ? { invalidationReason: args.invalidationReason }
          : {}),
        updatedAt: Date.now(),
      });
      return args.jobId;
    }),
});
