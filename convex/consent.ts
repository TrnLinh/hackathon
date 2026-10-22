import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { commitment, decisionStatement } from "../src/lib/consent/manifest";
import {
  DEV_ENVELOPE_FORMAT,
  sealDevEnvelope,
} from "../src/lib/consent/dev-envelope";
import {
  LOCAL_AUTHORITY,
  LOCAL_EVIDENCE_FORMAT,
  LOCAL_REQUEST_PROTOCOL,
  MANUAL_PURPOSE,
} from "../src/lib/consent/local-evidence";
import { sha256Hex } from "../src/lib/memory-content";
import { approvalStatus } from "./model/approval";
import { fail } from "./model/common";
import { membershipOf, requireEnvelope } from "./model/collections";
import { decisionAction } from "./model/validators";
import { optionalViewer, requireViewer } from "./lib/viewer";

// CH-06/07 public consent API, local half. Requests and decisions are recorded
// with LOCAL, UNVERIFIED evidence (src/lib/consent/local-evidence.ts). The
// statuses they produce are local projections and authorize no protected
// release; Tide-backed evidence replaces this when the CH-02 gate closes.

type Actor = { collectionId: Id<"collections">; actorId: Id<"users"> };

/** Stores the statement privately and records unverified local evidence. */
async function localEvidence(
  ctx: MutationCtx,
  actor: Actor,
  retryKey: string,
  statement: Record<string, unknown>,
  statementDigest: string,
): Promise<Id<"evidence">> {
  const envelope = sealDevEnvelope(statement);
  requireEnvelope(envelope);
  const payloadId = await ctx.runMutation(internal.model.media.appendPayload, {
    ...actor,
    retryKey: `${retryKey}:evidence-payload`,
    body: { kind: "inline", ciphertext: envelope },
    encryptionFormat: DEV_ENVELOPE_FORMAT,
    ciphertextDigest: await sha256Hex(envelope),
  });
  return ctx.runMutation(internal.model.consent.recordEvidence, {
    ...actor,
    retryKey: `${retryKey}:evidence`,
    payloadId,
    authority: LOCAL_AUTHORITY,
    format: LOCAL_EVIDENCE_FORMAT,
    statementDigest,
  });
}

export async function manualPermission(
  ctx: Pick<QueryCtx, "db">,
  versionId: Id<"memoryVersions">,
) {
  const permissions = await ctx.db
    .query("compositionPermissions")
    .withIndex("by_version", (q) => q.eq("versionId", versionId))
    .collect();
  return permissions.find((p) => p.scope.kind === "manual") ?? null;
}

/**
 * Submits the current version for approval: one manual composition request
 * naming the collection creator as editor and the people in the memory as the
 * private review audience. Submitting again returns the same request.
 */
export const submit = mutation({
  args: { memoryId: v.id("memories"), retryKey: v.string() },
  returns: v.id("compositionPermissions"),
  handler: async (ctx, args): Promise<Id<"compositionPermissions">> => {
    const viewer = await requireViewer(ctx);
    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.uploaderId !== viewer._id)
      return fail("NOT_UPLOADER");
    if (!memory.headVersionId) return fail("MISSING_HEAD_VERSION");
    const existing = await manualPermission(ctx, memory.headVersionId);
    if (existing) return existing._id;
    const version = await ctx.db.get(memory.headVersionId);
    const collection = await ctx.db.get(memory.collectionId);
    if (!version || !collection) return fail("COLLECTION_UNAVAILABLE");
    const actor = { collectionId: memory.collectionId, actorId: viewer._id };
    const scope = {
      kind: "manual" as const,
      editorId: collection.ownerId,
      reviewerIds: version.requiredApproverIds,
      purpose: MANUAL_PURPOSE,
    };
    const statement = {
      protocol: LOCAL_REQUEST_PROTOCOL,
      versionId: version._id,
      contentDigest: version.contentDigest,
      scope,
    };
    const evidenceId = await localEvidence(
      ctx,
      actor,
      args.retryKey,
      statement,
      await commitment(statement),
    );
    return ctx.runMutation(internal.model.consent.createPermission, {
      ...actor,
      retryKey: `${args.retryKey}:permission`,
      versionId: version._id,
      scope,
      revision: {
        authority: LOCAL_AUTHORITY,
        revision: `local:${version._id}`,
        evidenceId,
      },
    });
  },
});

/**
 * Approve, decline, request an edit, or withdraw. The evidence commits to the
 * exact request, action, actor and revision (chorus-decision/v1).
 */
