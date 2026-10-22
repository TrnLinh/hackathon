import { describe, expect, it } from "vitest";
import {
  appendVersion,
  createPermission,
  fixture,
  get,
  recordEvidence,
} from "./model-fixtures";

describe("immutable collection records", () => {
  it("appends a source revision without changing its predecessor and recovers an accepted retry", async () => {
    const f = await fixture();
    const args = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "upload-1",
      memoryId: f.memoryId,
      payloadId: f.payloadId,
      contentDigest: "b".repeat(64),
      mediaKind: "text",
      requiredApproverIds: [f.bob],
    };
    const first = await f.t.mutation(appendVersion, args);
    expect(await f.t.mutation(appendVersion, args)).toBe(first);
    const original = await f.t.query(get, {
      collectionId: f.collectionId,
      id: first,
    });
    expect(original.requiredApproverIds.sort()).toEqual(
      [f.alice, f.bob].sort(),
    );
    const second = await f.t.mutation(appendVersion, {
      ...args,
      retryKey: "upload-2",
      priorVersionId: first,
      contentDigest: "c".repeat(64),
    });
    expect(second).not.toBe(first);
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: first }),
    ).toEqual(original);
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: second }),
    ).toMatchObject({ priorVersionId: first, contentDigest: "c".repeat(64) });
    await expect(
      f.t.mutation(appendVersion, { ...args, contentDigest: "d".repeat(64) }),
    ).rejects.toThrow("RETRY_KEY_REUSED");
  });
  it("rejects unresolved, duplicate and cross-collection source references", async () => {
    const f = await fixture();
    const args = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "invalid",
      memoryId: f.memoryId,
      payloadId: f.payloadId,
      contentDigest: "b".repeat(64),
      mediaKind: "text",
      requiredApproverIds: [f.bob, f.bob],
    };
    await expect(f.t.mutation(appendVersion, args)).rejects.toThrow(
      "INVALID_APPROVER_SET",
    );
    // A second collection within this deployment, not an ID from another database.
    const foreignPayload = await f.t.run(async (ctx) => {
      const collectionId = await ctx.db.insert("collections", {
        ownerId: f.alice,
        encryptedMetadata: "ciphertext",
        status: "active",
        eventSequence: 0,
        createdAt: 1,
      });
      return ctx.db.insert("privatePayloads", {
        collectionId,
        body: { kind: "inline", ciphertext: "ciphertext" },
        encryptionFormat: "synthetic",
        ciphertextDigest: "a".repeat(64),
        createdAt: 1,
      });
    });
    await expect(
      f.t.mutation(appendVersion, {
        ...args,
        requiredApproverIds: [f.bob],
        payloadId: foreignPayload,
      }),
    ).rejects.toThrow("CROSS_COLLECTION_REFERENCE");
    await f.t.run(async (ctx) => ctx.db.delete(f.bob));
    await expect(
      f.t.mutation(appendVersion, { ...args, requiredApproverIds: [f.bob] }),
    ).rejects.toThrow("UNRESOLVED_IDENTITY");
  });

  it("persists manual and processor scopes independently without transferring them to a new version", async () => {
    const f = await fixture();
    const versionId = await f.t.mutation(appendVersion, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "v1",
      memoryId: f.memoryId,
      payloadId: f.payloadId,
      contentDigest: "b".repeat(64),
      mediaKind: "text",
      requiredApproverIds: [f.bob],
    });
    const evidenceId = await f.t.mutation(recordEvidence, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "e1",
      payloadId: f.payloadId,
      authority: "synthetic-authority",
      format: "synthetic",
      statementDigest: "c".repeat(64),
    });
    const base = {
      collectionId: f.collectionId,
      actorId: f.alice,
      versionId,
      revision: {
        authority: "synthetic-authority",
        revision: "revision-1",
        evidenceId,
      },
    };
    const manualScope = {
      kind: "manual",
      editorId: f.alice,
      reviewerIds: [f.bob, f.alice],
      purpose: "composition",
    };
    const manualId = await f.t.mutation(createPermission, {
      ...base,
      retryKey: "manual",
      scope: manualScope,
    });
    const processorScope = {
      kind: "processor",
      processor: {
        recipientId: f.bob,
        role: "design",
        purpose: "style",
        derivativeType: "text",
        inputDigest: "b".repeat(64),
        transformationVersion: "v1",
        retention: "no-retention",
      },
    };
    const processorId = await f.t.mutation(createPermission, {
      ...base,
      retryKey: "processor",
      scope: processorScope,
    });
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: manualId }),
    ).toMatchObject({
      scope: {
        ...manualScope,
        reviewerIds: [...manualScope.reviewerIds].sort(),
      },
      versionId,
    });
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: processorId }),
    ).toMatchObject({ scope: processorScope, versionId });
    const changed = await f.t.mutation(createPermission, {
      ...base,
      retryKey: "processor-v2",
      scope: {
        ...processorScope,
        processor: { ...processorScope.processor, retention: "24-hours" },
      },
    });
    expect(
      (await f.t.query(get, { collectionId: f.collectionId, id: changed }))
        .requestDigest,
    ).not.toBe(
      (await f.t.query(get, { collectionId: f.collectionId, id: processorId }))
        .requestDigest,
    );
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: processorId }),
    ).toMatchObject({ scope: processorScope });
  });
});
