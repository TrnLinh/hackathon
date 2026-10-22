import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import {
  openCollectionMetadata,
  sealDevEnvelope,
} from "../src/lib/consent/dev-envelope";

const modules = import.meta.glob("../convex/**/*.ts");
const issuer = "https://identity.example/realms/chorus";
const metadata = sealDevEnvelope({ title: "First year", occasion: "Farewell" });

async function setup() {
  const t = convexTest(schema, modules);
  const as = (subject: string) =>
    t.withIdentity({
      subject,
      issuer,
      tokenIdentifier: `${issuer}|${subject}`,
      name: subject[0].toUpperCase() + subject.slice(1),
    });
  const alice = as("alice");
  const bob = as("bob");
  const carol = as("carol");
  const ids = {
    alice: await alice.mutation(api.users.ensureCurrent, {}),
    bob: await bob.mutation(api.users.ensureCurrent, {}),
    carol: await carol.mutation(api.users.ensureCurrent, {}),
  };
  return { t, as, alice, bob, carol, ids };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function createWithRequest(s: Setup) {
  const collectionId = await s.alice.mutation(api.collections.create, {
    encryptedMetadata: metadata,
    retryKey: "create",
  });
  const detail = await s.alice.query(api.collections.get, { collectionId });
  if (detail.access !== "member" || !detail.joinCode) throw new Error();
  await s.bob.mutation(api.memberships.requestJoin, {
    joinCode: detail.joinCode.toLowerCase(),
    retryKey: "join",
  });
  return { collectionId, joinCode: detail.joinCode };
}

beforeEach(() => {
  vi.stubEnv("CHORUS_ALLOW_DEV_ENVELOPE", "1");
  return () => vi.unstubAllEnvs();
});

describe("CH-04 collections", () => {
  it("creates a collection with the caller as creator, idempotently", async () => {
    const s = await setup();
    await expect(
      s.t.mutation(api.collections.create, {
        encryptedMetadata: metadata,
        retryKey: "k",
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
    await expect(
      s.as("stranger").mutation(api.collections.create, {
        encryptedMetadata: metadata,
        retryKey: "k",
      }),
    ).rejects.toThrow("UNREGISTERED_USER");
    const args = { encryptedMetadata: metadata, retryKey: "k" };
    const id = await s.alice.mutation(api.collections.create, args);
    expect(await s.alice.mutation(api.collections.create, args)).toBe(id);
    await expect(
      s.alice.mutation(api.collections.create, {
        encryptedMetadata: sealDevEnvelope({ title: "Other", occasion: "" }),
        retryKey: "k",
      }),
    ).rejects.toThrow("RETRY_KEY_REUSED");

    const mine = await s.alice.query(api.collections.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      status: "active",
      collectionId: id,
      role: "creator",
      members: [{ userId: s.ids.alice, name: "Alice" }],
    });
    if (mine[0].status !== "active") throw new Error();
    expect(openCollectionMetadata(mine[0].encryptedMetadata)).toEqual({
      title: "First year",
      occasion: "Farewell",
    });
    expect(await s.bob.query(api.collections.listMine, {})).toEqual([]);
    const history = await s.t.run((ctx) =>
      ctx.db.query("auditEvents").collect(),
    );
    expect(history).toMatchObject([
      { sequence: 1, operation: "collection-create", actorId: s.ids.alice },
    ]);
  });

  it("accepts only the labelled dev envelope, and only when allowed", async () => {
    const s = await setup();
    await expect(
      s.alice.mutation(api.collections.create, {
        encryptedMetadata: JSON.stringify({ title: "Plaintext" }),
        retryKey: "plain",
      }),
    ).rejects.toThrow("UNSUPPORTED_ENVELOPE");
    vi.stubEnv("CHORUS_ALLOW_DEV_ENVELOPE", "");
    await expect(
      s.alice.mutation(api.collections.create, {
        encryptedMetadata: metadata,
        retryKey: "dev",
      }),
    ).rejects.toThrow("DEV_ENVELOPE_DISABLED");
  });

  it("hides collections and join codes from everyone but members and the creator", async () => {
    const s = await setup();
    const { collectionId } = await createWithRequest(s);
    expect(await s.bob.query(api.collections.get, { collectionId })).toEqual({
      access: "requested",
    });
    expect(await s.carol.query(api.collections.get, { collectionId })).toEqual({
      access: "none",
    });
    expect(await s.t.query(api.collections.get, { collectionId })).toEqual({
      access: "none",
    });
    expect(
      await s.alice.query(api.collections.get, { collectionId: "c-mock" }),
    ).toEqual({ access: "none" });
    expect(await s.bob.query(api.collections.listMine, {})).toEqual([
      {
        status: "requested",
        collectionId,
        creator: { userId: s.ids.alice, name: "Alice" },
      },
    ]);
    expect(
      await s.bob.query(api.memberships.requests, { collectionId }),
    ).toEqual([]);

    await s.alice.mutation(api.memberships.admit, {
      collectionId,
      userId: s.ids.bob,
      retryKey: "admit",
    });
    const asBob = await s.bob.query(api.collections.get, { collectionId });
    expect(asBob).toMatchObject({
      access: "member",
      role: "contributor",
      joinCode: null,
    });
    if (asBob.access !== "member") throw new Error();
    expect(asBob.members.map((m) => m.name)).toEqual(["Alice", "Bob"]);
  });
});

describe("CH-04 membership", () => {
  it("lets a signed-in person ask to join with a code, without granting access", async () => {
    const s = await setup();
    const { collectionId, joinCode } = await createWithRequest(s);
    expect(await s.bob.query(api.memberships.preview, { joinCode })).toEqual({
      collectionId,
      creatorName: "Alice",
      memberCount: 1,
      viewerStatus: "requested",
    });
    expect(await s.t.query(api.memberships.preview, { joinCode })).toBeNull();
    expect(
      await s.bob.query(api.memberships.preview, { joinCode: "NOPE-NOPE" }),
    ).toBeNull();
    await expect(
      s.bob.mutation(api.memberships.requestJoin, {
        joinCode: "NOPE-NOPE",
        retryKey: "bad",
      }),
    ).rejects.toThrow("INVALID_JOIN_CODE");
    // Asking again, with the same or a new key, writes nothing.
    const events = () =>
      s.t.run(
        async (ctx) => (await ctx.db.query("auditEvents").collect()).length,
      );
    const before = await events();
    for (const retryKey of ["join", "again"])
      expect(
        await s.bob.mutation(api.memberships.requestJoin, {
          joinCode,
          retryKey,
        }),
      ).toBe(collectionId);
    expect(await events()).toBe(before);
    expect(
      await s.alice.query(api.memberships.requests, { collectionId }),
    ).toEqual([{ userId: s.ids.bob, name: "Bob" }]);
  });

  it("lets only the creator admit, decline and remove", async () => {
    const s = await setup();
    const { collectionId, joinCode } = await createWithRequest(s);
    await s.carol.mutation(api.memberships.requestJoin, {
      joinCode,
      retryKey: "join",
    });
    // A requester is not a member and cannot act on others.
    await expect(
      s.bob.mutation(api.memberships.admit, {
        collectionId,
        userId: s.ids.carol,
        retryKey: "self",
      }),
    ).rejects.toThrow("NOT_COLLECTION_MEMBER");
    await s.alice.mutation(api.memberships.admit, {
      collectionId,
      userId: s.ids.bob,
      retryKey: "admit-bob",
    });
    // An admitted contributor still cannot admit.
    await expect(
      s.bob.mutation(api.memberships.admit, {
        collectionId,
        userId: s.ids.carol,
        retryKey: "bob-admits",
      }),
    ).rejects.toThrow("NOT_COLLECTION_CREATOR");
    await s.alice.mutation(api.memberships.decline, {
      collectionId,
      userId: s.ids.carol,
      retryKey: "decline-carol",
    });
    expect(
      await s.carol.query(api.memberships.preview, { joinCode }),
    ).toMatchObject({ viewerStatus: "declined" });
    await expect(
      s.alice.mutation(api.memberships.admit, {
        collectionId,
        userId: s.ids.carol,
        retryKey: "admit-declined",
      }),
    ).rejects.toThrow("INVALID_MEMBERSHIP_TRANSITION");
    await expect(
      s.alice.mutation(api.memberships.remove, {
        collectionId,
        userId: s.ids.alice,
        retryKey: "remove-self",
      }),
    ).rejects.toThrow("INVALID_MEMBERSHIP_TRANSITION");

    await s.alice.mutation(api.memberships.remove, {
      collectionId,
      userId: s.ids.bob,
      retryKey: "remove-bob",
    });
    expect(await s.bob.query(api.collections.get, { collectionId })).toEqual({
      access: "none",
    });
    expect(await s.bob.query(api.collections.listMine, {})).toEqual([]);
    const ops = await s.t.run(async (ctx) =>
      (await ctx.db.query("auditEvents").collect()).map((e) => e.operation),
    );
    expect(ops).toEqual([
      "collection-create",
      "membership-request",
      "membership-request",
      "membership-admit",
      "membership-decline",
      "membership-remove",
    ]);
  });

  it("gives a never-admitted requester no former-member rights", async () => {
    const s = await setup();
    const { collectionId } = await createWithRequest(s);
    const payloadId = await s.t.run((ctx) =>
      ctx.db.insert("privatePayloads", {
        collectionId,
        body: { kind: "inline", ciphertext: "synthetic" },
        encryptionFormat: "synthetic-test-envelope",
        ciphertextDigest: "a".repeat(64),
        createdAt: 1,
      }),
    );
    const evidence = {
      collectionId,
      actorId: s.ids.bob,
      retryKey: "evidence",
      payloadId,
      authority: "synthetic",
      format: "synthetic",
      statementDigest: "b".repeat(64),
    };
    const recordEvidence = (await import("../convex/_generated/api")).internal
      .model.consent.recordEvidence;
    await expect(s.t.mutation(recordEvidence, evidence)).rejects.toThrow(
      "NOT_COLLECTION_MEMBER",
    );
    // Once admitted and later removed, the person keeps those rights.
    await s.alice.mutation(api.memberships.admit, {
      collectionId,
      userId: s.ids.bob,
      retryKey: "admit",
    });
    await s.alice.mutation(api.memberships.remove, {
      collectionId,
      userId: s.ids.bob,
      retryKey: "remove",
    });
    await expect(s.t.mutation(recordEvidence, evidence)).resolves.toBeTruthy();
  });
});
