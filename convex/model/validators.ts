import { v } from "convex/values";

export const mediaKind = v.union(
  v.literal("image"),
  v.literal("audio"),
  v.literal("video"),
  v.literal("text"),
);
export const influence = v.union(
  v.literal("visible"),
  v.literal("style"),
  v.literal("both"),
);
export const revision = v.object({
  authority: v.string(),
  revision: v.string(),
  evidenceId: v.id("evidence"),
});
export const sourceUse = v.object({
  permissionId: v.id("compositionPermissions"),
  influence,
});
export const sourceDependency = v.object({
  versionId: v.id("memoryVersions"),
  contentDigest: v.string(),
  permissionId: v.id("compositionPermissions"),
  permissionDigest: v.string(),
  revision,
  influence,
  requiredApprovers: v.array(v.string()),
});
export const processorSpec = v.object({
  recipientId: v.id("users"),
  role: v.union(
    v.literal("transcription"),
    v.literal("visual-analysis"),
    v.literal("design"),
  ),
  purpose: v.string(),
  derivativeType: v.string(),
  transformationVersion: v.string(),
  retention: v.string(),
});
export const processor = v.object({
  ...processorSpec.fields,
  inputDigest: v.string(),
});
export const scope = v.union(
  v.object({
    kind: v.literal("manual"),
    editorId: v.id("users"),
    reviewerIds: v.array(v.id("users")),
    purpose: v.string(),
  }),
  v.object({ kind: v.literal("processor"), processor }),
);
export const origin = v.union(
  v.object({
    kind: v.literal("template"),
    templateId: v.string(),
    templateVersion: v.string(),
  }),
  v.object({
    kind: v.literal("ai"),
    jobId: v.id("processingJobs"),
    modelVersion: v.string(),
  }),
  v.object({ kind: v.literal("manual") }),
);
export const acceptedText = v.object({
  payloadId: v.id("privatePayloads"),
  digest: v.string(),
  authorIds: v.array(v.id("users")),
  sourceVersionId: v.optional(v.id("memoryVersions")),
  startMs: v.optional(v.number()),
  endMs: v.optional(v.number()),
});
export const lineageInput = v.union(
  v.object({
    kind: v.literal("source"),
    permissionId: v.id("compositionPermissions"),
  }),
  v.object({
    kind: v.literal("derivative"),
    artifactId: v.id("derivedArtifacts"),
    permissionId: v.id("compositionPermissions"),
  }),
);
export const modelRecordId = v.union(
  v.id("memoryVersions"),
  v.id("compositionPermissions"),
  v.id("decisions"),
  v.id("evidence"),
  v.id("mediaAssets"),
  v.id("processingJobs"),
  v.id("derivedArtifacts"),
  v.id("designPlans"),
  v.id("candidates"),
  v.id("editions"),
  v.id("privatePayloads"),
);
export const workflowTarget = v.union(
  v.id("processingJobs"),
  v.id("designPlans"),
  v.id("candidates"),
  v.id("compositionPermissions"),
);

export const ciphertextBody = v.union(
  v.object({ kind: v.literal("inline"), ciphertext: v.string() }),
  v.object({ kind: v.literal("storage"), storageId: v.id("_storage") }),
);
