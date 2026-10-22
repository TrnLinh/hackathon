import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
  appendPlan,
  fixture,
  get,
  permissionFixture,
  planVersions,
  recordEvidence,
  templateOrigin,
} from "./model-fixtures";
import { decisionStatement } from "../src/lib/consent/manifest";
const prepareManifest = makeFunctionReference<"query">(
  "model/candidates:prepareManifest",
);
const appendCandidate = makeFunctionReference<"mutation">(
  "model/candidates:appendCandidate",
);
const appendDecision = makeFunctionReference<"mutation">(
  "model/consent:appendDecision",
);
const appendEdition = makeFunctionReference<"mutation">(
  "model/candidates:appendEditionRecord",
);
const history = makeFunctionReference<"query">("model/read:history");

describe("candidate commitments and append-only evidence history", () => {
  it("binds style approvers, exact PDF/manifest and revisions; retries retain one decision and edition record", async () => {
    const f = await fixture();
    const source = await permissionFixture(f, "style-only");
    const planId = await f.t.mutation(appendPlan, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "plan",
      payloadId: f.payloadId,
      contentDigest: "d".repeat(64),
      ...planVersions,
      revisionOrigin: templateOrigin,
      sourceUses: [{ permissionId: source.permissionId, influence: "style" }],
      derivativeIds: [],
      acceptedText: [],
    });
    const manifestArgs = {
      collectionId: f.collectionId,
      planId,
      rendererVersion: "pdf-v1",
      fontVersions: ["serif-v1"],
      recipientId: f.alice,
      reviewAudienceIds: [f.alice, f.bob],
      downloadAudienceIds: [f.alice],
      distributionScope: "keep-print-forward",
    };
    await expect(
      f.t.query(prepareManifest, {
        ...manifestArgs,
        reviewAudienceIds: [f.alice],
      }),
    ).rejects.toThrow("REVIEW_AUDIENCE_MISSING_APPROVER");
    const carol = await f.t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        issuer: "https://id.example",
        subject: "carol",
        tokenIdentifier: "https://id.example|carol",
      });
      await ctx.db.insert("memberships", {
        collectionId: f.collectionId,
        userId,
        role: "contributor",
        status: "active",
      });
      return userId;
    });
    await expect(
      f.t.query(prepareManifest, {
        ...manifestArgs,
        reviewAudienceIds: [f.alice, f.bob, carol],
      }),
    ).rejects.toThrow("REVIEW_SCOPE_WIDENED");
    const prepared = await f.t.query(prepareManifest, manifestArgs);
    expect(prepared.manifest.requiredApprovers.sort()).toEqual([
      "https://id.example|alice",
      "https://id.example|bob",
    ]);
    const args = {
      ...manifestArgs,
      actorId: f.alice,
      retryKey: "freeze",
      pdfPayloadId: f.payloadId,
      pdfDigest: "e".repeat(64),
      manifestPayloadId: f.payloadId,
      manifestDigest: prepared.digest,
    };
    await expect(
      f.t.mutation(appendCandidate, {
        ...args,
        manifestDigest: "0".repeat(64),
      }),
    ).rejects.toThrow("MANIFEST_DIGEST_MISMATCH");
    const candidateId = await f.t.mutation(appendCandidate, args);
    const candidate = await f.t.query(get, {
      collectionId: f.collectionId,
      id: candidateId,
    });
    expect(candidate.requiredApproverIds.sort()).toEqual(
      [f.alice, f.bob].sort(),
    );
    expect(candidate).toMatchObject({
      manifestDigest: prepared.digest,
      pdfDigest: args.pdfDigest,
      sources: [{ influence: "style", versionId: source.versionId }],
    });
    expect(candidate).not.toHaveProperty("manifest");
    const evidenceId = await f.t.mutation(recordEvidence, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "final-evidence",
      payloadId: f.payloadId,
      authority: "synthetic-authority",
      format: "synthetic",
      statementDigest: candidate.requestDigest,
    });
    const revisions = candidate.sources.map(
      (s: { revision: unknown }) => s.revision,
    );
    // Bob's evidence must commit to Bob approving this exact request.
    const bobEvidenceId = await f.t.mutation(recordEvidence, {
      collectionId: f.collectionId,
      actorId: f.bob,
      retryKey: "bob-final-evidence",
      payloadId: f.payloadId,
      authority: "synthetic-authority",
      format: "synthetic",
      statementDigest: await decisionStatement({
        requestDigest: candidate.requestDigest,
        action: "approve",
        actor: "https://id.example|bob",
        revisions,
      }),
    });
    const decisionArgs = {
      collectionId: f.collectionId,
      actorId: f.bob,
      retryKey: "approve",
      target: candidateId,
      action: "approve",
      requestDigest: candidate.requestDigest,
      revisions,
      evidenceId: bobEvidenceId,
    };
    await expect(
      f.t.mutation(appendDecision, {
        ...decisionArgs,
        retryKey: "borrowed-evidence",
        evidenceId,
      }),
    ).rejects.toThrow("WRONG_EVIDENCE_ACTOR");
    await expect(
      f.t.mutation(appendDecision, {
        ...decisionArgs,
        retryKey: "wrong-action",
        action: "withdraw",
      }),
    ).rejects.toThrow("WRONG_EVIDENCE_COMMITMENT");
    await expect(
      f.t.mutation(appendDecision, {
        ...decisionArgs,
        requestDigest: "0".repeat(64),
      }),
    ).rejects.toThrow("STALE_COMMITMENT");
    await expect(
      f.t.mutation(appendDecision, { ...decisionArgs, revisions: [] }),
    ).rejects.toThrow("STALE_REVISION_REFERENCE");
    await expect(
      f.t.mutation(appendDecision, { ...decisionArgs, actorId: carol }),
    ).rejects.toThrow("NOT_REQUIRED_APPROVER");
    const decisionId = await f.t.mutation(appendDecision, decisionArgs);
    expect(await f.t.mutation(appendDecision, decisionArgs)).toBe(decisionId);
    const editionArgs = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "edition-record",
      candidateId,
      requestDigest: candidate.requestDigest,
      issuanceEvidenceId: evidenceId,
      receiptPayloadId: f.payloadId,
    };
    const editionId = await f.t.mutation(appendEdition, editionArgs);
    expect(await f.t.mutation(appendEdition, editionArgs)).toBe(editionId);
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: editionId }),
    ).toMatchObject({
      candidateId,
      pdfDigest: args.pdfDigest,
      manifestDigest: prepared.digest,
      verification: "unverified",
      downloadAudienceIds: [f.alice],
    });
    const events = await f.t.query(history, { collectionId: f.collectionId });
    expect(
      events.filter(
        (e: { operation: string; resourceId: string }) =>
          e.operation === "decision" && e.resourceId === decisionId,
      ),
    ).toHaveLength(1);
    expect(
      events.filter(
        (e: { operation: string }) => e.operation === "edition-record",
      ),
    ).toHaveLength(1);
    expect(events.map((e: { sequence: number }) => e.sequence)).toEqual(
      events.map((_: unknown, i: number) => i + 1),
    );
    const identicalId = await f.t.mutation(appendCandidate, {
      ...args,
      retryKey: "distinct-candidate",
    });
    const identical = await f.t.query(get, {
      collectionId: f.collectionId,
      id: identicalId,
    });
    expect(identical.requestDigest).not.toBe(candidate.requestDigest);
    await expect(
      f.t.mutation(appendDecision, {
        ...decisionArgs,
        retryKey: "same-byte-replay",
        target: identicalId,
      }),
    ).rejects.toThrow("STALE_COMMITMENT");
    const changedId = await f.t.mutation(appendCandidate, {
      ...args,
      retryKey: "refreeze",
      pdfDigest: "f".repeat(64),
    });
    const changed = await f.t.query(get, {
      collectionId: f.collectionId,
      id: changedId,
    });
    expect(changed.requestDigest).not.toBe(candidate.requestDigest);
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: candidateId }),
    ).toEqual(candidate);
    await expect(
      f.t.mutation(appendDecision, {
        ...decisionArgs,
        retryKey: "replay",
        target: changedId,
      }),
    ).rejects.toThrow("STALE_COMMITMENT");
  });
});
