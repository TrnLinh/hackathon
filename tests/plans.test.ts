import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { fixture, get, permissionFixture } from "./model-fixtures";
const appendPlan = makeFunctionReference<"mutation">("model/plans:appendPlan");

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
      schemaVersion: "1",
      componentVersion: "1",
      revisionOrigin: {
        kind: "template",
        templateId: "six-page",
        templateVersion: "1",
      },
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
});
