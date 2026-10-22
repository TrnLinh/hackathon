import { LIMITS } from "@/features/prototype/selectors";
import type { MediaInfo, MemoryKind } from "@/features/prototype/types";

// Client-side checks that approximate the SRD media rules (FR-06) for the
// prototype. Signatures are read from file bytes, never trusted from the name
// or browser-reported type. Codec checks use canPlayType as a stand-in for the
// real local decoder, and no sanitization or encryption actually happens here.

type Format = {
  label: string;
  kind: Exclude<MemoryKind, "text">;
  mime: string;
  extensions: string[];
  matches: (bytes: Uint8Array) => boolean;
};

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) =>
  sig.every((b, i) => bytes[offset + i] === b);
const isFtyp = (b: Uint8Array) => startsWith(b, [0x66, 0x74, 0x79, 0x70], 4);
const isWebm = (b: Uint8Array) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]);

const formats: Format[] = [
  {
    label: "JPEG",
    kind: "photo",
    mime: "image/jpeg",
    extensions: ["jpg", "jpeg"],
    matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  },
  {
    label: "PNG",
    kind: "photo",
    mime: "image/png",
    extensions: ["png"],
    matches: (b) =>
      startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    label: "MP3",
    kind: "voice",
    mime: "audio/mpeg",
    extensions: ["mp3"],
    matches: (b) =>
      startsWith(b, [0x49, 0x44, 0x33]) ||
      (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  },
  {
    label: "AAC in M4A",
    kind: "voice",
    mime: "audio/mp4",
    extensions: ["m4a"],
    matches: isFtyp,
  },
  {
    label: "Opus in WebM",
    kind: "voice",
    mime: "audio/webm",
    extensions: ["webm", "weba"],
    matches: isWebm,
  },
  {
    label: "H.264/AAC in MP4",
    kind: "video",
    mime: "video/mp4",
    extensions: ["mp4", "m4v"],
    matches: isFtyp,
  },
  {
    label: "VP8/Opus in WebM",
    kind: "video",
    mime: "video/webm",
    extensions: ["webm"],
    matches: isWebm,
  },
];

export const acceptFor: Record<Exclude<MemoryKind, "text">, string> = {
  photo: ".jpg,.jpeg,.png,image/jpeg,image/png",
  voice: ".mp3,.m4a,.webm,audio/mpeg,audio/mp4,audio/webm",
  video: ".mp4,.m4v,.webm,video/mp4,video/webm",
};

export const formatHelp: Record<Exclude<MemoryKind, "text">, string> = {
  photo: "JPEG or PNG, up to 10 MiB and 24 megapixels.",
  voice: "MP3, AAC in M4A, or Opus in WebM, up to 60 seconds and 10 MiB.",
  video:
    "H.264/AAC in MP4 or VP8/Opus in WebM, up to 30 seconds, 40 MiB, and 1920×1080.",
};

const codecProbe: Record<string, string> = {
  "audio/mpeg": "audio/mpeg",
  "audio/mp4": 'audio/mp4; codecs="mp4a.40.2"',
  "audio/webm": 'audio/webm; codecs="opus"',
  "video/mp4": 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
  "video/webm": 'video/webm; codecs="vp8, opus"',
};

export type MediaCheck = {
  errors: string[];
  media?: MediaInfo;
  format?: string;
};

const MiB = 1024 * 1024;

function readMetadata(
  url: string,
  kind: "image" | "audio" | "video",
): Promise<{ width?: number; height?: number; durationSec?: number } | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 4000);
    const done = (
      v: { width?: number; height?: number; durationSec?: number } | null,
    ) => {
      window.clearTimeout(timer);
      resolve(v);
    };
    if (kind === "image") {
      const img = new Image();
      img.onload = () =>
        done({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => done(null);
      img.src = url;
      return;
    }
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      done({
        durationSec: Number.isFinite(el.duration) ? el.duration : undefined,
        width: el instanceof HTMLVideoElement ? el.videoWidth : undefined,
        height: el instanceof HTMLVideoElement ? el.videoHeight : undefined,
      });
    el.onerror = () => done(null);
    el.src = url;
  });
}

