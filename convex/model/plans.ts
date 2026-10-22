import { v } from "convex/values";
import { requireAllApproved } from "./approval";
import { internalMutation } from "../_generated/server";
import {
  parseAcceptedText,
  parseSha256Hex,
} from "../../src/lib/consent/manifest";
import {
  SUPPORTED_COMPONENT_VERSIONS,
  SUPPORTED_SCHEMA_VERSIONS,
} from "../../src/lib/design-plan/schema";
import { findTemplate } from "../../src/lib/design-plan/templates";
import {
  approvers,
  command,
  fail,
  recorded,
  recordMutation,
  sameCollection,
} from "./common";
import { completedJob } from "./jobs";
import { loadLineage, mergeLineage } from "./lineage";
import { acceptedText, origin, sourceUse } from "./validators";

export const appendPlan = internalMutation({
  args: {
    ...command,
    parentId: v.optional(v.id("designPlans")),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    schemaVersion: v.string(),
    componentVersion: v.string(),
    revisionOrigin: origin,
    sourceUses: v.array(sourceUse),
    derivativeIds: v.array(v.id("derivedArtifacts")),
    acceptedText: v.array(acceptedText),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "design-plan", args, async () => {
      await sameCollection(ctx, args.payloadId, args.collectionId);
      parseSha256Hex(args.contentDigest);
      // The body is ciphertext here: the client runs the full CH-20
      // validator before saving and again before freezing (CH-10). The
      // server checks versions, template identity, lineage and approvals.
      if (!SUPPORTED_SCHEMA_VERSIONS.includes(args.schemaVersion))
        return fail("UNSUPPORTED_SCHEMA_VERSION");
      if (!SUPPORTED_COMPONENT_VERSIONS.includes(args.componentVersion))
        return fail("UNSUPPORTED_COMPONENT_VERSION");
      const parent = args.parentId
        ? await sameCollection(ctx, args.parentId, args.collectionId)
        : null;
      let lineage = await loadLineage(
        ctx,
        args.collectionId,
        args.sourceUses,
        args.derivativeIds,
      );
      if (parent) lineage = mergeLineage(parent, lineage);
      if (args.revisionOrigin.kind === "template") {
        if (
          !findTemplate(
            args.revisionOrigin.templateId,
            args.revisionOrigin.templateVersion,
          )
        )
          return fail("UNKNOWN_TEMPLATE");
      } else if (args.revisionOrigin.kind === "ai") {
        const job = await completedJob(
          ctx,
          args.collectionId,
          args.revisionOrigin.jobId,
        );
        if (
          job.processor.role !== "design" ||
          job.modelVersion !== args.revisionOrigin.modelVersion
        )
          return fail("WRONG_DESIGN_PROVENANCE");
        lineage = mergeLineage(lineage, {
          ...job,
          processingJobIds: [...job.processingJobIds, job._id],
        });
      }
      // Every source the plan depends on, including inherited and style-only
      // ones, must still be approved. A withdrawn source needs a new root plan.
      await requireAllApproved(
        ctx,
        args.collectionId,
        lineage.sources.map((s) => s.permissionId),
      );
      for (const use of args.sourceUses) {
        const permission = await sameCollection(
          ctx,
          use.permissionId,
          args.collectionId,
        );
        if (
          permission.scope.kind !== "manual" ||
          permission.scope.editorId !== args.actorId
        )
          return fail("MANUAL_SCOPE_REQUIRED");
      }
      if (args.acceptedText.length > 128) return fail("TEXT_LIMIT");
      for (const text of args.acceptedText) {
        parseAcceptedText(text);
        await sameCollection(ctx, text.payloadId, args.collectionId);
        await approvers(ctx, args.collectionId, text.authorIds);
        if (
          text.sourceVersionId &&
          !lineage.sources.some((s) => s.versionId === text.sourceVersionId)
        )
          return fail("TEXT_SOURCE_MISSING");
      }
      const id = await ctx.db.insert("designPlans", {
        ...recorded(args),
        ...(args.parentId ? { parentId: args.parentId } : {}),
        payloadId: args.payloadId,
        contentDigest: args.contentDigest,
        schemaVersion: args.schemaVersion,
        componentVersion: args.componentVersion,
        creationOrigin: parent?.creationOrigin ?? args.revisionOrigin,
        revisionOrigin: args.revisionOrigin,
        acceptedText: args.acceptedText,
        ...lineage,
      });
      await ctx.db.insert("workflowProjections", {
        collectionId: args.collectionId,
        target: id,
        status: "complete",
        // The schema has two modes: AI revisions are "ai"; template and
        // manual revisions (including Continue manually) are "template".
        editingMode: args.revisionOrigin.kind === "ai" ? "ai" : "template",
        updatedAt: Date.now(),
      });
      return id;
    }),
});
