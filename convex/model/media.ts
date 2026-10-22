import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { boundedText, sha256Hex } from "../../src/lib/consent/manifest";
import {
  command,
  fail,
  recorded,
  recordMutation,
  sameCollection,
} from "./common";
import { completedJob } from "./jobs";
import { loadLineage, mergeLineage } from "./lineage";
import { ciphertextBody, sourceUse } from "./validators";

// Envelope validation is an adapter responsibility; a string does not prove encryption.
export const appendPayload = internalMutation({
  args: {
    ...command,
    body: ciphertextBody,
    encryptionFormat: v.string(),
    ciphertextDigest: v.string(),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "private-payload", args, async () => {
      boundedText(args.encryptionFormat);
      sha256Hex(args.ciphertextDigest);
      if (
        args.body.kind === "inline" &&
        (!args.body.ciphertext.length || args.body.ciphertext.length > 256_000)
      )
        return fail("INVALID_CIPHERTEXT_ENVELOPE");
      if (
        args.body.kind === "storage" &&
        !(await ctx.db.system.get(args.body.storageId))
      )
        return fail("MISSING_ENCRYPTED_BLOB");
      return ctx.db.insert("privatePayloads", {
        collectionId: args.collectionId,
        body: args.body,
        encryptionFormat: args.encryptionFormat,
        ciphertextDigest: args.ciphertextDigest,
        createdAt: Date.now(),
      });
    }),
});
export const appendAsset = internalMutation({
  args: {
    ...command,
    versionId: v.id("memoryVersions"),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    mimeType: v.string(),
    codec: v.string(),
    byteLength: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "media-asset", args, async () => {
      const version = await sameCollection(
        ctx,
        args.versionId,
        args.collectionId,
      );
      await sameCollection(ctx, args.payloadId, args.collectionId);
      sha256Hex(args.contentDigest);
      boundedText(args.codec);
      boundedText(args.mimeType);
      const mediaType = args.mimeType.split("/")[0];
      if (mediaType !== version.mediaKind) return fail("MEDIA_TYPE_MISMATCH");
      for (const value of [
        args.byteLength,
        args.width,
        args.height,
        args.durationMs,
      ])
        if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0))
          return fail("INVALID_MEDIA_METADATA");
      if ((args.width === undefined) !== (args.height === undefined))
        return fail("INVALID_MEDIA_METADATA");
      const { retryKey: _, ...data } = args;
      void _;
      return ctx.db.insert("mediaAssets", { ...data, ...recorded(args) });
    }),
});
export const appendArtifact = internalMutation({
  args: {
    ...command,
    versionId: v.id("memoryVersions"),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    kind: v.string(),
    transformationVersion: v.string(),
    startMs: v.number(),
    endMs: v.number(),
    provenance: v.union(v.literal("local"), v.literal("processor")),
    jobId: v.optional(v.id("processingJobs")),
    sourceUses: v.array(sourceUse),
    derivativeIds: v.array(v.id("derivedArtifacts")),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "derived-artifact", args, async () => {
      await sameCollection(ctx, args.versionId, args.collectionId);
      await sameCollection(ctx, args.payloadId, args.collectionId);
      sha256Hex(args.contentDigest);
      boundedText(args.kind);
      boundedText(args.transformationVersion);
      if (
        !Number.isSafeInteger(args.startMs) ||
        !Number.isSafeInteger(args.endMs) ||
        args.startMs < 0 ||
        args.endMs <= args.startMs
      )
        return fail("INVALID_MEDIA_RANGE");
      let lineage = await loadLineage(
        ctx,
        args.collectionId,
        args.sourceUses,
        args.derivativeIds,
      );
      if (args.provenance === "processor") {
        if (!args.jobId) return fail("PROCESSOR_JOB_REQUIRED");
        const job = await completedJob(ctx, args.collectionId, args.jobId);
        if (job.processor.transformationVersion !== args.transformationVersion)
          return fail("WRONG_TRANSFORMATION_VERSION");
        lineage = mergeLineage(lineage, {
          ...job,
          processingJobIds: [...job.processingJobIds, job._id],
        });
      } else {
        if (args.jobId) return fail("LOCAL_ARTIFACT_HAS_PROCESSOR");
        // A local edit cannot launder processor ancestry into an AI-free artifact.
        for (const source of lineage.sources) {
          const permission = await sameCollection(
            ctx,
            source.permissionId,
            args.collectionId,
          );
          if (
            permission.scope.kind === "manual" &&
            permission.scope.editorId !== args.actorId
          )
            return fail("MANUAL_SCOPE_REQUIRED");
        }
        for (const use of args.sourceUses) {
          const permission = await sameCollection(
            ctx,
            use.permissionId,
            args.collectionId,
          );
          if (permission.scope.kind !== "manual")
            return fail("MANUAL_SCOPE_REQUIRED");
        }
      }
      if (!lineage.sources.some((s) => s.versionId === args.versionId))
        return fail("ARTIFACT_SOURCE_MISSING");
      return ctx.db.insert("derivedArtifacts", {
        ...recorded(args),
        versionId: args.versionId,
        payloadId: args.payloadId,
        contentDigest: args.contentDigest,
        kind: args.kind,
        transformationVersion: args.transformationVersion,
        startMs: args.startMs,
        endMs: args.endMs,
        provenance: args.provenance,
        ...(args.jobId ? { jobId: args.jobId } : {}),
        ...lineage,
      });
    }),
});
