import type { BodyFont, HeadingFont } from "../../design-plan/schema";
import { RenderError } from "../errors";
import catalog from "./fonts.json";

// Pinned OFL fonts for chorus-components/v1. The bytes live in generated
// base64 modules (scripts/vendor-fonts.mjs) so rendering never fetches or
// reads files; each font is checked against its pinned SHA-256 before use.

export type FontId =
  | "crimson-text-regular"
  | "crimson-text-italic"
  | "crimson-text-semibold"
  | "patrick-hand-regular"
  | "barlow-condensed-extrabold"
  | "barlow-condensed-medium"
  | "barlow-regular"
  | "barlow-italic"
  | "ibm-plex-mono-semibold";

export type PinnedFont = {
  id: FontId;
  family: string;
  style: string;
  /** Path in google/fonts at `FONT_SOURCE.commit`. */
  path: string;
  version: string;
  sha256: string;
  size: number;
  postscriptName: string;
};

export const FONT_SOURCE = { url: catalog.source, commit: catalog.commit };
export const PINNED_FONTS = catalog.fonts as PinnedFont[];

// Static import() calls so bundlers split each font into its own chunk and
// only the families a plan uses are loaded.
const data: Record<FontId, () => Promise<{ default: string }>> = {
  "crimson-text-regular": () => import("./data/crimson-text-regular"),
  "crimson-text-italic": () => import("./data/crimson-text-italic"),
  "crimson-text-semibold": () => import("./data/crimson-text-semibold"),
  "patrick-hand-regular": () => import("./data/patrick-hand-regular"),
  "barlow-condensed-extrabold": () =>
    import("./data/barlow-condensed-extrabold"),
  "barlow-condensed-medium": () => import("./data/barlow-condensed-medium"),
  "barlow-regular": () => import("./data/barlow-regular"),
  "barlow-italic": () => import("./data/barlow-italic"),
  "ibm-plex-mono-semibold": () => import("./data/ibm-plex-mono-semibold"),
};

/** Faces for the contract's font tokens (`HEADING_FONTS`, `BODY_FONTS`). */
export const HEADING_FACE: Record<HeadingFont, FontId> = {
  serif: "crimson-text-semibold",
  hand: "patrick-hand-regular",
  grotesk: "barlow-condensed-extrabold",
  mono: "ibm-plex-mono-semibold",
};
export const BODY_FACE: Record<BodyFont, FontId> = {
  serif: "crimson-text-regular",
  sans: "barlow-regular",
};
export const BODY_ITALIC_FACE: Record<BodyFont, FontId> = {
  serif: "crimson-text-italic",
  sans: "barlow-italic",
};
/** Quote text follows the prototype: condensed with grotesk, serif otherwise. */
export function quoteFace(heading: HeadingFont): FontId {
  return heading === "grotesk"
    ? "barlow-condensed-medium"
    : "crimson-text-regular";
}

export function pinnedFont(id: FontId): PinnedFont {
  const font = PINNED_FONTS.find((f) => f.id === id);
  if (!font) throw new RenderError("FONT_INTEGRITY", `Unknown font ${id}.`);
  return font;
}

/** `PostScriptName@version+sha256:<hex>`, the manifest's `fontVersions` entry. */
export function fontVersion(font: PinnedFont) {
  return `${font.postscriptName}@${font.version.replace(/^Version /, "")}+sha256:${font.sha256}`;
}

export async function sha256Hex(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

function decodeBase64(text: string) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Font bytes, verified against the pinned digest. */
export async function loadFont(id: FontId): Promise<Uint8Array> {
  const font = pinnedFont(id);
  const bytes = decodeBase64((await data[id]()).default);
  if (bytes.length !== font.size || (await sha256Hex(bytes)) !== font.sha256)
    throw new RenderError(
      "FONT_INTEGRITY",
      `Font ${font.postscriptName} does not match its pinned SHA-256.`,
    );
  return bytes;
}
