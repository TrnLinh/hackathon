import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import { fixture } from "./model-fixtures";
const current = makeFunctionReference<"query">("model/configuration:current");
const configure = makeFunctionReference<"mutation">(
  "model/configuration:configure",
);

describe("server AI configuration records", () => {
  it("defaults off and appends globally ordered operator-audited revisions with safe retries", async () => {
    const f = await fixture();
    expect(await f.t.query(current, {})).toMatchObject({
      enabled: false,
      revision: 0,
    });
    const args = {
      actorId: f.alice,
      retryKey: "enable",
      expectedRevision: 0,
      enabled: true,
      processorConfigRef: "team-inference-v1",
    };
    await expect(f.t.mutation(configure, args)).rejects.toThrow("NOT_OPERATOR");
    await f.t.run(async (ctx) =>
      ctx.db.insert("operators", { userId: f.alice, active: true }),
    );
    const first = await f.t.mutation(configure, args);
    expect(await f.t.mutation(configure, args)).toBe(first);
    expect(await f.t.query(current, {})).toMatchObject({
      _id: first,
      enabled: true,
      revision: 1,
      actorId: f.alice,
    });
    await expect(
      f.t.mutation(configure, { ...args, retryKey: "stale", enabled: false }),
    ).rejects.toThrow("STALE_CONFIG_REVISION");
    const second = await f.t.mutation(configure, {
      actorId: f.alice,
      retryKey: "disable",
      expectedRevision: 1,
      enabled: false,
    });
    expect(await f.t.query(current, {})).toMatchObject({
      _id: second,
      previousId: first,
      enabled: false,
      revision: 2,
    });
    expect(await f.t.mutation(configure, args)).toBe(first);
  });
});
