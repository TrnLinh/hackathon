import { describe, expect, it } from "vitest";
import {
  bindingBytes,
  bindingTag,
  digest,
  type SourceBinding,
} from "./binding";

const source: SourceBinding = {
  kind: "source",
  collectionId: "collection-a",
  resourceId: "memory-a",
  versionId: "version-1",
  contentDigest: "a".repeat(64),
  permissionRevision: "revision-1",
  requiredApprovers: ["alice", "bob"],
  recipient: "editor",
  audience: ["alice", "bob", "editor"],
  use: { kind: "manual", purpose: "compose" },
};

describe("Chorus authorization commitments", () => {
  it("uses the standard SHA-256 digest of exact bytes", async () => {
    expect(await digest(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("canonicalizes identity sets and ignores object insertion order", async () => {
    expect(await bindingTag(source)).toBe(
      await bindingTag({
        ...source,
        requiredApprovers: ["bob", "alice"],
        audience: ["editor", "bob", "alice"],
      }),
    );
    expect(new TextDecoder().decode(bindingBytes(source))).toContain(
      '"protocol":"chorus-policy-proof/v1"',
    );
  });

  it("changes the commitment for every resource, identity, revision and processor scope change", async () => {
    const original = await bindingTag(source);
    for (const change of [
      { collectionId: "other" },
      { resourceId: "other" },
      { versionId: "other" },
      { contentDigest: "b".repeat(64) },
      { permissionRevision: "revision-2" },
      { requiredApprovers: ["alice", "carol"] },
      { recipient: "processor" },
      { audience: ["alice", "bob"] },
      { use: { kind: "manual" as const, purpose: "review" } },
    ])
      expect(await bindingTag({ ...source, ...change })).not.toBe(original);
    const processor = {
      ...source,
      recipient: "team-vision",
      use: {
        kind: "processor" as const,
        role: "visual-analysis" as const,
        purpose: "style",
        derivativeType: "resized-image",
        inputDigest: "c".repeat(64),
        transformationVersion: "resize-v1",
        retention: "memory-only; no training",
      },
    };
    const tag = await bindingTag(processor);
    expect(tag).not.toBe(original);
    for (const change of [
      { role: "design" as const },
      { purpose: "caption" },
      { derivativeType: "frame" },
      { inputDigest: "d".repeat(64) },
      { transformationVersion: "resize-v2" },
      { retention: "24h" },
    ])
      expect(
        await bindingTag({
          ...processor,
          use: { ...processor.use, ...change },
        }),
      ).not.toBe(tag);
  });

  it("rejects duplicate or empty approvers, malformed digests and ambiguous fields", () => {
    for (const invalid of [
      { ...source, requiredApprovers: ["alice", "alice"] },
      { ...source, requiredApprovers: [] },
      { ...source, audience: [] },
      { ...source, recipient: " " },
      { ...source, contentDigest: "not-a-digest" },
      { ...source, approved: true },
      {
        ...source,
        use: { kind: "manual", purpose: "compose", processor: "hidden" },
      },
      { ...source, kind: "unknown" },
    ])
      expect(() => bindingBytes(invalid)).toThrow();
  });

  it("binds final approval to exact PDF, manifest, source revisions and download audience", async () => {
    const edition = {
      kind: "edition",
      collectionId: "collection-a",
      candidateId: "candidate-1",
      pdfDigest: "a".repeat(64),
      manifestDigest: "b".repeat(64),
      requiredApprovers: ["alice", "bob"],
      recipient: "issuer",
      audience: ["alice", "bob"],
      sourceRevisions: [
        {
          resourceId: "memory-a",
          versionId: "version-1",
          permissionRevision: "revision-1",
        },
      ],
    };
    const tag = await bindingTag(edition);
    for (const change of [
      { candidateId: "candidate-2" },
      { pdfDigest: "c".repeat(64) },
      { manifestDigest: "d".repeat(64) },
      { requiredApprovers: ["alice"] },
      { audience: ["alice"] },
      {
        sourceRevisions: [
          {
            resourceId: "memory-a",
            versionId: "version-1",
            permissionRevision: "revision-2",
          },
        ],
      },
    ])
      expect(await bindingTag({ ...edition, ...change })).not.toBe(tag);
  });
});
