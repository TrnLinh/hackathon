import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { commitment } from "../src/lib/consent/manifest";
import { DEV_ENVELOPE_FORMAT } from "../src/lib/consent/dev-envelope";
import { LIMITS } from "../src/lib/limits";
import {
  MEDIA_BYTE_LIMITS,
  MEDIA_MIME_TYPES,
  normalizeSha256,
  sha256Hex,
} from "../src/lib/memory-content";
import { fail, member } from "./model/common";
import { requireEnvelope } from "./model/collections";
import { mediaKind } from "./model/validators";
import { optionalViewer, requireViewer } from "./lib/viewer";

// CH-05 public memory API. Content (title, caption, story) travels in a
// private payload envelope; media bytes in a separate storage payload. Until
// CH-02 both use the labelled dev envelope, which is NOT encryption.
//
// Visibility in this slice: a version is a private draft visible only to its
// uploader. CH-06 adds submission and approver review.

const content = v.object({ envelope: v.string(), contentDigest: v.string() });
const upload = v.object({
  storageId: v.id("_storage"),
  mimeType: v.string(),
  codec: v.string(),
  byteLength: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  durationMs: v.optional(v.number()),
});
type Upload = typeof upload.type;
type Kind = Doc<"memoryVersions">["mediaKind"];
type Actor = { collectionId: Id<"collections">; actorId: Id<"users"> };

