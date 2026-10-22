"use client";

import { useSyncExternalStore } from "react";
import { usePrototype } from "@/features/prototype/store";

/**
 * Optional real media for the demo. Files live in public/sample-db and are listed
 * in manifest.json (written by `npm run sample-db`). When a memory has a file the
 * UI shows it; otherwise the synthetic placeholder is used.
 */

export type SampleEntry = {
  image?: string;
  video?: string;
  audio?: string;
  poster?: string;
};
type SampleManifest = {
  memories: Record<string, SampleEntry>;
  people: Record<string, string>;
};

const BASE = "/sample-db/";
const EMPTY: SampleManifest = { memories: {}, people: {} };

let manifest: SampleManifest = EMPTY;
let started = false;
const listeners = new Set<() => void>();

const url = (path?: unknown) =>
  typeof path === "string" && path
    ? BASE + path.replace(/^\/+/, "")
    : undefined;

function normalize(raw: unknown): SampleManifest {
  const next: SampleManifest = { memories: {}, people: {} };
  const data = (raw ?? {}) as {
    memories?: Record<string, Record<string, unknown>>;
    people?: Record<string, unknown>;
  };
  for (const [id, entry] of Object.entries(data.memories ?? {})) {
    const e: SampleEntry = {
      image: url(entry?.image),
      video: url(entry?.video),
      audio: url(entry?.audio),
      poster: url(entry?.poster),
    };
    if (e.image || e.video || e.audio || e.poster) next.memories[id] = e;
  }
  for (const [id, path] of Object.entries(data.people ?? {})) {
    const u = url(path);
    if (u) next.people[id] = u;
  }
  return next;
}

function load() {
  if (started || typeof window === "undefined") return;
  started = true;
  fetch(`${BASE}manifest.json`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (json) manifest = normalize(json);
    })
    .catch(() => undefined)
    .finally(() => listeners.forEach((l) => l()));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  load();
  return () => listeners.delete(listener);
}

function useManifest(): SampleManifest {
  return useSyncExternalStore(
    subscribe,
    () => manifest,
    () => EMPTY,
  );
}

/** Real media for one memory, if the demo has any. */
export function useSampleFor(memoryId: string): SampleEntry | undefined {
  return useManifest().memories[memoryId];
}

/** Real profile picture for a demo person, if any. */
export function useSampleAvatar(personId: string): string | undefined {
  return useManifest().people[personId];
}

/**
 * Placeholder art is matched to a memory by its scene label, so a real photo
 * replaces the gradient everywhere the art appears (cards, zine pages, previews).
 */
export function useSceneImage(scene: string): string | undefined {
  const m = useManifest();
  const state = usePrototype();
  if (!Object.keys(m.memories).length) return undefined;
  for (const memory of state.memories) {
    const owns =
      memory.art?.scene === scene ||
      memory.stills?.some((s) => s.art.scene === scene);
    if (!owns) continue;
    const entry = m.memories[memory.id];
    return entry?.image ?? entry?.poster;
  }
  return undefined;
}
