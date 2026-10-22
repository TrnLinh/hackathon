import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
  appendPlan,
  configure,
  createPermission,
  createJob,
  fixture,
  get,
  jobFixture,
  permissionFixture,
  planVersions,
  approveAll,
  setJobState,
} from "./model-fixtures";

describe("processing lineage and immutable AI plans", () => {
  it("binds jobs to explicit processor grants and rejects manual or substituted scopes", async () => {
    const f = await fixture();
    const j = await jobFixture(f);
    const manual = await permissionFixture(f, "manual");
    await expect(
      f.t.mutation(createJob, {
        ...j.jobArgs,
        inputs: [{ kind: "source", permissionId: manual.permissionId }],
      }),
    ).rejects.toThrow("PROCESSOR_SCOPE_REQUIRED");
    await expect(
      f.t.mutation(createJob, {
        ...j.jobArgs,
        processor: { ...j.jobArgs.processor, retention: "changed" },
      }),
    ).rejects.toThrow("PROCESSOR_SCOPE_MISMATCH");
    const jobId = await f.t.mutation(createJob, j.jobArgs);
    expect(await f.t.mutation(createJob, j.jobArgs)).toBe(jobId);
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: jobId }),
    ).toMatchObject({
      configRevision: 1,
      configId: j.configId,
      sources: [
        {
          versionId: j.versionId,
          permissionId: j.permissionId,
          influence: "style",
        },
      ],
    });
  });

  it("preserves accepted AI provenance across AI-off and rejects late or invalidated results", async () => {
    const f = await fixture();
    const j = await jobFixture(f);
    const jobId = await f.t.mutation(createJob, j.jobArgs);
    const planArgs = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "ai-plan",
      payloadId: f.payloadId,
      contentDigest: "d".repeat(64),
      ...planVersions,
      revisionOrigin: { kind: "ai", jobId, modelVersion: "model-v1" },
      sourceUses: [],
      derivativeIds: [],
      acceptedText: [],
    };
    await expect(f.t.mutation(appendPlan, planArgs)).rejects.toThrow(
      "JOB_NOT_COMPLETE",
    );
    await f.t.mutation(setJobState, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "start",
      jobId,
      status: "running",
    });
    await f.t.mutation(setJobState, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "complete",
      jobId,
      status: "complete",
    });
    const planId = await f.t.mutation(appendPlan, planArgs);
    const original = await f.t.query(get, {
      collectionId: f.collectionId,
      id: planId,
    });
    await f.t.mutation(configure, {
      actorId: f.alice,
      retryKey: "off",
      expectedRevision: 1,
      enabled: false,
    });
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: planId }),
    ).toEqual(original);
    expect(await f.t.mutation(appendPlan, planArgs)).toBe(planId);
    const manualId = await f.t.mutation(appendPlan, {
      ...planArgs,
      parentId: planId,
      retryKey: "manual-plan",
      revisionOrigin: { kind: "manual" },
    });
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: manualId }),
    ).toMatchObject({
      creationOrigin: planArgs.revisionOrigin,
      sources: original.sources,
    });
    await expect(
      f.t.mutation(appendPlan, { ...planArgs, retryKey: "late-result" }),
    ).rejects.toThrow("STALE_JOB_CONFIGURATION");
    await f.t.mutation(setJobState, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "invalidate",
      jobId,
      status: "invalidated",
      invalidationReason: "ai-disabled",
    });
    await expect(
      f.t.mutation(setJobState, {
        collectionId: f.collectionId,
        actorId: f.alice,
        retryKey: "revive",
        jobId,
        status: "running",
      }),
    ).rejects.toThrow("INVALID_JOB_TRANSITION");
    await expect(
      f.t.mutation(createJob, { ...j.jobArgs, retryKey: "new-job" }),
    ).rejects.toThrow("AI_DISABLED");
  });
  it("requires fresh processor scope for every source carried by a composite derivative", async () => {
    const f = await fixture();
    const j = await jobFixture(f);
    const first = await permissionFixture(f, "composite-first");
    const second = await permissionFixture(f, "composite-second");
    const artifactId = await f.t.mutation(
      makeFunctionReference<"mutation">("model/media:appendArtifact"),
      {
        collectionId: f.collectionId,
        actorId: f.alice,
        retryKey: "composite-artifact",
        versionId: first.versionId,
        payloadId: f.payloadId,
        contentDigest: "e".repeat(64),
        kind: "visual-summary",
        transformationVersion: "local-v1",
        startMs: 0,
        endMs: 1000,
        provenance: "local",
        sourceUses: [
          { permissionId: first.permissionId, influence: "visible" },
          { permissionId: second.permissionId, influence: "style" },
        ],
        derivativeIds: [],
      },
    );
    const originalGrant = await f.t.query(get, {
      collectionId: f.collectionId,
      id: first.permissionId,
    });
    const grant = async (versionId: string, retryKey: string) => {
      const id = await f.t.mutation(createPermission, {
        collectionId: f.collectionId,
        actorId: f.alice,
        retryKey,
        versionId,
        revision: originalGrant.revision,
        scope: {
          kind: "processor",
          processor: {
            ...j.processor,
            derivativeType: "visual-summary",
            inputDigest: "e".repeat(64),
          },
        },
      });
      await approveAll(f, id, retryKey);
      return id;
    };
    const primaryId = await grant(first.versionId, "primary-processor");
    const jobArgs = {
      ...j.jobArgs,
      retryKey: "composite-job",
      processor: { ...j.jobArgs.processor, derivativeType: "visual-summary" },
      inputs: [{ kind: "derivative", artifactId, permissionId: primaryId }],
    };
    await expect(f.t.mutation(createJob, jobArgs)).rejects.toThrow(
      "INCOMPLETE_PROCESSOR_LINEAGE",
    );
    const additionalId = await grant(second.versionId, "additional-processor");
    const jobId = await f.t.mutation(createJob, {
      ...jobArgs,
      inputs: [
        { ...jobArgs.inputs[0], additionalPermissionIds: [additionalId] },
      ],
    });
    const job = await f.t.query(get, {
      collectionId: f.collectionId,
      id: jobId,
    });
    expect(
      job.sources.map(
        (source: { permissionId: string }) => source.permissionId,
      ),
    ).toEqual(
      expect.arrayContaining([
        first.permissionId,
        second.permissionId,
        primaryId,
        additionalId,
      ]),
    );
  });

  it("freezes processor/model and timestamp provenance even after switching to manual editing or AI-off", async () => {
    const f = await fixture();
    const j = await jobFixture(f);
    const jobId = await f.t.mutation(createJob, j.jobArgs);
    await f.t.mutation(setJobState, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "running",
      jobId,
      status: "running",
    });
    await f.t.mutation(setJobState, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "done",
      jobId,
      status: "complete",
    });
    const permission = await f.t.query(get, {
      collectionId: f.collectionId,
      id: j.permissionId,
    });
    const manualId = await f.t.mutation(createPermission, {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "manual-scope",
      versionId: j.versionId,
      revision: permission.revision,
      scope: {
        kind: "manual",
        editorId: f.alice,
        reviewerIds: [f.alice, f.bob],
        purpose: "composition",
      },
    });
    await approveAll(f, manualId, "manual-scope");
    const artifactId = await f.t.mutation(
      makeFunctionReference<"mutation">("model/media:appendArtifact"),
      {
        collectionId: f.collectionId,
        actorId: f.alice,
        retryKey: "artifact",
        versionId: j.versionId,
        payloadId: f.payloadId,
        contentDigest: "e".repeat(64),
        kind: "visual-summary",
        transformationVersion: "v1",
        startMs: 0,
        endMs: 1000,
        provenance: "processor",
        jobId,
        sourceUses: [],
        derivativeIds: [],
      },
    );
    const planArgs = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "plan-provenance",
      payloadId: f.payloadId,
      contentDigest: "d".repeat(64),
      ...planVersions,
      revisionOrigin: { kind: "ai", jobId, modelVersion: "model-v1" },
      sourceUses: [{ permissionId: manualId, influence: "visible" }],
      derivativeIds: [artifactId],
      acceptedText: [],
    };
    const parentId = await f.t.mutation(appendPlan, planArgs);
    const planId = await f.t.mutation(appendPlan, {
      ...planArgs,
      retryKey: "manual-provenance",
      parentId,
      revisionOrigin: { kind: "manual" },
      derivativeIds: [],
      sourceUses: [],
    });
    const args = {
      collectionId: f.collectionId,
      planId,
      rendererVersion: "pdf-v1",
      fontVersions: ["serif-v1"],
      recipientId: f.alice,
      reviewAudienceIds: [f.alice, f.bob],
      downloadAudienceIds: [f.alice],
      distributionScope: "keep-print-forward",
    };
    const prepare = makeFunctionReference<"query">(
      "model/candidates:prepareManifest",
    );
    const before = await f.t.query(prepare, args);
    expect(before.manifest.processors).toMatchObject([
      {
        jobId,
        modelVersion: "model-v1",
        recipient: "https://id.example|bob",
        configRevision: 1,
      },
    ]);
    expect(before.manifest.derivatives).toMatchObject([
      {
        id: artifactId,
        sourceVersionId: j.versionId,
        startMs: 0,
        endMs: 1000,
        jobId,
      },
    ]);
    expect(before.manifest.sources).toHaveLength(2);
    expect(before.manifest.plan).toMatchObject({
      creationOrigin: { kind: "ai", jobId },
      revisionOrigin: { kind: "manual" },
      parentId,
    });
    await f.t.mutation(configure, {
      actorId: f.alice,
      retryKey: "disable-provenance",
      expectedRevision: 1,
      enabled: false,
    });
    expect(await f.t.query(prepare, args)).toEqual(before);
  });
});
