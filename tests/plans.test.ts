import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import {
  appendPlan,
  createJob,
  fixture,
  get,
  jobFixture,
  permissionFixture,
  planVersions,
  setJobState,
  templateOrigin,
} from "./model-fixtures";
const projection = makeFunctionReference<"query">("model/read:projection");

describe("immutable design provenance", () => {
  it("persists template origin and inherits style-only dependencies through manual revisions", async () => {
    const f = await fixture();
    const visible = await permissionFixture(f, "visible");
    const style = await permissionFixture(f, "style");
    const args = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "plan-1",
      payloadId: f.payloadId,
      contentDigest: "d".repeat(64),
      ...planVersions,
      revisionOrigin: templateOrigin,
      sourceUses: [
        { permissionId: visible.permissionId, influence: "visible" },
        { permissionId: style.permissionId, influence: "style" },
      ],
      derivativeIds: [],
      acceptedText: [],
    };
    const firstId = await f.t.mutation(appendPlan, args);
    const first = await f.t.query(get, {
      collectionId: f.collectionId,
      id: firstId,
    });
    expect(
      first.sources.map((s: { influence: string }) => s.influence).sort(),
    ).toEqual(["style", "visible"]);
    const nextId = await f.t.mutation(appendPlan, {
      ...args,
      parentId: firstId,
      retryKey: "plan-2",
      revisionOrigin: { kind: "manual" },
      sourceUses: [],
    });
    const next = await f.t.query(get, {
      collectionId: f.collectionId,
      id: nextId,
    });
    expect(next).toMatchObject({
      creationOrigin: args.revisionOrigin,
      revisionOrigin: { kind: "manual" },
      parentId: firstId,
      sources: first.sources,
    });
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: firstId }),
    ).toEqual(first);
  });

  it("rejects unsupported schema/component versions and unknown templates", async () => {
    const f = await fixture();
    const source = await permissionFixture(f, "versions");
    const args = {
      collectionId: f.collectionId,
      actorId: f.alice,
      retryKey: "plan-versions",
      payloadId: f.payloadId,
      contentDigest: "d".repeat(64),
      ...planVersions,
      revisionOrigin: templateOrigin,
      sourceUses: [{ permissionId: source.permissionId, influence: "visible" }],
      derivativeIds: [],
      acceptedText: [],
    };
    await expect(
      f.t.mutation(appendPlan, { ...args, schemaVersion: "chorus-plan/v0" }),
    ).rejects.toThrow("UNSUPPORTED_SCHEMA_VERSION");
    await expect(
      f.t.mutation(appendPlan, {
        ...args,
        retryKey: "plan-components",
        componentVersion: "chorus-components/v9",
      }),
    ).rejects.toThrow("UNSUPPORTED_COMPONENT_VERSION");
    for (const [key, origin] of [
      ["id", { ...templateOrigin, templateId: "tpl-remote" }],
      ["version", { ...templateOrigin, templateVersion: "9.9" }],
    ] as const)
      await expect(
        f.t.mutation(appendPlan, {
          ...args,
          retryKey: `plan-template-${key}`,
          revisionOrigin: origin,
        }),
      ).rejects.toThrow("UNKNOWN_TEMPLATE");
    expect(await f.t.mutation(appendPlan, args)).toBeTruthy();
  });

  it("derives the projection's editing mode from the revision origin", async () => {
    const f = await fixture();
    const j = await jobFixture(f);
    const jobId = await f.t.mutation(createJob, j.jobArgs);
    for (const status of ["running", "complete"])
      await f.t.mutation(setJobState, {
        collectionId: f.collectionId,
        actorId: f.alice,
        retryKey: status,
        jobId,
        status,
      });
    const source = await permissionFixture(f, "mode");
    const base = {
      collectionId: f.collectionId,
      actorId: f.alice,
      payloadId: f.payloadId,
      contentDigest: "d".repeat(64),
      ...planVersions,
      sourceUses: [],
      derivativeIds: [],
      acceptedText: [],
    };
    const mode = async (target: string) =>
      (await f.t.query(projection, { target })).editingMode;
    const templateId = await f.t.mutation(appendPlan, {
      ...base,
      retryKey: "mode-template",
      revisionOrigin: templateOrigin,
      sourceUses: [{ permissionId: source.permissionId, influence: "visible" }],
    });
    const aiId = await f.t.mutation(appendPlan, {
      ...base,
      retryKey: "mode-ai",
      revisionOrigin: { kind: "ai", jobId, modelVersion: "model-v1" },
    });
    const manualId = await f.t.mutation(appendPlan, {
      ...base,
      retryKey: "mode-manual",
      parentId: aiId,
      revisionOrigin: { kind: "manual" },
    });
    expect(await mode(templateId)).toBe("template");
    expect(await mode(aiId)).toBe("ai");
    // Continue manually edits in the template editor; AI provenance stays.
    expect(await mode(manualId)).toBe("template");
    expect(
      await f.t.query(get, { collectionId: f.collectionId, id: manualId }),
    ).toMatchObject({
      creationOrigin: { kind: "ai", jobId },
      revisionOrigin: { kind: "manual" },
    });
  });
});
