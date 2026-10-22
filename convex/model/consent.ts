import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  boundedText,
  canonicalJson,
  commitment,
  parseSha256Hex,
} from "../../src/lib/consent/manifest";
import {
  approvers,
  command,
  fail,
  member,
  recorded,
  recordMutation,
  sameCollection,
  user,
} from "./common";
import { revision, scope } from "./validators";

export const recordEvidence = internalMutation({
  args: {
    ...command,
    payloadId: v.id("privatePayloads"),
    authority: v.string(),
    format: v.string(),
    statementDigest: v.string(),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "evidence", args, async () => {
      await sameCollection(ctx, args.payloadId, args.collectionId);
      boundedText(args.authority);
      boundedText(args.format);
      parseSha256Hex(args.statementDigest);
      return ctx.db.insert("evidence", {
        ...recorded(args),
        payloadId: args.payloadId,
        authority: args.authority,
        format: args.format,
        statementDigest: args.statementDigest,
        verification: "unverified",
      });
    }),
});

export const createPermission = internalMutation({
  args: { ...command, versionId: v.id("memoryVersions"), scope, revision },
  handler: async (ctx, args) =>
    recordMutation(ctx, "permission", args, async () => {
      const version = await sameCollection(
        ctx,
        args.versionId,
        args.collectionId,
      );
      const memory = await sameCollection(
        ctx,
        version.memoryId,
        args.collectionId,
      );
      if (memory.uploaderId !== args.actorId) return fail("NOT_UPLOADER");
      const requiredApproverIds = await approvers(
        ctx,
        args.collectionId,
        version.requiredApproverIds,
      );
      const evidence = await sameCollection(
        ctx,
        args.revision.evidenceId,
        args.collectionId,
      );
      boundedText(args.revision.authority);
      boundedText(args.revision.revision);
      if (evidence.authority !== args.revision.authority)
        return fail("WRONG_EVIDENCE_AUTHORITY");
      const useScope = args.scope;
      if (useScope.kind === "manual") {
        await member(ctx, args.collectionId, useScope.editorId);
        useScope.reviewerIds = await approvers(
          ctx,
          args.collectionId,
          useScope.reviewerIds,
        );
        if (
          requiredApproverIds.some((id) => !useScope.reviewerIds.includes(id))
        )
          return fail("REVIEW_AUDIENCE_MISSING_APPROVER");
        boundedText(useScope.purpose);
      } else {
        const p = useScope.processor;
        await user(ctx, p.recipientId);
        for (const field of [
          p.purpose,
          p.derivativeType,
          p.transformationVersion,
          p.retention,
        ])
          boundedText(field);
        parseSha256Hex(p.inputDigest);
      }
      const requiredApprovers = await Promise.all(
        requiredApproverIds.map(
          async (id) => (await user(ctx, id)).tokenIdentifier,
        ),
      );
      const requestDigest = await commitment({
        protocol: "chorus-permission/v1",
        collectionId: args.collectionId,
        versionId: args.versionId,
        contentDigest: version.contentDigest,
        requiredApprovers: requiredApprovers.sort(),
        scope: useScope,
        revision: args.revision,
      });
      const id = await ctx.db.insert("compositionPermissions", {
        ...recorded(args),
        versionId: args.versionId,
        scope: useScope,
        revision: args.revision,
        requestDigest,
        requiredApproverIds,
      });
      await ctx.db.insert("workflowProjections", {
        collectionId: args.collectionId,
        target: id,
        status: "pending",
        updatedAt: Date.now(),
      });
      return id;
    }),
});

export const appendDecision = internalMutation({
  args: {
    ...command,
    target: v.union(v.id("compositionPermissions"), v.id("candidates")),
    action: v.union(
      v.literal("approve"),
      v.literal("decline"),
      v.literal("withdraw"),
    ),
    requestDigest: v.string(),
    revisions: v.array(revision),
    evidenceId: v.id("evidence"),
    privateExplanationId: v.optional(v.id("privatePayloads")),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "decision", args, async () => {
      const target = await sameCollection(ctx, args.target, args.collectionId);
      if (!target.requiredApproverIds.includes(args.actorId))
        return fail("NOT_REQUIRED_APPROVER");
      if (target.requestDigest !== args.requestDigest)
        return fail("STALE_COMMITMENT");
      const revisions =
        "revision" in target
          ? [target.revision]
          : target.sources.map((s) => s.revision);
      const normalize = (refs: typeof revisions) =>
        [...new Map(refs.map((r) => [canonicalJson(r), r])).values()].sort(
          (a, b) => (canonicalJson(a) < canonicalJson(b) ? -1 : 1),
        );
      if (
        canonicalJson(normalize(revisions)) !==
          canonicalJson(normalize(args.revisions)) ||
        normalize(args.revisions).length !== args.revisions.length
      )
        return fail("STALE_REVISION_REFERENCE");
      const evidence = await sameCollection(
        ctx,
        args.evidenceId,
        args.collectionId,
      );
      if (evidence.statementDigest !== args.requestDigest)
        return fail("WRONG_EVIDENCE_COMMITMENT");
      if (args.privateExplanationId)
        await sameCollection(ctx, args.privateExplanationId, args.collectionId);
      return ctx.db.insert("decisions", {
        ...recorded(args),
        target: args.target,
        action: args.action,
        requestDigest: args.requestDigest,
        revisions: normalize(args.revisions),
        evidenceId: args.evidenceId,
        ...(args.privateExplanationId
          ? { privateExplanationId: args.privateExplanationId }
          : {}),
      });
    }),
});
