import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { fixture, get, permissionFixture } from "./model-fixtures";
const appendAsset = makeFunctionReference<"mutation">(
  "model/media:appendAsset",
);
const appendArtifact = makeFunctionReference<"mutation">(
  "model/media:appendArtifact",
);

describe("encrypted media and derivative metadata", () => {
  it("retains exact source ranges and transitive lineage without storing plaintext on routing records", async () => {
    const f = await fixture();
    const source = await permissionFixture(f, "media");
    const assetId = await f.t.mutation(appendAsset, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "asset",
      versionId: source.versionId,
      payloadId: f.payloadId,
      contentDigest: "b".repeat(64),
      mimeType: "text/plain",
      codec: "utf-8",
      byteLength: 50,
    });
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: assetId }),
    ).toMatchObject({ versionId: source.versionId, payloadId: f.payloadId });
    const args = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "excerpt",
      versionId: source.versionId,
      payloadId: f.payloadId,
      contentDigest: "e".repeat(64),
      kind: "typed-excerpt",
      transformationVersion: "local-v1",
      startMs: 100,
      endMs: 900,
      provenance: "local",
      sourceUses: [{ permissionId: source.permissionId, influence: "visible" }],
      derivativeIds: [],
    };
    const first = await f.t.mutation(appendArtifact, args);
    const next = await f.t.mutation(appendArtifact, {
      ...args,
      retryKey: "corrected-excerpt",
      sourceUses: [],
      derivativeIds: [first],
      contentDigest: "f".repeat(64),
    });
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: next }),
    ).toMatchObject({
      derivativeIds: [first],
      sources: [{ versionId: source.versionId }],
      startMs: 100,
      endMs: 900,
    });
    const record = await f.t.query(get, {
      collectionId: f.collectionId,
      id: first,
    });
    expect(record).not.toHaveProperty("ciphertext");
    expect(record).not.toHaveProperty("text");
    await expect(
      f.t.mutation(appendArtifact, {
        ...args,
        retryKey: "bad-range",
        endMs: 50,
      }),
    ).rejects.toThrow("INVALID_MEDIA_RANGE");
  });
});
