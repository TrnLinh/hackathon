import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const issuer = "https://identity.example/realms/chorus";

function setup() {
  const t = convexTest(schema, modules);
  const as = (subject: string, name?: string) =>
    t.withIdentity({
      subject,
      issuer,
      tokenIdentifier: `${issuer}|${subject}`,
      ...(name ? { name } : {}),
    });
  return { t, as };
}

afterEach(() => vi.unstubAllEnvs());

describe("users.ensureCurrent", () => {
  it("rejects anonymous callers and client-supplied identities", async () => {
    const { t, as } = setup();
    await expect(t.mutation(api.users.ensureCurrent, {})).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(
      as("alice").mutation(api.users.ensureCurrent, {
        tokenIdentifier: `${issuer}|bob`,
      } as never),
    ).rejects.toThrow();
  });

  it("creates one registry row per verified identity and refreshes the name", async () => {
    const { t, as } = setup();
    expect(await t.query(api.users.viewer, {})).toBeNull();
    const first = await as("alice", "Alice").mutation(
      api.users.ensureCurrent,
      {},
    );
    expect(
      await as("alice", "Alice Ng").mutation(api.users.ensureCurrent, {}),
    ).toBe(first);
    const bob = await as("bob").mutation(api.users.ensureCurrent, {});
    expect(bob).not.toBe(first);
    expect(await as("alice").query(api.users.viewer, {})).toEqual({
      userId: first,
      name: "Alice Ng",
      isOperator: false,
    });
    const row = await t.run((ctx) => ctx.db.get(first));
    expect(row).toMatchObject({
      issuer,
      subject: "alice",
      tokenIdentifier: `${issuer}|alice`,
    });
  });
});

describe("CH-22 AI availability API", () => {
  it("defaults to off and exposes only sanitized fields", async () => {
    const { t } = setup();
    expect(await t.query(api.aiConfig.current, {})).toEqual({
      enabled: false,
      revision: 0,
      changedAt: null,
    });
    expect(await t.query(api.aiConfig.capabilities, {})).toEqual({
      signedIn: false,
      isOperator: false,
      processorsConfigured: false,
    });
    expect(await t.query(api.aiConfig.history, {})).toEqual([]);
  });

  it("lets only an active operator switch AI, with compare-and-set and safe retries", async () => {
    vi.stubEnv("CHORUS_PROCESSOR_CONFIG_REF", "team-inference-v1");
    const { t, as } = setup();
    const avery = as("avery", "Avery Kim");
    const bob = as("bob", "Bob");
    await avery.mutation(api.users.ensureCurrent, {});
    await bob.mutation(api.users.ensureCurrent, {});
    const enable = { enabled: true, expectedRevision: 0, retryKey: "k1" };

    await expect(t.mutation(api.aiConfig.setEnabled, enable)).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(
      as("stranger").mutation(api.aiConfig.setEnabled, enable),
    ).rejects.toThrow("UNREGISTERED_USER");
    await expect(bob.mutation(api.aiConfig.setEnabled, enable)).rejects.toThrow(
      "NOT_OPERATOR",
    );
    await expect(
      bob.mutation(api.aiConfig.setEnabled, {
        ...enable,
        actorId: "forged",
      } as never),
    ).rejects.toThrow();

    await t.mutation(internal.model.operators.grant, {
      tokenIdentifier: `${issuer}|avery`,
    });
    expect(await avery.query(api.aiConfig.capabilities, {})).toEqual({
      signedIn: true,
      isOperator: true,
      processorsConfigured: true,
    });
    const first = await avery.mutation(api.aiConfig.setEnabled, enable);
    expect(await avery.mutation(api.aiConfig.setEnabled, enable)).toBe(first);
    expect(await t.query(api.aiConfig.current, {})).toMatchObject({
      enabled: true,
      revision: 1,
    });
    // The stored reference never reaches the client.
    expect(
      JSON.stringify(await t.query(api.aiConfig.current, {})),
    ).not.toContain("team-inference");
    await expect(
      avery.mutation(api.aiConfig.setEnabled, {
        enabled: false,
        expectedRevision: 0,
        retryKey: "stale",
      }),
    ).rejects.toThrow("STALE_CONFIG_REVISION");
    await avery.mutation(api.aiConfig.setEnabled, {
      enabled: false,
      expectedRevision: 1,
      retryKey: "k2",
    });

    expect(await avery.query(api.aiConfig.history, {})).toMatchObject([
      {
        revision: 2,
        enabled: false,
        changedByYou: true,
        changedByName: "Avery Kim",
      },
      {
        revision: 1,
        enabled: true,
        changedByYou: true,
        changedByName: "Avery Kim",
      },
    ]);
    expect(await bob.query(api.aiConfig.history, {})).toMatchObject([
      { revision: 2, changedByYou: false, changedByName: null },
      { revision: 1, changedByYou: false, changedByName: null },
    ]);

    // A revoked operator can still recover a lost response, but not change AI.
    await t.mutation(internal.model.operators.revoke, {
      tokenIdentifier: `${issuer}|avery`,
    });
    expect(await avery.mutation(api.aiConfig.setEnabled, enable)).toBe(first);
    await expect(
      avery.mutation(api.aiConfig.setEnabled, {
        enabled: true,
        expectedRevision: 2,
        retryKey: "k3",
      }),
    ).rejects.toThrow("NOT_OPERATOR");
    const changes = await t.run((ctx) =>
      ctx.db.query("operatorChanges").collect(),
    );
    expect(changes.map((c) => c.active)).toEqual([true, false]);
  });

  it("refuses to enable without configured processor roles", async () => {
    vi.stubEnv("CHORUS_PROCESSOR_CONFIG_REF", "");
    const { t, as } = setup();
    const avery = as("avery");
    await avery.mutation(api.users.ensureCurrent, {});
    await t.mutation(internal.model.operators.grant, {
      tokenIdentifier: `${issuer}|avery`,
    });
    await expect(
      avery.mutation(api.aiConfig.setEnabled, {
        enabled: true,
        expectedRevision: 0,
        retryKey: "k",
      }),
    ).rejects.toThrow("PROCESSOR_CONFIG_REQUIRED");
  });

  it("only provisions operators for registered identities", async () => {
    const { t } = setup();
    await expect(
      t.mutation(internal.model.operators.grant, {
        tokenIdentifier: `${issuer}|nobody`,
      }),
    ).rejects.toThrow("UNRESOLVED_IDENTITY");
  });
});
