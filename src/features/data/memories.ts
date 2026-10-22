"use client";

import { useConvex, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useMemo, useRef } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { openDevEnvelope, sealDevEnvelope } from "@/lib/consent/dev-envelope";
import {
  MEMORY_CONTENT_SCHEMA,
  memoryContentDigest,
  parseMemoryContent,
  sha256Hex,
  type MediaKind,
  type MemoryContent,
} from "@/lib/memory-content";
import type { MemoryKind } from "@/features/prototype/types";
import { describeError, newRetryKey } from "./backend";

// CH-05: memories on Convex. Replaces addMemory and reviseMemory from the
// prototype store. Images are re-encoded locally (dropping EXIF/GPS and
// applying orientation) before upload. Until CH-02 the content and bytes use
// the labelled dev envelope, which is NOT encryption.

const toBackend: Record<MemoryKind, MediaKind> = {
  photo: "image",
  voice: "audio",
  video: "video",
  text: "text",
};
const toFrontend: Record<MediaKind, MemoryKind> = {
  image: "photo",
  audio: "voice",
  video: "video",
  text: "text",
};

type VersionRow = NonNullable<
  FunctionReturnType<typeof api.memories.get>
>["versions"][number];

export function readVersion(row: VersionRow) {
  const content = row.envelope
    ? parseMemoryContent(openDevEnvelope(row.envelope))
    : null;
  return {
    versionId: row.versionId,
    createdAt: row.createdAt,
    kind: toFrontend[row.mediaKind],
    title: content?.title ?? "Unreadable memory",
    caption: content?.caption ?? "",
    story: content?.story ?? "",
    readable: content !== null,
    requiredApproverIds: row.requiredApproverIds,
    media: row.media,
  };
}
export type MemoryVersionView = ReturnType<typeof readVersion>;

export function useMemories(collectionId: Id<"collections"> | null) {
  const rows = useQuery(
    api.memories.list,
    collectionId ? { collectionId } : "skip",
  );
  return useMemo(
    () =>
      rows?.map((row) => ({
        memoryId: row.memoryId,
        uploaderId: row.uploaderId,
        createdAt: row.createdAt,
        versionCount: row.versionCount,
        head: readVersion(row.head),
      })),
    [rows],
  );
}

export function useMemory(memoryId: string) {
  const row = useQuery(api.memories.get, { memoryId });
  return useMemo(
    () =>
      row && {
        memoryId: row.memoryId,
        collectionId: row.collectionId,
        uploaderId: row.uploaderId,
        versionCount: row.versionCount,
        head: readVersion(row.head),
        versions: row.versions.map(readVersion),
      },
    [row],
  );
}

/** Media URL for a permitted viewer; null when not permitted or absent. */
export function useMediaUrl(versionId: Id<"memoryVersions"> | null) {
  return useQuery(api.memories.mediaUrl, versionId ? { versionId } : "skip");
}

/**
 * Re-encodes an image through a canvas: drops EXIF/GPS and other ancillary
 * metadata and bakes in the EXIF orientation. Audio and video bytes are
 * retained as validated; their container metadata is not stripped yet.
 */
async function sanitizeImage(file: File, mime: string) {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, 0.92),
  );
  if (!blob) throw new Error("IMAGE_SANITIZE_FAILED");
  return { blob, width: canvas.width, height: canvas.height };
}

export type NewMemory = {
  kind: MemoryKind;
  title: string;
  caption: string;
  story: string;
  peopleIds: string[];
  file?: File;
  /** From local validation (validate-media.ts). */
  media?: { mime: string; codec?: string; durationSec?: number };
};

type Prepared = {
  content: { envelope: string; contentDigest: string };
  media?: {
    storageId: Id<"_storage">;
    mimeType: string;
    codec: string;
    byteLength: number;
    width?: number;
    height?: number;
    durationMs?: number;
  };
};