export const decide = mutation({
  args: {
    permissionId: v.id("compositionPermissions"),
    action: decisionAction,
    retryKey: v.string(),
  },
  returns: v.id("decisions"),
  handler: async (ctx, args): Promise<Id<"decisions">> => {
    const viewer = await requireViewer(ctx);
    const permission = await ctx.db.get(args.permissionId);
    if (!permission || !permission.requiredApproverIds.includes(viewer._id))
      return fail("NOT_REQUIRED_APPROVER");
    // Former members' withdrawals need non-member evidence storage (CH-08).
    const membership = await membershipOf(
      ctx,
      permission.collectionId,
      viewer._id,
    );
    if (membership?.status !== "active") return fail("NOT_COLLECTION_MEMBER");
    const actor = {
      collectionId: permission.collectionId,
      actorId: viewer._id,
    };
    const statement = {
      requestDigest: permission.requestDigest,
      action: args.action,
      actor: viewer.tokenIdentifier,
      revisions: [permission.revision],
    };
    const evidenceId = await localEvidence(
      ctx,
      actor,
      args.retryKey,
      { protocol: "chorus-decision/v1", ...statement },
      await decisionStatement(statement),
    );
    return ctx.runMutation(internal.model.consent.appendDecision, {
      ...actor,
      retryKey: `${args.retryKey}:decision`,
      target: permission._id,
      action: args.action,
      requestDigest: permission.requestDigest,
      revisions: [permission.revision],
      evidenceId,
    });
  },
});

// ---- Reads -----------------------------------------------------------------

async function latestDecision(
  ctx: Pick<QueryCtx, "db">,
  permissionId: Id<"compositionPermissions">,
  actorId: Id<"users">,
) {
  return ctx.db
    .query("decisions")
    .withIndex("by_target_and_actor", (q) =>
      q.eq("target", permissionId).eq("actorId", actorId),
    )
    .order("desc")
    .first();
}

export const approverStatus = v.object({
  userId: v.id("users"),
  name: v.union(v.string(), v.null()),
  action: v.union(decisionAction, v.null()),
  decidedAt: v.union(v.number(), v.null()),
});
export const permissionView = v.object({
  permissionId: v.id("compositionPermissions"),
  versionId: v.id("memoryVersions"),
  status: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("declined"),
    v.literal("withdrawn"),
  ),
  editorId: v.id("users"),
  purpose: v.string(),
  requestedAt: v.number(),
  /** Per-person decisions: shown to the people in the memory only. */
  approvers: v.union(v.array(approverStatus), v.null()),
  myAction: v.union(decisionAction, v.null()),
  verification: v.literal("unverified-local"),
});

/** A permission as the viewer may see it. */
export async function describePermission(
  ctx: Pick<QueryCtx, "db">,
  permission: Doc<"compositionPermissions">,
  viewerId: Id<"users">,
) {
  if (permission.scope.kind !== "manual") return fail("UNSUPPORTED_SCOPE");
  const involved = permission.requiredApproverIds.includes(viewerId);
  const approvers = involved
    ? await Promise.all(
        permission.requiredApproverIds.map(async (userId) => {
          const latest = await latestDecision(ctx, permission._id, userId);
          return {
            userId,
            name: (await ctx.db.get(userId))?.name ?? null,
            action: latest?.action ?? null,
            decidedAt: latest?.createdAt ?? null,
          };
        }),
      )
    : null;
  return {
    permissionId: permission._id,
    versionId: permission.versionId,
    status: await approvalStatus(ctx, permission),
    editorId: permission.scope.editorId,
    purpose: permission.scope.purpose,
    requestedAt: permission.createdAt,
    approvers,
    myAction: involved
      ? ((await latestDecision(ctx, permission._id, viewerId))?.action ?? null)
      : null,
    verification: "unverified-local" as const,
  };
}

/**
 * Current requests that need, or have, the caller's decision, across the
 * caller's active collections. Only head versions count.
 */
export const inbox = query({
  args: {},
  returns: v.array(
    v.object({
      collectionId: v.id("collections"),
      memoryId: v.id("memories"),
      uploaderName: v.union(v.string(), v.null()),
      permission: permissionView,
    }),
  ),
  handler: async (ctx) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", viewer._id))
      .collect();
    const rows = [];
    for (const m of memberships) {
      if (m.status !== "active") continue;
      const permissions = await ctx.db
        .query("compositionPermissions")
        .withIndex("by_collection", (q) => q.eq("collectionId", m.collectionId))
        .collect();
      for (const permission of permissions) {
        if (
          permission.scope.kind !== "manual" ||
          !permission.requiredApproverIds.includes(viewer._id)
        )
          continue;
        const version = await ctx.db.get(permission.versionId);
        const memory = version && (await ctx.db.get(version.memoryId));
        if (!memory || memory.headVersionId !== permission.versionId) continue;
        rows.push({
          collectionId: m.collectionId,
          memoryId: memory._id,
          uploaderName: (await ctx.db.get(memory.uploaderId))?.name ?? null,
          permission: await describePermission(ctx, permission, viewer._id),
        });
      }
    }
    return rows.sort(
      (a, b) => b.permission.requestedAt - a.permission.requestedAt,
    );
  },
});
