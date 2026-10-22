import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  acceptedText,
  ciphertextBody,
  decisionAction,
  lineageInput,
  mediaKind,
  origin,
  processorSpec,
  revision,
  scope,
  sourceDependency,
  workflowTarget,
} from "./model/validators";

const collectionId = v.id("collections");
const record = { collectionId, actorId: v.id("users"), createdAt: v.number() };
const lineage = {
  processingJobIds: v.array(v.id("processingJobs")),
  sources: v.array(sourceDependency),
  derivativeIds: v.array(v.id("derivedArtifacts")),
};

// Internal model only: none of these projections or evidence claims authorize release.
export default defineSchema({
  users: defineTable({
    issuer: v.string(),
    subject: v.string(),
    tokenIdentifier: v.string(),
    // Display name from the verified ID token's claims. Operator-visible
    // routing metadata, refreshed by users.ensureCurrent.
    name: v.optional(v.string()),
  })
    .index("by_identity", ["issuer", "subject"])
    .index("by_token", ["tokenIdentifier"]),
  collections: defineTable({
    ownerId: v.id("users"),
    encryptedMetadata: v.string(),
    status: v.union(v.literal("active"), v.literal("archived")),
    eventSequence: v.number(),
    createdAt: v.number(),
    // Capability to ask to join; admission is still the creator's decision.
    joinCode: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_join_code", ["joinCode"]),
  collectionReceipts: defineTable({
    actorId: v.id("users"),
    retryKey: v.string(),
    inputDigest: v.string(),
    collectionId,
  }).index("by_retry", ["actorId", "retryKey"]),
  memberships: defineTable({
    collectionId,
    userId: v.id("users"),
    role: v.union(v.literal("creator"), v.literal("contributor")),
    status: v.union(
      v.literal("requested"),
      v.literal("active"),
      v.literal("declined"),
      v.literal("removed"),
    ),
    // Set on first admission; a former member keeps evidence/withdraw rights.
    admittedAt: v.optional(v.number()),
  })
    .index("by_collection_and_user", ["collectionId", "userId"])
    .index("by_user", ["userId"]),
  memories: defineTable({
    collectionId,
    uploaderId: v.id("users"),
    createdAt: v.number(),
    // Mutable pointer to the single current version. Versions themselves stay
    // immutable; appends compare-and-set this head so history cannot fork.
    headVersionId: v.optional(v.id("memoryVersions")),
  }).index("by_collection", ["collectionId"]),
  // Each uploaded blob may back at most one payload (CH-05).
  uploadClaims: defineTable({
    storageId: v.id("_storage"),
    collectionId,
    actorId: v.id("users"),
    createdAt: v.number(),
  }).index("by_storage", ["storageId"]),
  privatePayloads: defineTable({
    collectionId,
    body: ciphertextBody,
    encryptionFormat: v.string(),
    ciphertextDigest: v.string(),
    createdAt: v.number(),
  }).index("by_collection", ["collectionId"]),
  memoryVersions: defineTable({
    ...record,
    memoryId: v.id("memories"),
    priorVersionId: v.optional(v.id("memoryVersions")),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    mediaKind,
    requiredApproverIds: v.array(v.id("users")),
  })
    .index("by_memory", ["memoryId"])
    .index("by_collection", ["collectionId"]),
  evidence: defineTable({
    ...record,
    payloadId: v.id("privatePayloads"),
    authority: v.string(),
    format: v.string(),
    statementDigest: v.string(),
    verification: v.literal("unverified"),
  }).index("by_collection", ["collectionId"]),
  compositionPermissions: defineTable({
    ...record,
    versionId: v.id("memoryVersions"),
    scope,
    revision,
    requestDigest: v.string(),
    requiredApproverIds: v.array(v.id("users")),
  })
    .index("by_version", ["versionId"])
    .index("by_collection", ["collectionId"]),
  decisions: defineTable({
    ...record,
    target: v.union(v.id("compositionPermissions"), v.id("candidates")),
    action: decisionAction,
    requestDigest: v.string(),
    revisions: v.array(revision),
    evidenceId: v.id("evidence"),
    privateExplanationId: v.optional(v.id("privatePayloads")),
  })
    .index("by_target", ["target"])
    .index("by_target_and_actor", ["target", "actorId"])
    .index("by_evidence", ["evidenceId"])
    .index("by_collection", ["collectionId"]),
  mediaAssets: defineTable({
    ...record,
    versionId: v.id("memoryVersions"),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    mimeType: v.string(),
    codec: v.string(),
    byteLength: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  }).index("by_version", ["versionId"]),
  processingJobs: defineTable({
    ...record,
    inputs: v.array(lineageInput),
    ...lineage,
    processor: processorSpec,
    modelVersion: v.string(),
    configId: v.id("aiConfigurations"),
    configRevision: v.number(),
    limits: v.object({
      maxInputBytes: v.number(),
      maxOutputBytes: v.number(),
      timeoutMs: v.number(),
    }),
    dispatchIdentityId: v.id("users"),
  })
    .index("by_collection", ["collectionId"])
    .index("by_config", ["configId"]),
  derivedArtifacts: defineTable({
    ...record,
    versionId: v.id("memoryVersions"),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    kind: v.string(),
    transformationVersion: v.string(),
    startMs: v.number(),
    endMs: v.number(),
    jobId: v.optional(v.id("processingJobs")),
    provenance: v.union(v.literal("local"), v.literal("processor")),
    ...lineage,
  })
    .index("by_version", ["versionId"])
    .index("by_collection", ["collectionId"]),
  designPlans: defineTable({
    ...record,
    parentId: v.optional(v.id("designPlans")),
    payloadId: v.id("privatePayloads"),
    contentDigest: v.string(),
    schemaVersion: v.string(),
    componentVersion: v.string(),
    creationOrigin: origin,
    revisionOrigin: origin,
    acceptedText: v.array(acceptedText),
    ...lineage,
  })
    .index("by_collection", ["collectionId"])
    .index("by_parent", ["parentId"]),
  candidates: defineTable({
    ...record,
    planId: v.id("designPlans"),
    pdfPayloadId: v.id("privatePayloads"),
    pdfDigest: v.string(),
    manifestPayloadId: v.id("privatePayloads"),
    manifestDigest: v.string(),
    requestDigest: v.string(),
    requiredApproverIds: v.array(v.id("users")),
    recipientId: v.id("users"),
    reviewAudienceIds: v.array(v.id("users")),
    downloadAudienceIds: v.array(v.id("users")),
    distributionScope: v.string(),
    rendererVersion: v.string(),
    fontVersions: v.array(v.string()),
    ...lineage,
  }).index("by_collection", ["collectionId"]),
  editions: defineTable({
    ...record,
    candidateId: v.id("candidates"),
    requestDigest: v.string(),
    pdfDigest: v.string(),
    manifestDigest: v.string(),
    revisions: v.array(revision),
    issuanceEvidenceId: v.id("evidence"),
    receiptPayloadId: v.id("privatePayloads"),
    downloadAudienceIds: v.array(v.id("users")),
    verification: v.literal("unverified"),
  })
    .index("by_candidate", ["candidateId"])
    .index("by_collection", ["collectionId"]),
  operators: defineTable({ userId: v.id("users"), active: v.boolean() }).index(
    "by_user",
    ["userId"],
  ),
  // Append-only log of operator grants and revocations (admin key only).
  operatorChanges: defineTable({
    userId: v.id("users"),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  configurationReceipts: defineTable({
    actorId: v.id("users"),
    retryKey: v.string(),
    inputDigest: v.string(),
    configId: v.id("aiConfigurations"),
  }).index("by_retry", ["actorId", "retryKey"]),
  aiConfigurations: defineTable({
    actorId: v.id("users"),
    createdAt: v.number(),
    revision: v.number(),
    enabled: v.boolean(),
    processorConfigRef: v.optional(v.string()),
    previousId: v.optional(v.id("aiConfigurations")),
  }).index("by_revision", ["revision"]),
  workflowProjections: defineTable({
    collectionId,
    target: workflowTarget,
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("withdrawn"),
      v.literal("queued"),
      v.literal("running"),
      v.literal("complete"),
      v.literal("invalidated"),
      v.literal("failed"),
    ),
    editingMode: v.optional(v.union(v.literal("template"), v.literal("ai"))),
    invalidationReason: v.optional(
      v.union(
        v.literal("ai-disabled"),
        v.literal("source-withdrawn"),
        v.literal("superseded"),
      ),
    ),
    updatedAt: v.number(),
  })
    .index("by_target", ["target"])
    .index("by_collection", ["collectionId"]),
  auditEvents: defineTable({
    ...record,
    sequence: v.number(),
    operation: v.string(),
    resourceId: v.string(),
    outcome: v.literal("recorded"),
    revision: v.optional(revision),
  }).index("by_collection_order", ["collectionId", "sequence"]),
  mutationReceipts: defineTable({
    ...record,
    operation: v.string(),
    retryKey: v.string(),
    inputDigest: v.string(),
    resultId: v.string(),
  }).index("by_retry", ["collectionId", "actorId", "operation", "retryKey"]),
});
