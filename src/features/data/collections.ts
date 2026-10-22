"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  openCollectionMetadata,
  sealDevEnvelope,
  type CollectionMetadata,
} from "@/lib/consent/dev-envelope";
import type { Person } from "@/features/prototype/types";
import { attempt, describeError, newRetryKey } from "./backend";

// CH-04: collections and membership on Convex. Replaces createCollection,
// requestJoin, admitMember, declineJoin and removeMember from the prototype
// store. Metadata travels as the labelled dev envelope until CH-02 lands.

export type { CollectionMetadata };

const UNREADABLE: CollectionMetadata = {
  title: "Untitled collection",
  occasion: "This collection’s details couldn’t be read.",
};

export function readMetadata(envelope: string) {
  return openCollectionMetadata(envelope) ?? UNREADABLE;
}

/** Avatar-ready person from a registry entry; hue is stable per user. */
export function toPerson(entry: {
  userId: string;
  name: string | null;
}): Person {
  let hash = 0;
  for (const char of entry.userId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return {
    id: entry.userId,
    name: entry.name ?? "Member",
    hue: Math.abs(hash) % 360,
  };
}

export function useMyCollections() {
  const rows = useQuery(api.collections.listMine);
  return useMemo(
    () =>
      rows?.map((row) =>
        row.status === "active"
          ? { ...row, metadata: readMetadata(row.encryptedMetadata) }
          : row,
      ),
    [rows],
  );
}

/** Undefined while loading; access "none" for non-members and unknown IDs. */
export function useCollection(collectionId: string) {
  const detail = useQuery(api.collections.get, { collectionId });
  return useMemo(
    () =>
      detail?.access === "member"
        ? { ...detail, metadata: readMetadata(detail.encryptedMetadata) }
        : detail,
    [detail],
  );
}

/** Pending join requests; pass null to skip (only creators see them). */
export function useJoinRequests(collectionId: Id<"collections"> | null) {
  return useQuery(
    api.memberships.requests,
    collectionId ? { collectionId } : "skip",
  );
}

export function useJoinPreview(joinCode: string) {
  return useQuery(api.memberships.preview, { joinCode });
}

/** Mirrors the store's collection and membership actions. */
export function useCollectionActions() {
  const create = useMutation(api.collections.create);
  const join = useMutation(api.memberships.requestJoin);
  const admit = useMutation(api.memberships.admit);
  const decline = useMutation(api.memberships.decline);
  const remove = useMutation(api.memberships.remove);

  const createCollection = useCallback(
    async (input: CollectionMetadata) => {
      try {
        const collectionId = await create({
          encryptedMetadata: sealDevEnvelope(input),
          retryKey: newRetryKey(),
        });
        return { ok: true as const, collectionId };
      } catch (error) {
        return { ok: false as const, reason: describeError(error) };
      }
    },
    [create],
  );
  const requestJoin = useCallback(
    (joinCode: string) =>
      attempt(() => join({ joinCode, retryKey: newRetryKey() })),
    [join],
  );
  const decide = useCallback(
    (run: typeof admit) =>
      (collectionId: Id<"collections">, userId: Id<"users">) =>
        attempt(() => run({ collectionId, userId, retryKey: newRetryKey() })),
    [],
  );
  return useMemo(
    () => ({
      createCollection,
      requestJoin,
      admitMember: decide(admit),
      declineJoin: decide(decline),
      removeMember: decide(remove),
    }),
    [createCollection, requestJoin, decide, admit, decline, remove],
  );
}