/** Mirrors the store's addMemory and reviseMemory. */
export function useMemoryActions() {
  const convex = useConvex();
  const create = useMutation(api.memories.create);
  const revise = useMutation(api.memories.revise);
  const uploadUrl = useMutation(api.memories.generateUploadUrl);
  // Per intended change: one retry key and, once uploaded, its blob. A retry
  // after a lost response reuses both instead of uploading again.
  const pending = useRef(
    new Map<string, { key: string; prepared?: Prepared }>(),
  );

  const prepare = useCallback(
    async (
      collectionId: Id<"collections">,
      input: NewMemory,
      keepMedia?: MemoryContent["media"],
    ): Promise<Prepared> => {
      const kind = toBackend[input.kind];
      let media: Prepared["media"];
      let contentMedia = keepMedia;
      if (input.file && input.media) {
        const mime = input.media.mime;
        let blob: Blob = input.file;
        let width: number | undefined;
        let height: number | undefined;
        if (kind === "image")
          ({ blob, width, height } = await sanitizeImage(input.file, mime));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const digest = await sha256Hex(bytes);
        const response = await fetch(await uploadUrl({ collectionId }), {
          method: "POST",
          headers: { "Content-Type": mime },
          body: bytes,
        });
        if (!response.ok) throw new Error("UPLOAD_FAILED");
        const { storageId } = (await response.json()) as {
          storageId: Id<"_storage">;
        };
        const durationMs =
          input.media.durationSec !== undefined
            ? Math.round(input.media.durationSec * 1000)
            : undefined;
        media = {
          storageId,
          mimeType: mime,
          codec: input.media.codec ?? mime.split("/")[1],
          byteLength: bytes.byteLength,
          ...(width ? { width, height } : {}),
          ...(durationMs ? { durationMs } : {}),
        };
        contentMedia = {
          digest,
          mimeType: mime,
          byteLength: bytes.byteLength,
          ...(width ? { width, height } : {}),
          ...(durationMs ? { durationMs } : {}),
        };
      }
      const content: MemoryContent = {
        schema: MEMORY_CONTENT_SCHEMA,
        kind,
        title: input.title,
        caption: input.caption,
        story: input.story,
        ...(contentMedia ? { media: contentMedia } : {}),
      };
      return {
        content: {
          envelope: sealDevEnvelope(content),
          contentDigest: await memoryContentDigest(content),
        },
        ...(media ? { media } : {}),
      };
    },
    [uploadUrl],
  );

  const run = useCallback(
    async <T>(
      intent: string,
      build: () => Promise<Prepared>,
      send: (prepared: Prepared, retryKey: string) => Promise<T>,
    ) => {
      let entry = pending.current.get(intent);
      if (!entry) {
        entry = { key: newRetryKey() };
        pending.current.set(intent, entry);
      }
      try {
        entry.prepared ??= await build();
        const result = await send(entry.prepared, entry.key);
        pending.current.delete(intent);
        return { ok: true as const, result };
      } catch (error) {
        return { ok: false as const, reason: describeUploadError(error) };
      }
    },
    [],
  );

  const addMemory = useCallback(
    (collectionId: Id<"collections">, input: NewMemory, intent: string) =>
      run(
        intent,
        () => prepare(collectionId, input),
        (prepared, retryKey) =>
          create({
            collectionId,
            kind: toBackend[input.kind],
            ...prepared,
            requiredApproverIds: input.peopleIds as Id<"users">[],
            retryKey,
          }),
      ),
    [run, prepare, create],
  );

  /** A new version; omit `file` to keep the current media. */
  const reviseMemory = useCallback(
    async (
      memory: {
        memoryId: Id<"memories">;
        collectionId: Id<"collections">;
        head: MemoryVersionView;
      },
      input: NewMemory,
      intent: string,
    ) => {
      const current = await convex.query(api.memories.get, {
        memoryId: memory.memoryId,
      });
      const kept =
        current?.head.envelope &&
        parseMemoryContent(openDevEnvelope(current.head.envelope))?.media;
      return run(
        intent,
        () =>
          prepare(
            memory.collectionId,
            input,
            input.file ? undefined : kept || undefined,
          ),
        (prepared, retryKey) =>
          revise({
            memoryId: memory.memoryId,
            priorVersionId: memory.head.versionId,
            ...prepared,
            requiredApproverIds: input.peopleIds as Id<"users">[],
            retryKey,
          }),
      );
    },
    [convex, run, prepare, revise],
  );

  return useMemo(
    () => ({ addMemory, reviseMemory }),
    [addMemory, reviseMemory],
  );
}

function describeUploadError(error: unknown) {
  if (error instanceof Error && error.message === "UPLOAD_FAILED")
    return "The upload didn’t complete. Nothing was saved; try again.";
  if (error instanceof Error && error.message === "IMAGE_SANITIZE_FAILED")
    return "This image couldn’t be prepared on your device. Try exporting it as JPEG or PNG.";
  return describeError(error);
}
