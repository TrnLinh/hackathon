import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { sealDevEnvelope } from "../src/lib/consent/dev-envelope";
import { LOCAL_AUTHORITY } from "../src/lib/consent/local-evidence";
import { decisionStatement } from "../src/lib/consent/manifest";
import {
  MEMORY_CONTENT_SCHEMA,
  memoryContentDigest,
  type MemoryContent,
} from "../src/lib/memory-content";

const modules = import.meta.glob("../convex/**/*.ts");
const issuer = "https://identity.example/realms/chorus";

async function content(title: string) {
  const c: MemoryContent = {
    schema: MEMORY_CONTENT_SCHEMA,
    kind: "text",
    title,
    caption: "",
    story: "Story",
  };
  return {
    envelope: sealDevEnvelope(c),
    contentDigest: await memoryContentDigest(c),
  };
}

/** Alice creates the collection (and edits); Bob adds a memory with Carol in it. */
async function setup() {
  const t = convexTest(schema, modules);
  const as = (subject: string) =>
    t.withIdentity({
      subject,
      issuer,
      tokenIdentifier: `${issuer}|${subject}`,
      name: subject,
    });
  const [alice, bob, carol, dan] = ["alice", "bob", "carol", "dan"].map(as);
  const ids = {
    alice: await alice.mutation(api.users.ensureCurrent, {}),
    bob: await bob.mutation(api.users.ensureCurrent, {}),
    carol: await carol.mutation(api.users.ensureCurrent, {}),
    dan: await dan.mutation(api.users.ensureCurrent, {}),
  };
  const collectionId = await alice.mutation(api.collections.create, {
    encryptedMetadata: sealDevEnvelope({ title: "T", occasion: "O" }),
    retryKey: "c",
  });
  const detail = await alice.query(api.collections.get, { collectionId });
  if (detail.access !== "member" || !detail.joinCode) throw new Error();
  for (const [who, id] of [
    [bob, ids.bob],
    [carol, ids.carol],
    [dan, ids.dan],
  ] as const) {
    await who.mutation(api.memberships.requestJoin, {
      joinCode: detail.joinCode,
      retryKey: "j",
    });
    await alice.mutation(api.memberships.admit, {
      collectionId,
      userId: id,
      retryKey: `a-${id}`,
    });
  }
  const memory = await bob.mutation(api.memories.create, {
    collectionId,
    kind: "text",
    content: await content("Pier"),
    requiredApproverIds: [ids.carol],
    retryKey: "m",
  });
  return { t, alice, bob, carol, dan, ids, collectionId, memory };
}

type Setup = Awaited<ReturnType<typeof setup>>;
const row = async (s: Setup, who: Setup["alice"]) =>
  (await who.query(api.memories.list, { collectionId: s.collectionId }))[0];

beforeEach(() => {
  vi.stubEnv("CHORUS_ALLOW_DEV_ENVELOPE", "1");
  return () => vi.unstubAllEnvs();
});

