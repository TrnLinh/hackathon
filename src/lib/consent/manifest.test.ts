import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  manifestBytes,
  manifestDigest,
  type EditionManifest,
} from "./manifest";

export const manifest: EditionManifest = {
  protocol: "chorus-manifest/v1",
  collectionId: "collection-1",
  plan: {
    id: "plan-1",
    digest: "a".repeat(64),
    schemaVersion: "1",
    componentVersion: "1",
    creationOrigin: {
      kind: "template",
      templateId: "six-page",
      templateVersion: "1",
    },
    revisionOrigin: { kind: "manual" },
  },
  rendererVersion: "renderer-1",
  fontVersions: ["serif-1", "sans-1"],
  sources: [
    {
      versionId: "version-2",
      contentDigest: "b".repeat(64),
      permissionId: "permission-2",
      permissionDigest: "c".repeat(64),
      revision: { authority: "tide", revision: "r2", evidenceId: "evidence-2" },
      influence: "style",
      requiredApprovers: ["issuer|bob"],
    },
    {
      versionId: "version-1",
      contentDigest: "d".repeat(64),
      permissionId: "permission-1",
      permissionDigest: "e".repeat(64),
      revision: { authority: "tide", revision: "r1", evidenceId: "evidence-1" },
      influence: "visible",
      requiredApprovers: ["issuer|alice"],
    },
  ],
  derivatives: [],
  processors: [],
  acceptedText: [
    {
      payloadId: "ciphertext-1",
      digest: "f".repeat(64),
      authorIds: ["issuer|alice"],
      sourceVersionId: "version-1",
      startMs: 100,
      endMs: 500,
    },
  ],
  requiredApprovers: ["issuer|bob", "issuer|alice"],
  recipient: "issuer|editor",
  reviewAudience: ["issuer|bob", "issuer|alice"],
  downloadAudience: ["issuer|alice"],
  distributionScope: "keep-print-forward",
};

describe("canonical edition manifests", () => {
  it("fixes JSON object ordering while preserving ordered content and explicit style dependencies", async () => {
    expect(canonicalJson({ z: [2, 1], a: { z: "é", a: true } })).toBe(
      '{"a":{"a":true,"z":"é"},"z":[2,1]}',
    );
    const reversed = {
      ...manifest,
      sources: [...manifest.sources].reverse(),
      requiredApprovers: [...manifest.requiredApprovers].reverse(),
      fontVersions: [...manifest.fontVersions].reverse(),
    };
    expect(manifestBytes(reversed)).toEqual(manifestBytes(manifest));
    const decoded = JSON.parse(
      new TextDecoder().decode(manifestBytes(manifest)),
    );
    expect(
      decoded.sources.map((s: { influence: string }) => s.influence),
    ).toEqual(["visible", "style"]);
    expect(await manifestDigest(manifest)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retains separate manual and processor permissions for one source version", () => {
    const manual = manifest.sources[1];
    const processor = {
      ...manual,
      permissionId: "processor-permission",
      permissionDigest: "0".repeat(64),
      influence: "style" as const,
    };
    const result = JSON.parse(
      new TextDecoder().decode(
        manifestBytes({
          ...manifest,
          sources: [...manifest.sources, processor],
        }),
      ),
    );
    expect(result.sources).toHaveLength(3);
  });

  it("rejects silently omitted style approvers, unknown fields and malformed commitments", () => {
    expect(() =>
      manifestBytes({ ...manifest, requiredApprovers: ["issuer|alice"] }),
    ).toThrow("full source");
    expect(() =>
      manifestBytes({ ...manifest, editingMode: "template" }),
    ).toThrow("Unknown");
    expect(() =>
      manifestBytes({
        ...manifest,
        sources: [...manifest.sources, manifest.sources[0]],
      }),
    ).toThrow("Duplicate");
    expect(() =>
      manifestBytes({ ...manifest, plan: { ...manifest.plan, digest: "ABC" } }),
    ).toThrow("SHA-256");
    expect(() =>
      manifestBytes({
        ...manifest,
        acceptedText: [{ ...manifest.acceptedText[0], endMs: 50 }],
      }),
    ).toThrow("time range");
  });

  it("binds ordered text and every style, permission, renderer and recipient change", async () => {
    const baseline = await manifestDigest(manifest);
    for (const changed of [
      {
        ...manifest,
        sources: manifest.sources.slice(1),
        requiredApprovers: ["issuer|alice"],
      },
      {
        ...manifest,
        sources: manifest.sources.map((s, i) =>
          i ? s : { ...s, revision: { ...s.revision, revision: "r3" } },
        ),
      },
      { ...manifest, rendererVersion: "renderer-2" },
      { ...manifest, recipient: "issuer|other" },
      {
        ...manifest,
        acceptedText: [{ ...manifest.acceptedText[0], digest: "0".repeat(64) }],
      },
    ])
      expect(await manifestDigest(changed)).not.toBe(baseline);
    const twoTexts = {
      ...manifest,
      acceptedText: [
        manifest.acceptedText[0],
        { ...manifest.acceptedText[0], payloadId: "ciphertext-2" },
      ],
    };
    expect(await manifestDigest(twoTexts)).not.toBe(
      await manifestDigest({
        ...twoTexts,
        acceptedText: [...twoTexts.acceptedText].reverse(),
      }),
    );
  });

  it("rejects missing processor lineage and dangling derivative ancestry", () => {
    expect(() =>
      manifestBytes({
        ...manifest,
        plan: {
          ...manifest.plan,
          creationOrigin: {
            kind: "ai",
            jobId: "missing-job",
            modelVersion: "v1",
          },
        },
      }),
    ).toThrow("processor lineage");
    expect(() =>
      manifestBytes({
        ...manifest,
        derivatives: [
          {
            id: "d1",
            digest: "a".repeat(64),
            sourceVersionId: "version-1",
            transformationVersion: "v1",
            startMs: 0,
            endMs: 10,
            provenance: "local",
            priorDerivativeIds: ["missing-derivative"],
          },
        ],
      }),
    ).toThrow("derivative ancestry");
  });

  it("uses the known SHA-256 of canonical empty JSON and rejects lossy JSON values", async () => {
    const { commitment } = await import("./manifest");
    expect(await commitment({})).toBe(
      "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    );
    for (const value of [
      undefined,
      NaN,
      Infinity,
      new Date(),
      { a: undefined },
      Array(1),
    ])
      expect(() => canonicalJson(value)).toThrow();
  });
});
