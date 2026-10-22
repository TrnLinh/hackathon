import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  commitment,
  manifestDigest,
  parseManifest,
  parseSha256Hex,
  stringSet,
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

import { inputPermissionIds } from "./lineage";

const manifestArgs = {
  collectionId: v.id("collections"),
  planId: v.id("designPlans"),
  rendererVersion: v.string(),
  fontVersions: v.array(v.string()),
  recipientId: v.id("users"),
  reviewAudienceIds: v.array(v.id("users")),
  downloadAudienceIds: v.array(v.id("users")),
  distributionScope: v.string(),
};
const manifestInput = v.object(manifestArgs);
async function buildManifest(
  ctx: Pick<QueryCtx, "db">,
  args: Infer<typeof manifestInput>,
) {
  const plan = await sameCollection(ctx, args.planId, args.collectionId);
  const identities = async (ids: Id<"users">[]) =>
    Promise.all(
      ids.map(
        async (id) =>
          (await member(ctx, args.collectionId, id)).tokenIdentifier,
      ),
    );
  await approvers(ctx, args.collectionId, args.reviewAudienceIds);
  await approvers(ctx, args.collectionId, args.downloadAudienceIds);
  const acceptedText = await Promise.all(
    plan.acceptedText.map(async (text) => ({
      ...text,
      authorIds: await identities(text.authorIds),
    })),
  );
  const derivatives = await Promise.all(
    plan.derivativeIds.map(async (id) => {
      const artifact = await sameCollection(ctx, id, args.collectionId);
      return {
        id,
        digest: artifact.contentDigest,
        sourceVersionId: artifact.versionId,
        transformationVersion: artifact.transformationVersion,
        startMs: artifact.startMs,
        endMs: artifact.endMs,
        provenance: artifact.provenance,
        ...(artifact.jobId ? { jobId: artifact.jobId } : {}),
        priorDerivativeIds: artifact.derivativeIds,
      };
    }),
  );
  const processors = await Promise.all(
    plan.processingJobIds.map(async (jobId) => {
      const job = await sameCollection(ctx, jobId, args.collectionId);
      const inputCommitments = await Promise.all(
        job.inputs.flatMap(inputPermissionIds).map(async (permissionId) => {
          const permission = await sameCollection(
            ctx,
            permissionId,
            args.collectionId,
          );
          if (permission.scope.kind !== "processor")
            return fail("PROCESSOR_SCOPE_REQUIRED");
          return {
            permissionId: permission._id,
            inputDigest: permission.scope.processor.inputDigest,
          };
        }),
      );
      const { recipientId, ...processor } = job.processor;
      return {
        jobId,
        modelVersion: job.modelVersion,
        configId: job.configId,
        configRevision: job.configRevision,
        recipient: (await user(ctx, recipientId)).tokenIdentifier,
        ...processor,
        inputCommitments,
      };
    }),
  );
  const requiredApprovers = [
    ...new Set([
      ...plan.sources.flatMap((s) => s.requiredApprovers),
      ...acceptedText.flatMap((t) => t.authorIds),
    ]),
  ].sort();
  const requiredApproverIds: Id<"users">[] = [];
  for (const token of requiredApprovers) {
    const identity = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", token))
      .unique();
    if (!identity) return fail("UNRESOLVED_IDENTITY");
    await member(ctx, args.collectionId, identity._id);
    requiredApproverIds.push(identity._id);
  }
  if (requiredApproverIds.some((id) => !args.reviewAudienceIds.includes(id)))
    return fail("REVIEW_AUDIENCE_MISSING_APPROVER");
  for (const versionId of new Set(
    plan.sources.map((source) => source.versionId),
  )) {
    const permissions = await Promise.all(
      plan.sources
        .filter((source) => source.versionId === versionId)
        .map((source) =>
          sameCollection(ctx, source.permissionId, args.collectionId),
        ),
    );
    const matching = permissions.some(
      (permission) =>
        permission.scope.kind === "manual" &&
        permission.scope.editorId === args.recipientId &&
        args.reviewAudienceIds.every(
          (id) =>
            permission.scope.kind === "manual" &&
            permission.scope.reviewerIds.includes(id),
        ),
    );
    if (!matching) return fail("REVIEW_SCOPE_WIDENED");
  }
  const manifest = parseManifest({
    protocol: "chorus-manifest/v1",
    collectionId: args.collectionId,
    plan: {
      id: plan._id,
      digest: plan.contentDigest,
      schemaVersion: plan.schemaVersion,
      componentVersion: plan.componentVersion,
      creationOrigin: plan.creationOrigin,
      revisionOrigin: plan.revisionOrigin,
      ...(plan.parentId ? { parentId: plan.parentId } : {}),
    },
    rendererVersion: args.rendererVersion,
    fontVersions: args.fontVersions,
    sources: plan.sources,
    derivatives,
    processors,
    acceptedText,
    requiredApprovers,
    recipient: (await member(ctx, args.collectionId, args.recipientId))
      .tokenIdentifier,
    reviewAudience: await identities(args.reviewAudienceIds),
    downloadAudience: await identities(args.downloadAudienceIds),
    distributionScope: args.distributionScope,
  });
  for (const source of plan.sources) {
    await sameCollection(ctx, source.permissionId, args.collectionId);
    await sameCollection(ctx, source.versionId, args.collectionId);
  }
  return {
    manifest,
    digest: await manifestDigest(manifest),
    requiredApproverIds: requiredApproverIds.sort(),
  };
}
export const prepareManifest = internalQuery({
  args: manifestInput,
  handler: buildManifest,
});
export const appendCandidate = internalMutation({
  args: {
    ...command,
    ...manifestArgs,
    pdfPayloadId: v.id("privatePayloads"),
    pdfDigest: v.string(),
    manifestPayloadId: v.id("privatePayloads"),
    manifestDigest: v.string(),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "candidate", args, async () => {
      await sameCollection(ctx, args.pdfPayloadId, args.collectionId);
      await sameCollection(ctx, args.manifestPayloadId, args.collectionId);
      parseSha256Hex(args.pdfDigest);
      parseSha256Hex(args.manifestDigest);
      const prepared = await buildManifest(ctx, args);
      if (prepared.digest !== args.manifestDigest)
        return fail("MANIFEST_DIGEST_MISMATCH");
      const plan = await sameCollection(ctx, args.planId, args.collectionId);
      const id = await ctx.db.insert("candidates", {
        ...recorded(args),
        planId: args.planId,
        pdfPayloadId: args.pdfPayloadId,
        pdfDigest: args.pdfDigest,
        manifestPayloadId: args.manifestPayloadId,
        manifestDigest: prepared.digest,
        requestDigest: "",
        requiredApproverIds: prepared.requiredApproverIds,
        recipientId: args.recipientId,
        reviewAudienceIds: [...args.reviewAudienceIds].sort(),
        downloadAudienceIds: [...args.downloadAudienceIds].sort(),
        distributionScope: args.distributionScope,
        rendererVersion: args.rendererVersion,
        fontVersions: stringSet(args.fontVersions),
        sources: plan.sources,
        derivativeIds: plan.derivativeIds,
        processingJobIds: plan.processingJobIds,
      });
      // Seal the generated ID into the commitment before this transaction is
      // visible. No committed candidate is ever patched by this API.
      const requestDigest = await commitment({
        protocol: "chorus-candidate/v1",
        collectionId: args.collectionId,
        candidateId: id,
        manifestDigest: prepared.digest,
        pdfDigest: args.pdfDigest,
      });
      await ctx.db.patch(id, { requestDigest });
      await ctx.db.insert("workflowProjections", {
        collectionId: args.collectionId,
        target: id,
        status: "pending",
        updatedAt: Date.now(),
      });
      return id;
    }),
});
// Stores an UNVERIFIED issuance claim. No official issuance/download endpoint is exposed.
// CH-12 must verify real policy authorization and receipt bytes before using this record.
export const appendEditionRecord = internalMutation({
  args: {
    ...command,
    candidateId: v.id("candidates"),
    requestDigest: v.string(),
    issuanceEvidenceId: v.id("evidence"),
    receiptPayloadId: v.id("privatePayloads"),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "edition-record", args, async () => {
      const candidate = await sameCollection(
        ctx,
        args.candidateId,
        args.collectionId,
      );
      if (candidate.requestDigest !== args.requestDigest)
        return fail("STALE_COMMITMENT");
      const evidence = await sameCollection(
        ctx,
        args.issuanceEvidenceId,
        args.collectionId,
      );
      if (evidence.statementDigest !== args.requestDigest)
        return fail("WRONG_EVIDENCE_COMMITMENT");
      await sameCollection(ctx, args.receiptPayloadId, args.collectionId);
      const existing = await ctx.db
        .query("editions")
        .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
        .unique();
      if (existing) {
        if (
          existing.issuanceEvidenceId !== args.issuanceEvidenceId ||
          existing.receiptPayloadId !== args.receiptPayloadId
        )
          return fail("EDITION_ALREADY_RECORDED");
        return existing._id;
      }
      return ctx.db.insert("editions", {
        ...recorded(args),
        candidateId: candidate._id,
        requestDigest: candidate.requestDigest,
        pdfDigest: candidate.pdfDigest,
        manifestDigest: candidate.manifestDigest,
        revisions: candidate.sources.map((s) => s.revision),
        issuanceEvidenceId: args.issuanceEvidenceId,
        receiptPayloadId: args.receiptPayloadId,
        downloadAudienceIds: candidate.downloadAudienceIds,
        verification: "unverified",
      });
    }),
});
