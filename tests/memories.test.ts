import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";
import { sealDevEnvelope } from "../src/lib/consent/dev-envelope";
import {
  MEMORY_CONTENT_SCHEMA,
  memoryContentDigest,
  sha256Hex,
  type MemoryContent,
} from "../src/lib/memory-content";

const modules = import.meta.glob("../convex/**/*.ts");
const issuer = "https://identity.example/realms/chorus";

async function setup() {
  const t = convexTest(schema, modules);
  const as = (subject: string) =>
    t.withIdentity({
      subject,
      issuer,
      tokenIdentifier: `${issuer}|${subject}`,
      name: subject,
    });
  const [alice, bob, carol] = ["alice", "bob", "carol"].map(as);
  const ids = {
    alice: await alice.mutation(api.users.ensureCurrent, {}),
    bob: await bob.mutation(api.users.ensureCurrent, {}),
    carol: await carol.mutation(api.users.ensureCurrent, {}),
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
  return { t, alice, bob, carol, ids, collectionId };
}

async function text(title: string) {
  const content: MemoryContent = {
    schema: MEMORY_CONTENT_SCHEMA,
    kind: "text",
    title,
    caption: "",
    story: "A private story",
  };
  return {
    envelope: sealDevEnvelope(content),
    contentDigest: await memoryContentDigest(content),
  };
}

async function photo(s: Awaited<ReturnType<typeof setup>>, size = 32) {
  const bytes = new Uint8Array(size).fill(7);
  const storageId = await s.t.run((ctx) =>
    ctx.storage.store(new Blob([bytes], { type: "image/jpeg" })),
  );
  const digest = await sha256Hex(bytes);
  const content: MemoryContent = {
    schema: MEMORY_CONTENT_SCHEMA,
    kind: "image",
    title: "Pier",
    caption: "Sunset",
    story: "",
    media: { digest, mimeType: "image/jpeg", byteLength: size },
  };
  return {
    digest,
    content: {
      envelope: sealDevEnvelope(content),
      contentDigest: await memoryContentDigest(content),
    },
    media: {
      storageId,
      mimeType: "image/jpeg",
      codec: "jpeg",
      byteLength: size,
      width: 4,
      height: 8,
    },
  };
}

beforeEach(() => {
  vi.stubEnv("CHORUS_ALLOW_DEV_ENVELOPE", "1");
  return () => vi.unstubAllEnvs();
});

describe("CH-05 memories", () => {
  it("creates a private text draft visible only to its uploader", async () => {
    const s = await setup();
    const args = {
      collectionId: s.collectionId,
      kind: "text" as const,
      content: await text("Note"),
      requiredApproverIds: [s.ids.bob],
      retryKey: "m1",
    };
    const created = await s.alice.mutation(api.memories.create, args);
    expect(await s.alice.mutation(api.memories.create, args)).toEqual(created);
    await expect(
      s.alice.mutation(api.memories.create, {
        ...args,
        content: await text("Other"),
      }),
    ).rejects.toThrow("RETRY_KEY_REUSED");

    const mine = await s.alice.query(api.memories.list, {
      collectionId: s.collectionId,
    });
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      memoryId: created.memoryId,
      versionCount: 1,
      head: {
        versionId: created.versionId,
        mediaKind: "text",
        envelope: args.content.envelope,
        media: null,
      },
    });
    // The uploader is always a required approver.
    expect([...mine[0].head.requiredApproverIds].sort()).toEqual(
      [s.ids.alice, s.ids.bob].sort(),
    );
    expect(
      await s.bob.query(api.memories.list, { collectionId: s.collectionId }),
    ).toEqual([]);
    expect(
      await s.bob.query(api.memories.get, { memoryId: created.memoryId }),
    ).toBeNull();
    expect(
      await s.carol.query(api.memories.get, { memoryId: created.memoryId }),
    ).toBeNull();
    expect(
      await s.alice.query(api.memories.get, { memoryId: "m-mock" }),
    ).toBeNull();
  });

  it("rejects non-members, unresolved people and disallowed envelopes", async () => {
    const s = await setup();
    const base = {
      collectionId: s.collectionId,
      kind: "text" as const,
      content: await text("Note"),
      requiredApproverIds: [],
    };
    await expect(
      s.carol.mutation(api.memories.create, { ...base, retryKey: "x" }),
    ).rejects.toThrow("NOT_COLLECTION_MEMBER");
    await expect(
      s.alice.mutation(api.memories.create, {
        ...base,
        requiredApproverIds: [s.ids.carol],
        retryKey: "y",
      }),
    ).rejects.toThrow("NOT_COLLECTION_MEMBER");
    await expect(
      s.alice.mutation(api.memories.create, {
        ...base,
        content: { ...base.content, envelope: "plaintext" },
        retryKey: "z",
      }),
    ).rejects.toThrow("UNSUPPORTED_ENVELOPE");
    vi.stubEnv("CHORUS_ALLOW_DEV_ENVELOPE", "");
    await expect(
      s.alice.mutation(api.memories.create, { ...base, retryKey: "w" }),
    ).rejects.toThrow("DEV_ENVELOPE_DISABLED");
  });

  it("binds an uploaded blob once, checks it against storage, and gates its URL", async () => {
    const s = await setup();
    const p = await photo(s);
    const base = {
      collectionId: s.collectionId,
      kind: "image" as const,
      content: p.content,
      requiredApproverIds: [],
    };
    await expect(
      s.alice.mutation(api.memories.create, {
        ...base,
        media: { ...p.media, byteLength: 33 },
        retryKey: "size",
      }),
    ).rejects.toThrow("UPLOAD_SIZE_MISMATCH");
    await expect(
      s.alice.mutation(api.memories.create, {
        ...base,
        media: { ...p.media, mimeType: "image/svg+xml" },
        retryKey: "svg",
      }),
    ).rejects.toThrow("UNSUPPORTED_MEDIA_TYPE");
    await expect(
      s.alice.mutation(api.memories.create, { ...base, retryKey: "none" }),
    ).rejects.toThrow("MEDIA_REQUIRED");

    const args = { ...base, media: p.media, retryKey: "photo" };
    const created = await s.alice.mutation(api.memories.create, args);
    expect(await s.alice.mutation(api.memories.create, args)).toEqual(created);
    await expect(
      s.bob.mutation(api.memories.create, {
        ...base,
        media: p.media,
        retryKey: "steal",
      }),
    ).rejects.toThrow("UPLOAD_ALREADY_USED");

    const [mine] = await s.alice.query(api.memories.list, {
      collectionId: s.collectionId,
    });
    expect(mine.head.media).toMatchObject({
      mimeType: "image/jpeg",
      byteLength: 32,
      width: 4,
      height: 8,
    });
    const asset = await s.t.run((ctx) =>
      ctx.db
        .query("mediaAssets")
        .withIndex("by_version", (q) => q.eq("versionId", created.versionId))
        .unique(),
    );
    // The retained-bytes digest comes from storage, not the client.
    expect(asset?.contentDigest).toBe(p.digest);
    expect(
      await s.alice.query(api.memories.mediaUrl, {
        versionId: created.versionId,
      }),
    ).toEqual(expect.any(String));
    expect(
      await s.bob.query(api.memories.mediaUrl, {
        versionId: created.versionId,
      }),
    ).toBeNull();
  });

  it("revises linearly, keeping or replacing media", async () => {
    const s = await setup();
    const p = await photo(s);
    const first = await s.alice.mutation(api.memories.create, {
      collectionId: s.collectionId,
      kind: "image",
      content: p.content,
      media: p.media,
      requiredApproverIds: [],
      retryKey: "photo",
    });
    const revision = {
      memoryId: first.memoryId,
      priorVersionId: first.versionId,
      content: p.content,
      requiredApproverIds: [s.ids.bob],
      retryKey: "rev",
    };
    await expect(s.bob.mutation(api.memories.revise, revision)).rejects.toThrow(
      "NOT_UPLOADER",
    );
    const second = await s.alice.mutation(api.memories.revise, revision);
    expect(await s.alice.mutation(api.memories.revise, revision)).toBe(second);
    await expect(
      s.alice.mutation(api.memories.revise, { ...revision, retryKey: "fork" }),
    ).rejects.toThrow("STALE_VERSION_HEAD");

    const replacement = await photo(s, 64);
    const third = await s.alice.mutation(api.memories.revise, {
      ...revision,
      priorVersionId: second,
      content: replacement.content,
      media: replacement.media,
      retryKey: "rev2",
    });
    const detail = await s.alice.query(api.memories.get, {
      memoryId: first.memoryId,
    });
    expect(detail?.versionCount).toBe(3);
    expect(detail?.versions.map((x) => x.versionId)).toEqual([
      third,
      second,
      first.versionId,
    ]);
    expect(detail?.versions.map((x) => x.media?.byteLength)).toEqual([
      64, 32, 32,
    ]);
  });

  it("enforces twelve active memories per collection", async () => {
    const s = await setup();
    for (let i = 0; i < 12; i++)
      await s.alice.mutation(api.memories.create, {
        collectionId: s.collectionId,
        kind: "text",
        content: await text(`Note ${i}`),
        requiredApproverIds: [],
        retryKey: `n${i}`,
      });
    await expect(
      s.bob.mutation(api.memories.create, {
        collectionId: s.collectionId,
        kind: "text",
        content: await text("One too many"),
        requiredApproverIds: [],
        retryKey: "n12",
      }),
    ).rejects.toThrow("MEMORY_LIMIT");
  });
});