export async function checkMediaFile(
  file: File,
  kind: Exclude<MemoryKind, "text">,
  previewUrl: string,
): Promise<MediaCheck> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const text = new TextDecoder().decode(head).trimStart().toLowerCase();

  if (
    ext === "svg" ||
    file.type === "image/svg+xml" ||
    text.startsWith("<svg") ||
    text.startsWith("<?xml")
  )
    return {
      errors: [
        "SVG files can contain scripts and aren’t accepted. Export the image as JPEG or PNG.",
      ],
    };

  const detected = formats.find((f) => f.kind === kind && f.matches(head));
  if (!detected) {
    const otherKind = formats.find((f) => f.matches(head));
    return {
      errors: [
        otherKind
          ? `This file’s contents look like ${otherKind.label}, which belongs under “${otherKind.kind === "photo" ? "Photo" : otherKind.kind === "voice" ? "Voice note" : "Video"}”. Switch the memory type or pick another file.`
          : `This file isn’t a supported format, whatever its name says. Use ${formatHelp[kind]}`,
      ],
    };
  }
  const errors: string[] = [];
  if (!detected.extensions.includes(ext))
    errors.push(
      `The file is named .${ext || "?"} but its contents are ${detected.label}. Renamed files are rejected; rename it to .${detected.extensions[0]} if that’s intended.`,
    );

  const maxBytes =
    kind === "photo"
      ? LIMITS.imageBytes
      : kind === "voice"
        ? LIMITS.audioBytes
        : LIMITS.videoBytes;
  if (file.size > maxBytes)
    errors.push(
      `The file is ${(file.size / MiB).toFixed(1)} MiB. The limit is ${maxBytes / MiB} MiB. Trim or compress it first.`,
    );

  const probe = codecProbe[detected.mime];
  if (probe && kind !== "photo") {
    const el = document.createElement(kind === "voice" ? "audio" : "video");
    if (!el.canPlayType(probe))
      errors.push(
        `This device can’t safely decode ${detected.label} locally, so it can’t be prepared before encryption. Try another supported format.`,
      );
  }

  const meta = await readMetadata(
    previewUrl,
    kind === "photo" ? "image" : kind === "voice" ? "audio" : "video",
  );
  if (!meta)
    errors.push(
      "The file couldn’t be decoded locally. It may be damaged or use an unsupported codec.",
    );
  else if (kind === "photo" && meta.width && meta.height) {
    const mp = (meta.width * meta.height) / 1_000_000;
    if (mp > LIMITS.imageMegapixels)
      errors.push(
        `The image decodes to ${mp.toFixed(1)} megapixels. The limit is ${LIMITS.imageMegapixels}. Resize it first.`,
      );
  } else if (kind !== "photo" && meta.durationSec !== undefined) {
    const max = kind === "voice" ? LIMITS.audioSeconds : LIMITS.videoSeconds;
    if (meta.durationSec > max)
      errors.push(
        `It’s ${Math.round(meta.durationSec)} seconds long. The limit is ${max} seconds. Trim it first. Chorus never truncates silently.`,
      );
    if (kind === "video" && meta.width && meta.height) {
      const long = Math.max(meta.width, meta.height);
      const short = Math.min(meta.width, meta.height);
      if (long > 1920 || short > 1080)
        errors.push(
          `The video is ${meta.width}×${meta.height}. The limit is 1920×1080 per frame.`,
        );
    }
  }

  return {
    errors,
    format: detected.label,
    media: {
      mime: detected.mime,
      codec: kind === "photo" ? undefined : detected.label,
      sizeBytes: file.size,
      width: meta?.width || undefined,
      height: meta?.height || undefined,
      durationSec: meta?.durationSec ? Math.round(meta.durationSec) : undefined,
      sanitized: true,
    },
  };
}

export type MediaKind = Exclude<MemoryKind, "text">;

/** Everything the universal drop zone accepts. */
export const acceptAny = Object.values(acceptFor).join(",");

export const anyFormatHelp =
  "Photos (JPEG, PNG), voice notes (MP3, M4A, WebM), or short videos (MP4, WebM).";

const isHeif = (b: Uint8Array) => {
  if (!isFtyp(b)) return false;
  const brand = new TextDecoder().decode(b.slice(8, 12));
  return ["heic", "heix", "hevc", "mif1", "msf1", "avif"].includes(brand);
};

function hasVideoTrack(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    const timer = window.setTimeout(() => resolve(false), 4000);
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      window.clearTimeout(timer);
      resolve(el.videoWidth > 0);
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    el.src = url;
  });
}

/**
 * Works out whether a file is a photo, voice note, or video from its bytes,
 * then runs the same checks as a typed upload. MP4 and WebM containers can
 * hold audio only, so those are probed for a video track.
 */
export async function detectAndCheckMediaFile(
  file: File,
  previewUrl: string,
): Promise<MediaCheck & { kind?: MediaKind }> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (isHeif(head))
    return {
      errors: [
        "HEIC and AVIF photos aren’t supported yet. Export the photo as JPEG (on iPhone: Settings › Camera › Formats › Most Compatible) and try again.",
      ],
    };
  const candidates = Array.from(
    new Set(formats.filter((f) => f.matches(head)).map((f) => f.kind)),
  );
  if (candidates.length === 0) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const text = new TextDecoder().decode(head).trimStart().toLowerCase();
    const svg =
      ext === "svg" ||
      file.type === "image/svg+xml" ||
      text.startsWith("<svg") ||
      text.startsWith("<?xml");
    return {
      errors: [
        svg
          ? "SVG files can contain scripts and aren’t accepted. Export the image as JPEG or PNG."
          : `This file isn’t a supported format, whatever its name says. Chorus accepts ${anyFormatHelp.charAt(0).toLowerCase()}${anyFormatHelp.slice(1)}`,
      ],
    };
  }
  let kind: MediaKind = candidates[0];
  if (candidates.length > 1) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    kind =
      ext === "m4a" || ext === "weba" || ext === "mp3"
        ? "voice"
        : (await hasVideoTrack(previewUrl))
          ? "video"
          : "voice";
  }
  return { kind, ...(await checkMediaFile(file, kind, previewUrl)) };
}

/** Deterministic placeholder gradient from a seed string. */
export function artworkFromSeed(seed: string, scene: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return {
    from: `hsl(${hue} 70% 68%)`,
    to: `hsl(${(hue + 50) % 360} 55% 42%)`,
    scene,
  };
}
