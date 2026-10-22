import type { PlanOrigin } from "../consent/manifest";

// CH-20 DesignPlan contract shared by the composer, Convex and the PDF
// renderer. Framework-free and alias-free so Convex can import it directly.
// A plan is data for pinned local components, never markup or code.

export type { PlanOrigin };

/** Plan body schema. Bump on any change to a field's shape or meaning. */
export const PLAN_SCHEMA_VERSION = "chorus-plan/v1";
/** Component set and behaviour the plan targets; CH-10 pins fonts per version. */
export const PLAN_COMPONENT_VERSION = "chorus-components/v1";
export const SUPPORTED_SCHEMA_VERSIONS: readonly string[] = [
  PLAN_SCHEMA_VERSION,
];
export const SUPPORTED_COMPONENT_VERSIONS: readonly string[] = [
  PLAN_COMPONENT_VERSION,
];

/** Six portrait A5 pages; geometry is in whole millimetres from the top left. */
export const PAGE_COUNT = 6;
export const PAGE_WIDTH_MM = 148;
export const PAGE_HEIGHT_MM = 210;

export const COMPONENT_KINDS = [
  "cover",
  "heading",
  "image",
  "grid",
  "collage",
  "quote",
  "caption",
  "note",
] as const;
export const VISUAL_KINDS = ["image", "grid", "collage"] as const;
export const TEXT_KINDS = ["heading", "quote", "caption", "note"] as const;
export const HEADING_FONTS = ["serif", "hand", "grotesk", "mono"] as const;
export const BODY_FONTS = ["serif", "sans"] as const;
export const TEXTURES = ["none", "film", "tape", "grain"] as const;
export const PAGE_ROLES = [
  "cover",
  "opening",
  "photos",
  "perspectives",
  "more",
  "closing",
] as const;
/** Preview grouping hint. Frames are authoritative for the renderer. */
export const PAGE_LAYOUTS = [
  "full",
  "split",
  "grid",
  "collage",
  "stack",
] as const;

export type ComponentKind = (typeof COMPONENT_KINDS)[number];
export type VisualKind = (typeof VISUAL_KINDS)[number];
export type TextKind = (typeof TEXT_KINDS)[number];
export type HeadingFont = (typeof HEADING_FONTS)[number];
export type BodyFont = (typeof BODY_FONTS)[number];
export type Texture = (typeof TEXTURES)[number];
export type PageRole = (typeof PAGE_ROLES)[number];
export type PageLayout = (typeof PAGE_LAYOUTS)[number];

/** Colors are lowercase `#rrggbb`. `muted` is decoration only, never text. */
export type StyleTokens = {
  name: string;
  paper: string;
  ink: string;
  accent: string;
  muted: string;
  headingFont: HeadingFont;
  bodyFont: BodyFont;
  texture: Texture;
};

/**
 * Opaque reference to an immutable memory version or derived artifact
 * (still, resized image, reviewed excerpt). Never a URL or file path; the
 * renderer resolves it from locally decrypted, authorized assets only.
 */
export type AssetRef = { kind: "version" | "derivative"; id: string };

export type Frame = { x: number; y: number; w: number; h: number };

/** Words taken from a source; recordings carry the excerpt range. */
export type TextSource = { asset: AssetRef; startMs?: number; endMs?: number };

export type PlanText = {
  value: string;
  /** Person credited beside the text: declared speaker or writer. */
  creditId?: string;
  /** New words written while editing; the credited person must approve them. */
  authored?: true;
  source?: TextSource;
};

export type CoverComponent = {
  id: string;
  kind: "cover";
  frame: Frame;
  assets: AssetRef[];
  text: PlanText;
};
export type VisualComponent = {
  id: string;
  kind: VisualKind;
  frame: Frame;
  assets: AssetRef[];
};
export type TextComponent = {
  id: string;
  kind: TextKind;
  frame: Frame;
  text: PlanText;
};
export type Component = CoverComponent | VisualComponent | TextComponent;

export type PlanPage = {
  role: PageRole;
  layout: PageLayout;
  widthMm: number;
  heightMm: number;
  /** Paint order: later components draw over earlier ones. */
  components: Component[];
};

/**
 * Everything that shaped the plan. `visible` equals the refs placed on
 * pages; `style` keeps style-only and retained influence (FR-31).
 */
export type InfluenceClosure = { visible: AssetRef[]; style: AssetRef[] };

export type AiJobRef = { jobId: string; modelVersion: string };

export type PlanProvenance = {
  /** Root origin; survives every later revision (FR-33). */
  creationOrigin: PlanOrigin;
  /** How this revision was made. */
  revisionOrigin: PlanOrigin;
  /** Content digest of the parent revision. Absent on a root plan. */
  parentDigest?: string;
  /** Every AI design job in this plan's ancestry. Empty without AI. */
  aiJobs: AiJobRef[];
};

/** AI design rationale and optional style prompt (CH-18). */
export type Inspiration = { rationale: string; prompt?: string };

export type DesignPlan = {
  schemaVersion: string;
  componentVersion: string;
  provenance: PlanProvenance;
  style: StyleTokens;
  pages: PlanPage[];
  influence: InfluenceClosure;
  inspiration?: Inspiration;
};

/** Code-point limits; cover/heading reuse the 80 title and caption the 240 SRD limit. */
export const TEXT_LIMITS: Record<"cover" | TextKind, number> = {
  cover: 80,
  heading: 80,
  caption: 240,
  quote: 240,
  note: 2000,
};
/** Nominal type size (mm). The renderer may set text smaller, never larger. */
export const TYPE_SIZE_MM: Record<"cover" | TextKind, number> = {
  cover: 12,
  heading: 8,
  quote: 5.5,
  caption: 4,
  note: 4,
};
export const PLAN_LIMITS = {
  componentsPerPage: 8,
  coverAssets: 1,
  imageAssets: 1,
  gridAssets: 6,
  collageAssets: 4,
  minFrameMm: 8,
  closureRefs: 64,
  aiJobs: 64,
  styleNameChars: 80,
  rationaleChars: 1000,
  promptChars: 500,
} as const;

/** WCAG 2.2 AA (SC 1.4.3): ink is body text; accent is only used at display sizes. */
export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_DISPLAY_CONTRAST = 3;

export function codePoints(text: string) {
  return Array.from(text).length;
}

export function refKey(ref: AssetRef) {
  return `${ref.kind}:${ref.id}`;
}

function luminance(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(
    (c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    },
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio of two `#rrggbb` colors (1 to 21). */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Conservative fit estimate: half-em glyphs and 1.25 line height at the
 * nominal size. The renderer must still prove nothing is clipped (NFR-03).
 */
export function textFits(kind: "cover" | TextKind, frame: Frame, text: string) {
  const size = TYPE_SIZE_MM[kind];
  const perLine = Math.floor(frame.w / (size * 0.5));
  const lines = Math.floor(frame.h / (size * 1.25));
  if (perLine < 1) return false;
  const needed = text
    .split("\n")
    .reduce(
      (sum, line) => sum + Math.max(1, Math.ceil(codePoints(line) / perLine)),
      0,
    );
  return needed <= lines;
}
