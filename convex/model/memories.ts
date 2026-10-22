import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { sha256Hex } from "../../src/lib/consent/manifest";
import {
  approvers,
  command,
  fail,
  recorded,
  recordMutation,
  sameCollection,
} from "./common";
import { mediaKind } from "./validators";

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
      sha256Hex(args.contentDigest);
      if (args.priorVersionId) {
        const prior = await sameCollection(
          ctx,
          args.priorVersionId,
          args.collectionId,
        );
        if (prior.memoryId !== args.memoryId)
          return fail("WRONG_MEMORY_PREDECESSOR");
      }
      const requiredApproverIds = await approvers(ctx, args.collectionId, [
        ...new Set([memory.uploaderId, ...args.requiredApproverIds]),
      ]);
      if (
        new Set(args.requiredApproverIds).size !==
        args.requiredApproverIds.length
      )
        return fail("INVALID_APPROVER_SET");
      return ctx.db.insert("memoryVersions", {
        ...recorded(args),
        memoryId: args.memoryId,
        ...(args.priorVersionId ? { priorVersionId: args.priorVersionId } : {}),
        payloadId: args.payloadId,
        contentDigest: args.contentDigest,
        mediaKind: args.mediaKind,
        requiredApproverIds,
      });
    }),
});
