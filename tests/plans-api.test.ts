import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { sealDevEnvelope } from "../src/lib/consent/dev-envelope";
import {
  buildTemplatePlan,
  commitPlan,
  templates,
} from "../src/lib/design-plan";
import {
  MEMORY_CONTENT_SCHEMA,
  memoryContentDigest,
  type MemoryContent,
} from "../src/lib/memory-content";

const modules = import.meta.glob("../convex/**/*.ts");
const issuer = "https://identity.example/realms/chorus";
const template = templates[0];

async function setup() {
  const t = convexTest(schema, modules);
  const as = (subject: string) =>
    t.withIdentity({
      subject,
      issuer,
      tokenIdentifier: `${issuer}|${subject}`,
      name: subject,
    });
  const [alice, bob] = ["alice", "bob"].map(as);
  const ids = {
    alice: await alice.mutation(api.users.ensureCurrent, {}),
    bob: await bob.mutation(api.users.ensureCurrent, {}),
  };
  const collectionId = await alice.mutation(api.collections.create, {
    encryptedMetadata: sealDevEnvelope({ title: "T", occasion: "O" }),
    retryKey: "c",
  });
  const detail = await alice.query(api.collections.get, { collectionId });
  if (detail.access !== "member" || !detail.joinCode) throw new Error();
  await bob.mutation(api.memberships.requestJoin, {
    joinCode: detail.joinCode,
    retryKey: "j",
  });
  await alice.mutation(api.memberships.admit, {
    collectionId,
    userId: ids.bob,
    retryKey: "a",
  });
  // Bob's story, with Alice in it, submitted for review.
  const content: MemoryContent = {
    schema: MEMORY_CONTENT_SCHEMA,
    kind: "text",
    title: "Night swim",
    caption: "",
    story: "Into the lake at midnight.",
  };
  const memory = await bob.mutation(api.memories.create, {
    collectionId,
    kind: "text",
    content: {
      envelope: sealDevEnvelope(content),
      contentDigest: await memoryContentDigest(content),
    },
    requiredApproverIds: [ids.alice],
    retryKey: "m",
  });
  const permissionId = await bob.mutation(api.consent.submit, {
    memoryId: memory.memoryId,
    retryKey: "s",
  });
  return { t, alice, bob, ids, collectionId, memory, permissionId };
}

async function templatePlan(versionId: string, creditId: string) {
  const plan = buildTemplatePlan(template.id, {
    title: "Our year",
    occasion: "Farewell",
    visuals: [],
    quotes: [
      {
        value: "Into the lake at midnight.",
        creditId,
        source: { asset: { kind: "version", id: versionId } },
      },
    ],
  });
  const committed = await commitPlan(plan, {
    authorizedAssets: [{ kind: "version", id: versionId }],
    people: [creditId],
    allowEmptySlots: true,
  });
  if (!committed.ok) throw new Error(JSON.stringify(committed.errors));
  return {
    envelope: sealDevEnvelope(committed.plan),
    contentDigest: committed.digest,
  };
}

beforeEach(() => {
  vi.stubEnv("CHORUS_ALLOW_DEV_ENVELOPE", "1");
  return () => vi.unstubAllEnvs();
});

describe("CH-09 plans API", () => {
  it("saves template revisions for the creator from approved sources only", async () => {
    const s = await setup();
    const args = {
      collectionId: s.collectionId,
      plan: await templatePlan(s.memory.versionId, s.ids.bob),
      revisionOrigin: {
        kind: "template" as const,
        templateId: template.id,
        templateVersion: template.version,
      },
      sourceUses: [
        { permissionId: s.permissionId, influence: "visible" as const },
      ],
      retryKey: "p1",
    };
    // Pending consent: nothing may be composed from it yet.
    await expect(s.alice.mutation(api.plans.save, args)).rejects.toThrow(
      "PERMISSION_PENDING",
    );
    for (const [who, key] of [
      [s.alice, "a"],
      [s.bob, "b"],
    ] as const)
      await who.mutation(api.consent.decide, {
        permissionId: s.permissionId,
        action: "approve",
        retryKey: key,
      });
    await expect(s.bob.mutation(api.plans.save, args)).rejects.toThrow(
      "NOT_COLLECTION_CREATOR",
    );
    const planId = await s.alice.mutation(api.plans.save, args);
    expect(await s.alice.mutation(api.plans.save, args)).toBe(planId);
    await expect(
      s.alice.mutation(api.plans.save, {
        ...args,
        revisionOrigin: { kind: "manual" },
      }),
    ).rejects.toThrow("RETRY_KEY_REUSED");
    await expect(
      s.alice.mutation(api.plans.save, {
        ...args,
        revisionOrigin: { ...args.revisionOrigin, templateVersion: "9.9" },
        retryKey: "bad-template",
      }),
    ).rejects.toThrow("UNKNOWN_TEMPLATE");

    const child = await s.alice.mutation(api.plans.save, {
      ...args,
      parentId: planId,
      revisionOrigin: { kind: "manual" },
      retryKey: "p2",
    });
    const list = await s.alice.query(api.plans.list, {
      collectionId: s.collectionId,
    });
    expect(list.map((p) => p.planId)).toEqual([child, planId]);
    expect(list[0]).toMatchObject({
      parentId: planId,
      revisionOrigin: "manual",
      sourceCount: 1,
      usable: true,
      envelope: args.plan.envelope,
    });
    expect(
      await s.bob.query(api.plans.list, { collectionId: s.collectionId }),
    ).toEqual([]);

    // A withdrawal leaves history intact but makes dependent revisions unusable.
    await s.bob.mutation(api.consent.decide, {
      permissionId: s.permissionId,
      action: "withdraw",
      retryKey: "w",
    });
    expect(
      (
        await s.alice.query(api.plans.list, { collectionId: s.collectionId })
      ).map((p) => p.usable),
    ).toEqual([false, false]);
  });

  it("refuses unlabelled bodies", async () => {
    const s = await setup();
    await expect(
      s.alice.mutation(api.plans.save, {
        collectionId: s.collectionId,
        plan: { envelope: "{}", contentDigest: "a".repeat(64) },
        revisionOrigin: { kind: "manual" },
        sourceUses: [],
        retryKey: "x",
      }),
    ).rejects.toThrow("UNSUPPORTED_ENVELOPE");
  });
});
