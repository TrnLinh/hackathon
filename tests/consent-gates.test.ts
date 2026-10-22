import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
  appendDecision,
  appendPlan,
  appendVersion,
  configure,
  createJob,
  createPermission,
  decide,
  fixture,
  get,
  jobFixture,
  permissionFixture,
  planVersions,
  recordEvidence,
  setJobState,
  templateOrigin,
} from "./model-fixtures";

const projection = makeFunctionReference<"query">("model/read:projection");

const templatePlan = (
  f: Awaited<ReturnType<typeof fixture>>,
  permissionId: string,
  retryKey: string,
) => ({
  collectionId: f.collectionId,
  actorId: f.alice,
  retryKey,
  payloadId: f.payloadId,
  contentDigest: "d".repeat(64),
  ...planVersions,
  revisionOrigin: templateOrigin,
  sourceUses: [{ permissionId, influence: "visible" }],
  derivativeIds: [],
  acceptedText: [],
});

describe("consent gates on persistence primitives", () => {
  it("binds decision evidence to one actor, action and use", async () => {
    const f = await fixture();
    const source = await permissionFixture(f, "evidence", "manual", {
      approve: false,
    });
    const record = await f.t.query(get, {
      collectionId: f.collectionId,
      id: source.permissionId,
    });
    await decide(f, source.permissionId, f.bob, "approve", "bob");
    const used = await f.t.query(
      makeFunctionReference<"query">("model/read:history"),
      { collectionId: f.collectionId },
    );
    const bobDecision = used.find(
      (e: { operation: string; actorId: string }) =>
        e.operation === "decision" && e.actorId === f.bob,
    );
    const { evidenceId } = await f.t.query(get, {
      collectionId: f.collectionId,
      id: bobDecision.resourceId,
    });
    await expect(
      f.t.mutation(appendDecision, {
        collectionId: f.collectionId,
        actorId: f.bob,
        retryKey: "reuse",
        target: source.permissionId,
        action: "approve",
        requestDigest: record.requestDigest,
        revisions: [record.revision],
        evidenceId,
      }),
    ).rejects.toThrow("EVIDENCE_ALREADY_USED");
    const aliceEvidence = await f.t.mutation(recordEvidence, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "alice-unbound",
      payloadId: f.payloadId,
      authority: "synthetic-authority",
      format: "synthetic",
      statementDigest: record.requestDigest,
    });
    await expect(
      f.t.mutation(appendDecision, {
        collectionId: f.collectionId,
        actorId: f.alice,
        retryKey: "unbound",
        target: source.permissionId,
        action: "approve",
        requestDigest: record.requestDigest,
        revisions: [record.revision],
        evidenceId: aliceEvidence,
      }),
    ).rejects.toThrow("WRONG_EVIDENCE_COMMITMENT");
  });

  it("tracks permission status from the latest decision of every approver", async () => {
    const f = await fixture();
    const source = await permissionFixture(f, "status", "manual", {
      approve: false,
    });
    const status = async () =>
      (await f.t.query(projection, { target: source.permissionId })).status;
    expect(await status()).toBe("pending");
    await decide(f, source.permissionId, f.alice, "approve", "a1");
    expect(await status()).toBe("pending");
    await decide(f, source.permissionId, f.bob, "approve", "b1");
    expect(await status()).toBe("approved");
    await decide(f, source.permissionId, f.bob, "withdraw", "b2");
    expect(await status()).toBe("withdrawn");
    await decide(f, source.permissionId, f.bob, "approve", "b3");
    expect(await status()).toBe("approved");
  });

  it("refuses pending, declined or withdrawn sources in plans, candidates and jobs", async () => {
    const f = await fixture();
    const pending = await permissionFixture(f, "pending", "manual", {
      approve: false,
    });
    await expect(
      f.t.mutation(appendPlan, templatePlan(f, pending.permissionId, "p1")),
    ).rejects.toThrow("PERMISSION_PENDING");

    const declined = await permissionFixture(f, "declined", "manual", {
      approve: false,
    });
    await decide(f, declined.permissionId, f.alice, "approve", "d-a");
    await decide(f, declined.permissionId, f.bob, "decline", "d-b");
    await expect(
      f.t.mutation(appendPlan, templatePlan(f, declined.permissionId, "p2")),
    ).rejects.toThrow("PERMISSION_DECLINED");

    // A plan built while approved can't be frozen after a withdrawal.
    const visible = await permissionFixture(f, "visible");
    const planId = await f.t.mutation(
      appendPlan,
      templatePlan(f, visible.permissionId, "p3"),
    );
    await decide(f, visible.permissionId, f.bob, "withdraw", "w-b");
    await expect(
      f.t.query(
        makeFunctionReference<"query">("model/candidates:prepareManifest"),
        {
          collectionId: f.collectionId,
          planId,
          rendererVersion: "pdf-v1",
          fontVersions: ["serif-v1"],
          recipientId: f.alice,
          reviewAudienceIds: [f.alice, f.bob],
          downloadAudienceIds: [f.alice],
          distributionScope: "keep-print-forward",
        },
      ),
    ).rejects.toThrow("PERMISSION_WITHDRAWN");

    const j = await jobFixture(f);
    await decide(f, j.permissionId, f.bob, "decline", "job-decline");
    await expect(f.t.mutation(createJob, j.jobArgs)).rejects.toThrow(
      "PERMISSION_DECLINED",
    );
  });

  it("denies dispatch when AI is turned off or a source is withdrawn after admission", async () => {
    const f = await fixture();
    const j = await jobFixture(f);
    const jobId = await f.t.mutation(createJob, j.jobArgs);
    const running = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "running",
      jobId,
      status: "running",
    };
    await decide(f, j.permissionId, f.bob, "withdraw", "withdraw-before");
    await expect(f.t.mutation(setJobState, running)).rejects.toThrow(
      "PERMISSION_WITHDRAWN",
    );
    await decide(f, j.permissionId, f.bob, "approve", "approve-again");
    await f.t.mutation(configure, {
      actorId: f.alice,
      retryKey: "disable",
      expectedRevision: 1,
      enabled: false,
    });
    await expect(f.t.mutation(setJobState, running)).rejects.toThrow(
      "AI_DISABLED",
    );
    // Invalidation stays possible while AI is off.
    await f.t.mutation(setJobState, {
      ...running,
      retryKey: "invalidate",
      status: "invalidated",
      invalidationReason: "ai-disabled",
    });
  });

  it("lets a removed member withdraw and recover a committed decision", async () => {
    const f = await fixture();
    const source = await permissionFixture(f, "removed", "manual", {
      approve: false,
    });
    const approvalId = await decide(
      f,
      source.permissionId,
      f.bob,
      "approve",
      "bob-approve",
    );
    await f.t.run(async (ctx) => {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_collection_and_user", (q) =>
          q.eq("collectionId", f.collectionId).eq("userId", f.bob),
        )
        .unique();
      await ctx.db.patch(membership!._id, { status: "removed" });
    });
    // Retrying the committed approval returns it instead of failing.
    expect(
      await decide(f, source.permissionId, f.bob, "approve", "bob-approve"),
    ).toBe(approvalId);
    // A new approval needs active membership; a withdrawal does not.
    await expect(
      decide(f, source.permissionId, f.bob, "approve", "bob-approve-2"),
    ).rejects.toThrow("NOT_COLLECTION_MEMBER");
    await decide(f, source.permissionId, f.bob, "withdraw", "bob-withdraw");
    expect(
      (await f.t.query(projection, { target: source.permissionId })).status,
    ).toBe("withdrawn");
  });

  it("keeps one linear version history and approves only the current version", async () => {
    const f = await fixture();
    const base = {
      collectionId: f.collectionId,
      actorId: f.alice,
      memoryId: f.memoryId,
      payloadId: f.payloadId,
      contentDigest: "b".repeat(64),
      mediaKind: "text",
      requiredApproverIds: [f.bob],
    };
    const v1 = await f.t.mutation(appendVersion, { ...base, retryKey: "v1" });
    await expect(
      f.t.mutation(appendVersion, { ...base, retryKey: "second-root" }),
    ).rejects.toThrow("STALE_VERSION_HEAD");
    await expect(
      f.t.mutation(appendVersion, {
        ...base,
        retryKey: "kind-change",
        priorVersionId: v1,
        mediaKind: "video",
      }),
    ).rejects.toThrow("MEDIA_KIND_CHANGED");
    const evidenceId = await f.t.mutation(recordEvidence, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "revision-evidence",
      payloadId: f.payloadId,
      authority: "synthetic-authority",
      format: "synthetic",
      statementDigest: "c".repeat(64),
    });
    const permission = {
      collectionId: f.collectionId,
      actorId: f.alice,
      versionId: v1,
      revision: {
        authority: "synthetic-authority",
        revision: "r1",
        evidenceId,
      },
      scope: {
        kind: "manual",
        editorId: f.alice,
        reviewerIds: [f.alice, f.bob],
        purpose: "composition",
      },
    };
    const oldPermission = await f.t.mutation(createPermission, {
      ...permission,
      retryKey: "old-permission",
    });
    const v2 = await f.t.mutation(appendVersion, {
      ...base,
      retryKey: "v2",
      priorVersionId: v1,
      contentDigest: "c".repeat(64),
    });
    await expect(
      f.t.mutation(appendVersion, {
        ...base,
        retryKey: "fork",
        priorVersionId: v1,
      }),
    ).rejects.toThrow("STALE_VERSION_HEAD");
    await expect(
      f.t.mutation(createPermission, { ...permission, retryKey: "stale" }),
    ).rejects.toThrow("SUPERSEDED_VERSION");
    await expect(
      decide(f, oldPermission, f.bob, "approve", "old-approve"),
    ).rejects.toThrow("SUPERSEDED_VERSION");
    await decide(f, oldPermission, f.bob, "decline", "old-decline");
    await f.t.mutation(createPermission, {
      ...permission,
      retryKey: "current",
      versionId: v2,
    });
  });
});