describe("CH-06 local consent", () => {
  it("keeps drafts private until submitted, then grants review to the people in it", async () => {
    const s = await setup();
    for (const who of [s.alice, s.carol, s.dan])
      expect(await row(s, who)).toBeUndefined();
    await expect(
      s.carol.mutation(api.consent.submit, {
        memoryId: s.memory.memoryId,
        retryKey: "s",
      }),
    ).rejects.toThrow("NOT_UPLOADER");
    const permissionId = await s.bob.mutation(api.consent.submit, {
      memoryId: s.memory.memoryId,
      retryKey: "s",
    });
    expect(
      await s.bob.mutation(api.consent.submit, {
        memoryId: s.memory.memoryId,
        retryKey: "s2",
      }),
    ).toBe(permissionId);

    // Carol, in the memory, reviews the exact version; Alice (editor, not in
    // it) and Dan see status only.
    expect(await row(s, s.carol)).toMatchObject({
      access: "full",
      head: { versionId: s.memory.versionId },
      permission: { status: "pending", myAction: null },
    });
    for (const who of [s.alice, s.dan])
      expect(await row(s, who)).toMatchObject({
        access: "status",
        head: null,
        permission: { status: "pending", approvers: null },
      });
    expect(
      await s.dan.query(api.memories.get, { memoryId: s.memory.memoryId }),
    ).toMatchObject({ head: null, versions: [] });
  });

  it("records local, unverified evidence committing to each exact decision", async () => {
    const s = await setup();
    const permissionId = await s.bob.mutation(api.consent.submit, {
      memoryId: s.memory.memoryId,
      retryKey: "s",
    });
    await expect(
      s.dan.mutation(api.consent.decide, {
        permissionId,
        action: "approve",
        retryKey: "d",
      }),
    ).rejects.toThrow("NOT_REQUIRED_APPROVER");

    const approve = {
      permissionId,
      action: "approve" as const,
      retryKey: "c1",
    };
    const decisionId = await s.carol.mutation(api.consent.decide, approve);
    expect(await s.carol.mutation(api.consent.decide, approve)).toBe(
      decisionId,
    );
    const { decision, evidence, permission } = await s.t.run(async (ctx) => {
      const decision = (await ctx.db.get(decisionId))!;
      return {
        decision,
        evidence: (await ctx.db.get(decision.evidenceId))!,
        permission: (await ctx.db.get(permissionId))!,
      };
    });
    expect(evidence).toMatchObject({
      authority: LOCAL_AUTHORITY,
      verification: "unverified",
      actorId: s.ids.carol,
      statementDigest: await decisionStatement({
        requestDigest: permission.requestDigest,
        action: "approve",
        actor: `${issuer}|carol`,
        revisions: [permission.revision],
      }),
    });
    expect(decision.action).toBe("approve");
    // Bob (uploader) still has to approve.
    expect((await row(s, s.carol)).permission?.status).toBe("pending");
    expect((await row(s, s.alice)).access).toBe("status");

    await s.bob.mutation(api.consent.decide, {
      permissionId,
      action: "approve",
      retryKey: "b1",
    });
    expect((await row(s, s.carol)).permission?.status).toBe("approved");
    // Approval releases it to the editor (locally; Tide release is CH-02).
    expect(await row(s, s.alice)).toMatchObject({
      access: "full",
      permission: { status: "approved", verification: "unverified-local" },
    });
    expect((await row(s, s.dan)).access).toBe("status");

    await s.carol.mutation(api.consent.decide, {
      permissionId,
      action: "request-edit",
      retryKey: "c2",
    });
    expect((await row(s, s.bob)).permission).toMatchObject({
      status: "pending",
    });
    expect((await row(s, s.alice)).access).toBe("status");
    await s.carol.mutation(api.consent.decide, {
      permissionId,
      action: "decline",
      retryKey: "c3",
    });
    expect((await row(s, s.bob)).permission?.status).toBe("declined");
    await s.bob.mutation(api.consent.decide, {
      permissionId,
      action: "withdraw",
      retryKey: "b2",
    });
    expect((await row(s, s.bob)).permission?.status).toBe("withdrawn");
  });

  it("lists requests in the inbox and drops them when a new version replaces them", async () => {
    const s = await setup();
    const permissionId = await s.bob.mutation(api.consent.submit, {
      memoryId: s.memory.memoryId,
      retryKey: "s",
    });
    expect(await s.carol.query(api.consent.inbox, {})).toMatchObject([
      {
        memoryId: s.memory.memoryId,
        uploaderName: "bob",
        permission: { permissionId, myAction: null },
      },
    ]);
    expect(await s.dan.query(api.consent.inbox, {})).toEqual([]);
    await s.carol.mutation(api.consent.decide, {
      permissionId,
      action: "request-edit",
      retryKey: "c",
    });
    expect(
      (await s.carol.query(api.consent.inbox, {}))[0].permission.myAction,
    ).toBe("request-edit");

    // The edit is a new version: approvals don't carry over, it's a private
    // draft again, and the old request leaves the inbox.
    await s.bob.mutation(api.memories.revise, {
      memoryId: s.memory.memoryId,
      priorVersionId: s.memory.versionId,
      content: await content("Pier, edited"),
      requiredApproverIds: [s.ids.carol],
      retryKey: "r",
    });
    expect(await s.carol.query(api.consent.inbox, {})).toEqual([]);
    expect(await row(s, s.carol)).toBeUndefined();
    await expect(
      s.carol.mutation(api.consent.decide, {
        permissionId,
        action: "approve",
        retryKey: "late",
      }),
    ).rejects.toThrow("SUPERSEDED_VERSION");
  });
});