type AssetFields = {
  payloadId: Id<"privatePayloads">;
  contentDigest: string;
  mimeType: string;
  codec: string;
  byteLength: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

/** Exactly the asset fields, omitting absent optional dimensions. */
function assetFields(source: AssetFields): AssetFields {
  const { payloadId, contentDigest, mimeType, codec, byteLength } = source;
  return {
    payloadId,
    contentDigest,
    mimeType,
    codec,
    byteLength,
    ...(source.width !== undefined ? { width: source.width } : {}),
    ...(source.height !== undefined ? { height: source.height } : {}),
    ...(source.durationMs !== undefined
      ? { durationMs: source.durationMs }
      : {}),
  };
}

/** Server-visible checks on an uploaded blob, then a single-use claim. */
async function claimUpload(
  ctx: MutationCtx,
  actor: Actor,
  kind: Kind,
  media: Upload,
) {
  if (kind === "text") return fail("TEXT_HAS_NO_MEDIA");
  const stored = await ctx.db.system.get(media.storageId);
  if (!stored) return fail("MISSING_UPLOAD");
  if (stored.size !== media.byteLength) return fail("UPLOAD_SIZE_MISMATCH");
  if (stored.size > MEDIA_BYTE_LIMITS[kind]) return fail("MEDIA_TOO_LARGE");
  if (!MEDIA_MIME_TYPES[kind].includes(media.mimeType))
    return fail("UNSUPPORTED_MEDIA_TYPE");
  if (
    media.width !== undefined &&
    media.height !== undefined &&
    media.width * media.height > LIMITS.imageMegapixels * 1_000_000
  )
    return fail("MEDIA_TOO_LARGE");
  const maxMs =
    kind === "audio"
      ? LIMITS.audioSeconds * 1000
      : kind === "video"
        ? LIMITS.videoSeconds * 1000
        : null;
  if (maxMs !== null && (media.durationMs ?? Infinity) > maxMs + 500)
    return fail("MEDIA_TOO_LONG");
  const digest = normalizeSha256(stored.sha256);
  if (!digest) return fail("UPLOAD_DIGEST_UNREADABLE");
  const claimed = await ctx.db
    .query("uploadClaims")
    .withIndex("by_storage", (q) => q.eq("storageId", media.storageId))
    .first();
  if (claimed) return fail("UPLOAD_ALREADY_USED");
  await ctx.db.insert("uploadClaims", {
    storageId: media.storageId,
    ...actor,
    createdAt: Date.now(),
  });
  return digest;
}

async function assetOf(
  ctx: Pick<QueryCtx, "db">,
  versionId: Id<"memoryVersions">,
) {
  return ctx.db
    .query("mediaAssets")
    .withIndex("by_version", (q) => q.eq("versionId", versionId))
    .first();
}

/** Twelve active memories and the collection byte budget (FR-06). */
async function requireCapacity(
  ctx: Pick<QueryCtx, "db">,
  collectionId: Id<"collections">,
  exceptMemoryId: Id<"memories">,
  addedBytes: number,
) {
  const memories = await ctx.db
    .query("memories")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  let count = 0;
  let bytes = addedBytes;
  for (const m of memories) {
    if (m._id === exceptMemoryId || !m.headVersionId) continue;
    count += 1;
    bytes += (await assetOf(ctx, m.headVersionId))?.byteLength ?? 0;
  }
  if (count >= LIMITS.activeMemories) return fail("MEMORY_LIMIT");
  if (bytes > LIMITS.collectionBytes) return fail("COLLECTION_BYTES_LIMIT");
}

/** Appends content, version and media for one change, all idempotent. */
async function appendContentVersion(
  ctx: MutationCtx,
  actor: Actor,
  args: {
    retryKey: string;
    memoryId: Id<"memories">;
    priorVersionId?: Id<"memoryVersions">;
    kind: Kind;
    content: typeof content.type;
    media?: Upload;
    requiredApproverIds: Id<"users">[];
  },
): Promise<Id<"memoryVersions">> {
  requireEnvelope(args.content.envelope);
  const payloadId = await ctx.runMutation(internal.model.media.appendPayload, {
    ...actor,
    retryKey: `${args.retryKey}:content`,
    body: { kind: "inline", ciphertext: args.content.envelope },
    encryptionFormat: DEV_ENVELOPE_FORMAT,
    ciphertextDigest: await sha256Hex(args.content.envelope),
  });
  const versionId = await ctx.runMutation(
    internal.model.memories.appendVersion,
    {
      ...actor,
      retryKey: `${args.retryKey}:version`,
      memoryId: args.memoryId,
      ...(args.priorVersionId ? { priorVersionId: args.priorVersionId } : {}),
      payloadId,
      contentDigest: args.content.contentDigest,
      mediaKind: args.kind,
      requiredApproverIds: args.requiredApproverIds,
    },
  );
  // Everything below commits atomically with the version, so an existing
  // asset means this is a retry of a completed change.
  if (args.kind === "text" || (await assetOf(ctx, versionId))) return versionId;
  let asset: AssetFields;
  if (args.media) {
    const digest = await claimUpload(ctx, actor, args.kind, args.media);
    const mediaPayloadId = await ctx.runMutation(
      internal.model.media.appendPayload,
      {
        ...actor,
        retryKey: `${args.retryKey}:media`,
        body: { kind: "storage", storageId: args.media.storageId },
        encryptionFormat: DEV_ENVELOPE_FORMAT,
        ciphertextDigest: digest,
      },
    );
    asset = assetFields({
      ...args.media,
      payloadId: mediaPayloadId,
      contentDigest: digest,
    });
  } else {
    // A revision that keeps its media re-references the same payload.
    const prior = args.priorVersionId
      ? await assetOf(ctx, args.priorVersionId)
      : null;
    if (!prior) return fail("MEDIA_REQUIRED");
    asset = assetFields(prior);
  }
  await ctx.runMutation(internal.model.media.appendAsset, {
    ...actor,
    retryKey: `${args.retryKey}:asset`,
    versionId,
    ...asset,
  });
  return versionId;
}

/** A fresh, single-use upload URL for an active member. */
export const generateUploadUrl = mutation({
  args: { collectionId: v.id("collections") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const viewer = await requireViewer(ctx);
    await member(ctx, args.collectionId, viewer._id);
    return ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    collectionId: v.id("collections"),
    kind: mediaKind,
    content,
    media: v.optional(upload),
    requiredApproverIds: v.array(v.id("users")),
    retryKey: v.string(),
  },
  returns: v.object({
    memoryId: v.id("memories"),
    versionId: v.id("memoryVersions"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ memoryId: Id<"memories">; versionId: Id<"memoryVersions"> }> => {
    const viewer = await requireViewer(ctx);
    const actor = { collectionId: args.collectionId, actorId: viewer._id };
    if ((args.kind === "text") !== (args.media === undefined))
      return fail(
        args.kind === "text" ? "TEXT_HAS_NO_MEDIA" : "MEDIA_REQUIRED",
      );
    const memoryId = await ctx.runMutation(
      internal.model.memories.createMemory,
      {
        ...actor,
        retryKey: `${args.retryKey}:memory`,
        requestDigest: await commitment(args),
      },
    );
    const memory = await ctx.db.get(memoryId);
    if (memory?.headVersionId)
      return { memoryId, versionId: memory.headVersionId };
    await requireCapacity(
      ctx,
      args.collectionId,
      memoryId,
      args.media?.byteLength ?? 0,
    );
    const versionId = await appendContentVersion(ctx, actor, {
      ...args,
      memoryId,
    });
    return { memoryId, versionId };
  },
});

/** Any content, people or media change is a new version (FR-05). */
export const revise = mutation({
  args: {
    memoryId: v.id("memories"),
    priorVersionId: v.id("memoryVersions"),
    content,
    media: v.optional(upload),
    requiredApproverIds: v.array(v.id("users")),
    retryKey: v.string(),
  },
  returns: v.id("memoryVersions"),
  handler: async (ctx, args): Promise<Id<"memoryVersions">> => {
    const viewer = await requireViewer(ctx);
    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.uploaderId !== viewer._id)
      return fail("NOT_UPLOADER");
    const prior = await ctx.db.get(args.priorVersionId);
    if (!prior || prior.memoryId !== memory._id)
      return fail("WRONG_MEMORY_PREDECESSOR");
    const actor = { collectionId: memory.collectionId, actorId: viewer._id };
    // New media replaces this memory's bytes in the collection budget.
    if (args.media)
      await requireCapacity(
        ctx,
        memory.collectionId,
        memory._id,
        args.media.byteLength,
      );
    return appendContentVersion(ctx, actor, {
      ...args,
      kind: prior.mediaKind,
    });
  },
});

// ---- Reads -----------------------------------------------------------------

async function viewable(ctx: Pick<QueryCtx, "db" | "auth">, memoryId: string) {
  const viewer = await optionalViewer(ctx);
  const id = ctx.db.normalizeId("memories", memoryId);
  const memory = id && (await ctx.db.get(id));
  if (!viewer || !memory || !memory.headVersionId) return null;
  // Drafts are visible only to their uploader, and only while a member.
  if (memory.uploaderId !== viewer._id) return null;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_collection_and_user", (q) =>
      q.eq("collectionId", memory.collectionId).eq("userId", viewer._id),
    )
    .unique();
  if (membership?.status !== "active") return null;
  return { viewer, memory, headVersionId: memory.headVersionId };
}

async function versionView(
  ctx: Pick<QueryCtx, "db">,
  version: Doc<"memoryVersions">,
) {
  const payload = await ctx.db.get(version.payloadId);
  const asset = await assetOf(ctx, version._id);
  return {
    versionId: version._id,
    createdAt: version.createdAt,
    mediaKind: version.mediaKind,
    envelope: payload?.body.kind === "inline" ? payload.body.ciphertext : null,
    requiredApproverIds: version.requiredApproverIds,
    media: asset
      ? {
          mimeType: asset.mimeType,
          byteLength: asset.byteLength,
          ...(asset.width !== undefined ? { width: asset.width } : {}),
          ...(asset.height !== undefined ? { height: asset.height } : {}),
          ...(asset.durationMs !== undefined
            ? { durationMs: asset.durationMs }
            : {}),
        }
      : null,
  };
}

const versionValidator = v.object({
  versionId: v.id("memoryVersions"),
  createdAt: v.number(),
  mediaKind,
  envelope: v.union(v.string(), v.null()),
  requiredApproverIds: v.array(v.id("users")),
  media: v.union(
    v.null(),
    v.object({
      mimeType: v.string(),
      byteLength: v.number(),
      width: v.optional(v.number()),
      height: v.optional(v.number()),
      durationMs: v.optional(v.number()),
    }),
  ),
});

const memoryValidator = v.object({
  memoryId: v.id("memories"),
  collectionId: v.id("collections"),
  uploaderId: v.id("users"),
  createdAt: v.number(),
  versionCount: v.number(),
  head: versionValidator,
});

async function memoryView(
  ctx: Pick<QueryCtx, "db">,
  memory: Doc<"memories">,
  headVersionId: Id<"memoryVersions">,
) {
  const versions = await ctx.db
    .query("memoryVersions")
    .withIndex("by_memory", (q) => q.eq("memoryId", memory._id))
    .collect();
  const head = versions.find((x) => x._id === headVersionId);
  if (!head) return fail("MISSING_HEAD_VERSION");
  return {
    memoryId: memory._id,
    collectionId: memory.collectionId,
    uploaderId: memory.uploaderId,
    createdAt: memory.createdAt,
    versionCount: versions.length,
    head: await versionView(ctx, head),
  };
}

/** Memories in a collection that the caller may see. */
export const list = query({
  args: { collectionId: v.id("collections") },
  returns: v.array(memoryValidator),
  handler: async (ctx, args) => {
    const viewer = await optionalViewer(ctx);
    if (!viewer) return [];
    const memories = await ctx.db
      .query("memories")
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId),
      )
      .collect();
    const visible = await Promise.all(
      memories.map((m) => viewable(ctx, m._id)),
    );
    return Promise.all(
      visible
        .filter((x) => x !== null)
        .map((x) => memoryView(ctx, x.memory, x.headVersionId)),
    );
  },
});

/** One memory with its full linear version history, newest first. */
export const get = query({
  args: { memoryId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      ...memoryValidator.fields,
      versions: v.array(versionValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const found = await viewable(ctx, args.memoryId);
    if (!found) return null;
    const versions = await ctx.db
      .query("memoryVersions")
      .withIndex("by_memory", (q) => q.eq("memoryId", found.memory._id))
      .collect();
    return {
      ...(await memoryView(ctx, found.memory, found.headVersionId)),
      versions: await Promise.all(
        versions.reverse().map((x) => versionView(ctx, x)),
      ),
    };
  },
});

/**
 * A short-lived URL for a version's media, for permitted viewers only. The
 * URL is a bearer capability; anyone holding it can fetch the bytes.
 */
export const mediaUrl = query({
  args: { versionId: v.id("memoryVersions") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const version = await ctx.db.get(args.versionId);
    if (!version) return null;
    if (!(await viewable(ctx, version.memoryId))) return null;
    const asset = await assetOf(ctx, version._id);
    const payload = asset && (await ctx.db.get(asset.payloadId));
    if (payload?.body.kind !== "storage") return null;
    return ctx.storage.getUrl(payload.body.storageId);
  },
});
