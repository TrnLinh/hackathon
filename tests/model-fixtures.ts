import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";
import { decisionStatement } from "../src/lib/consent/manifest";

const modules = import.meta.glob("../convex/**/*.ts");
export const appendVersion = makeFunctionReference<"mutation">(
  "model/memories:appendVersion",
);
export const createPermission = makeFunctionReference<"mutation">(
  "model/consent:createPermission",
);
export const recordEvidence = makeFunctionReference<"mutation">(
  "model/consent:recordEvidence",
);
export const get = makeFunctionReference<"query">("model/read:get");
export const appendDecision = makeFunctionReference<"mutation">(
  "model/consent:appendDecision",
);

type Fixture = Awaited<ReturnType<typeof fixture>>;

/**
 * Records one person's decision with evidence bound to that exact decision
 * (chorus-decision/v1), as appendDecision now requires.
 */
export async function decide(
  f: Fixture,
  target: string,
  actorId: string,
  action: "approve" | "decline" | "withdraw",
  key: string,
) {
  const record = await f.t.query(get, {
    collectionId: f.collectionId,
    id: target,
  });
  const revisions =
    "revision" in record
      ? [record.revision]
      : record.sources.map((s: { revision: unknown }) => s.revision);
  const actor = await f.t.run(async (ctx) => ctx.db.get(actorId as never));
  const evidenceId = await f.t.mutation(recordEvidence, {
    collectionId: f.collectionId,
    actorId,
    retryKey: `decision-evidence-${key}`,
    payloadId: f.payloadId,
    authority: "synthetic-authority",
    format: "synthetic",
    statementDigest: await decisionStatement({
      requestDigest: record.requestDigest,
      action,
      actor: (actor as { tokenIdentifier: string }).tokenIdentifier,
      revisions,
    }),
  });
  return f.t.mutation(appendDecision, {
    collectionId: f.collectionId,
    actorId,
    retryKey: `decision-${key}`,
    target,
    action,
    requestDigest: record.requestDigest,
    revisions,
    evidenceId,
  });
}

/** Every required approver approves the target. */
export async function approveAll(f: Fixture, target: string, key: string) {
  const record = await f.t.query(get, {
    collectionId: f.collectionId,
    id: target,
  });
  for (const actorId of record.requiredApproverIds)
    await decide(f, target, actorId, "approve", `${key}-${actorId}`);
}

export async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const alice = await ctx.db.insert("users", {
      issuer: "https://id.example",
      subject: "alice",
      tokenIdentifier: "https://id.example|alice",
    });
    const bob = await ctx.db.insert("users", {
      issuer: "https://id.example",
      subject: "bob",
      tokenIdentifier: "https://id.example|bob",
    });
    const collectionId = await ctx.db.insert("collections", {
      ownerId: alice,
      encryptedMetadata: "synthetic-ciphertext",
      createdAt: 1,
      eventSequence: 0,
      status: "active",
    });
    for (const userId of [alice, bob])
      await ctx.db.insert("memberships", {
        collectionId,
        userId,
        role: userId === alice ? "creator" : "contributor",
        status: "active",
      });
    const memoryId = await ctx.db.insert("memories", {
      collectionId,
      uploaderId: alice,
      createdAt: 1,
    });
    const payloadId = await ctx.db.insert("privatePayloads", {
      collectionId,
      body: { kind: "inline", ciphertext: "synthetic-ciphertext" },
      encryptionFormat: "synthetic-test-envelope",
      ciphertextDigest: "a".repeat(64),
      createdAt: 1,
    });
    return { alice, bob, collectionId, memoryId, payloadId };
  });
  return { t, ...ids };
}

export async function permissionFixture(
  f: Fixture,
  key: string,
  kind: "manual" | "processor" = "manual",
  options: { approve?: boolean } = {},
) {
  // A fresh memory per fixture keeps each version the head of its own history.
  const memoryId = await f.t.run(async (ctx) =>
    ctx.db.insert("memories", {
      collectionId: f.collectionId,
      uploaderId: f.alice,
      createdAt: 1,
    }),
  );
  const versionId = await f.t.mutation(appendVersion, {
    collectionId: f.collectionId,
    actorId: f.alice,
    retryKey: `version-${key}`,
    memoryId,
    payloadId: f.payloadId,
    contentDigest: "b".repeat(64),
    mediaKind: "text",
    requiredApproverIds: [f.bob],
  });
  const evidenceId = await f.t.mutation(recordEvidence, {
    collectionId: f.collectionId,
    actorId: f.alice,
    retryKey: `evidence-${key}`,
    payloadId: f.payloadId,
    authority: "synthetic-authority",
    format: "synthetic",
    statementDigest: "c".repeat(64),
  });
  const processor = {
    recipientId: f.bob,
    role: "design",
    purpose: "style",
    derivativeType: "text",
    inputDigest: "b".repeat(64),
    transformationVersion: "v1",
    retention: "no-retention",
  };
  const permissionId = await f.t.mutation(createPermission, {
    collectionId: f.collectionId,
    actorId: f.alice,
    retryKey: `permission-${key}`,
    versionId,
    revision: { authority: "synthetic-authority", revision: "r1", evidenceId },
    scope:
      kind === "manual"
        ? {
            kind: "manual",
            editorId: f.alice,
            reviewerIds: [f.alice, f.bob],
            purpose: "composition",
          }
        : { kind: "processor", processor },
  });
  if (options.approve ?? true) await approveAll(f, permissionId, key);
  return { versionId, permissionId, processor, memoryId };
}
export const configure = makeFunctionReference<"mutation">(
  "model/configuration:configure",
);
export const createJob = makeFunctionReference<"mutation">(
  "model/jobs:createJob",
);
export const setJobState = makeFunctionReference<"mutation">(
  "model/jobs:setJobState",
);
export const appendPlan = makeFunctionReference<"mutation">(
  "model/plans:appendPlan",
);
export async function jobFixture(f: Awaited<ReturnType<typeof fixture>>) {
  const source = await permissionFixture(f, "ai", "processor");
  await f.t.run(async (ctx) =>
    ctx.db.insert("operators", { userId: f.alice, active: true }),
  );
  const configId = await f.t.mutation(configure, {
    actorId: f.alice,
    retryKey: "enable",
    expectedRevision: 0,
    enabled: true,
    processorConfigRef: "synthetic-service",
  });
  const { inputDigest: _, ...processor } = source.processor;
  void _;
  const jobArgs = {
    collectionId: f.collectionId,
    actorId: f.alice,
    retryKey: "job",
    inputs: [{ kind: "source", permissionId: source.permissionId }],
    processor,
    modelVersion: "model-v1",
    configId,
    configRevision: 1,
    limits: { maxInputBytes: 10000, maxOutputBytes: 10000, timeoutMs: 1000 },
  };
  return { ...source, configId, jobArgs };
}
