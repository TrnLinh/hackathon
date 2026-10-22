import { canonicalJson, commitment } from "./consent/manifest";
import { LIMITS } from "./limits";

// CH-05 memory version content. The whole object travels inside a private
// payload envelope; only its digest is a routing record. The media digest binds
// the exact retained (sanitized) bytes into the version commitment.

export const MEMORY_CONTENT_SCHEMA = "chorus-memory/v1";

export type MediaKind = "image" | "audio" | "video" | "text";

export type MemoryMedia = {
  /** SHA-256 hex of the retained bytes. */
  digest: string;
  mimeType: string;
  byteLength: number;
  width?: number;
  height?: number;
  durationMs?: number;
};

export type MemoryContent = {
  schema: typeof MEMORY_CONTENT_SCHEMA;
  kind: MediaKind;
  title: string;
  caption: string;
  story: string;
  media?: MemoryMedia;
};

export const MEDIA_BYTE_LIMITS: Record<Exclude<MediaKind, "text">, number> = {
  image: LIMITS.imageBytes,
  audio: LIMITS.audioBytes,
  video: LIMITS.videoBytes,
};

/** Accepted retained formats; anything else was rejected before upload. */
export const MEDIA_MIME_TYPES: Record<Exclude<MediaKind, "text">, string[]> = {
  image: ["image/jpeg", "image/png"],
  audio: ["audio/mpeg", "audio/mp4", "audio/webm"],
  video: ["video/mp4", "video/webm"],
};

const codePoints = (text: string) => Array.from(text).length;

/** Parses decrypted content; returns null for anything malformed. */
export function parseMemoryContent(value: unknown): MemoryContent | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (
    c.schema !== MEMORY_CONTENT_SCHEMA ||
    !["image", "audio", "video", "text"].includes(c.kind as string) ||
    typeof c.title !== "string" ||
    typeof c.caption !== "string" ||
    typeof c.story !== "string" ||
    codePoints(c.title) > LIMITS.titleChars ||
    codePoints(c.caption) > LIMITS.captionChars ||
    codePoints(c.story) > LIMITS.storyChars
  )
    return null;
  const kind = c.kind as MediaKind;
  if ((kind === "text") !== (c.media === undefined)) return null;
  return {
    schema: MEMORY_CONTENT_SCHEMA,
    kind,
    title: c.title,
    caption: c.caption,
    story: c.story,
    ...(c.media ? { media: c.media as MemoryMedia } : {}),
  };
}

export function memoryContentDigest(content: MemoryContent) {
  return commitment(content);
}

export function canonicalMemoryContent(content: MemoryContent) {
  return canonicalJson(content);
}

export async function sha256Hex(data: Uint8Array<ArrayBuffer> | string) {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Convex storage reports SHA-256 as hex or base64 depending on version. */
export function normalizeSha256(value: string) {
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  try {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    if (bytes.length !== 32) return null;
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
