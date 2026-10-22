import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { parseSha256Hex } from "../../src/lib/consent/manifest";
import {
  approvers,
  command,
  fail,
  recorded,
  recordMutation,
  sameCollection,
} from "./common";
import { mediaKind } from "./validators";

/**
 * Creates the contribution record; the first version follows in the same
 * transaction. requestDigest binds the whole public request to the retry key.
 */
export const createMemory = internalMutation({
  args: { ...command, requestDigest: v.string() },
  handler: (ctx, args) =>
    recordMutation(ctx, "memory-create", args, () =>
      ctx.db.insert("memories", {
        collectionId: args.collectionId,
        uploaderId: args.actorId,
        createdAt: Date.now(),
      }),
    ),
});

export const appendVersion = internalMutation({
  args: {
    ...command,
    memoryId: v.id("memories"),
    priorVersionId: v.optional(v.id("memoryVersions")),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    mediaKind,
    requiredApproverIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) =>
    recordMutation(ctx, "memory-version", args, async () => {
      const memory = await sameCollection(
        ctx,
        args.memoryId,
        args.collectionId,
      );
      if (memory.uploaderId !== args.actorId) return fail("NOT_UPLOADER");
      await sameCollection(ctx, args.payloadId, args.collectionId);
      parseSha256Hex(args.contentDigest);
      // Compare-and-set against the current head so history stays linear:
      // the first version has no predecessor, and every later one names the
      // head it replaces. A stale or forked predecessor fails.
      if ((args.priorVersionId ?? null) !== (memory.headVersionId ?? null))
        return fail("STALE_VERSION_HEAD");
      if (args.priorVersionId) {
        const prior = await sameCollection(
          ctx,
          args.priorVersionId,
          args.collectionId,
        );
        if (prior.memoryId !== args.memoryId)
          return fail("WRONG_MEMORY_PREDECESSOR");
        if (prior.mediaKind !== args.mediaKind)
          return fail("MEDIA_KIND_CHANGED");
      }
      const requiredApproverIds = await approvers(ctx, args.collectionId, [
        ...new Set([memory.uploaderId, ...args.requiredApproverIds]),
      ]);
      if (
        new Set(args.requiredApproverIds).size !==
        args.requiredApproverIds.length
      )
        return fail("INVALID_APPROVER_SET");
      const versionId = await ctx.db.insert("memoryVersions", {
        ...recorded(args),
        memoryId: args.memoryId,
        ...(args.priorVersionId ? { priorVersionId: args.priorVersionId } : {}),
        payloadId: args.payloadId,
        contentDigest: args.contentDigest,
        mediaKind: args.mediaKind,
        requiredApproverIds,
      });
      await ctx.db.patch(memory._id, { headVersionId: versionId });
      return versionId;
    }),
});
