import {
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  PLAN_COMPONENT_VERSION,
  PLAN_SCHEMA_VERSION,
  type AssetRef,
  type Component,
  type DesignPlan,
  type PageLayout,
  type PageRole,
  type PlanPage,
  type ValidationContext,
} from "../../../src/lib/design-plan";

// Synthetic CH-20 fixtures shaped like accepted AI output. IDs are made up;
// they reference no real collection, and validating them grants nothing.

const version = (id: string): AssetRef => ({ kind: "version", id });
const derivative = (id: string): AssetRef => ({ kind: "derivative", id });
const page = (
  role: PageRole,
  layout: PageLayout,
  components: Component[],
): PlanPage => ({
  role,
  layout,
  widthMm: PAGE_WIDTH_MM,
  heightMm: PAGE_HEIGHT_MM,
  components,
});

export const people = ["person-maya", "person-priya", "person-leo"];

export const context: ValidationContext = {
  authorizedAssets: [
    "ver-pier",
    "ver-kitchen",
    "ver-story",
    "ver-voice",
    "ver-boxes",
    "ver-neon",
    "ver-crowd",
    "ver-setlist",
    "ver-booth",
  ]
    .map(version)
    .concat([derivative("drv-still-dance"), derivative("drv-still-encore")]),
  people,
};

/** Warm scrapbook: inset cover, overlapping taped photos, a collage spread. */
export const warmScrapbook: DesignPlan = {
  schemaVersion: PLAN_SCHEMA_VERSION,
  componentVersion: PLAN_COMPONENT_VERSION,
  provenance: {
    creationOrigin: {
      kind: "ai",
      jobId: "job-warm-1",
      modelVersion: "synthetic-design-v0",
    },
    revisionOrigin: {
      kind: "ai",
      jobId: "job-warm-1",
      modelVersion: "synthetic-design-v0",
    },
    aiJobs: [{ jobId: "job-warm-1", modelVersion: "synthetic-design-v0" }],
  },
  style: {
    name: "Warm scrapbook",
    paper: "#fbf3e6",
    ink: "#3b2a22",
    accent: "#c2542b",
    muted: "#b9926f",
    headingFont: "hand",
    bodyFont: "serif",
    texture: "tape",
  },
  pages: [
    page("cover", "full", [
      {
        id: "w-cover",
        kind: "cover",
        frame: { x: 8, y: 10, w: 132, h: 190 },
        assets: [version("ver-pier")],
        text: { value: "Our First Year Away From Home" },
      },
    ]),
    page("opening", "stack", [
      {
        id: "w-heading",
        kind: "heading",
        frame: { x: 14, y: 16, w: 120, h: 30 },
        text: { value: "Before we knew each other’s coffee orders" },
      },
      {
        id: "w-note",
        kind: "note",
        frame: { x: 14, y: 52, w: 120, h: 90 },
        text: {
          value:
            "Mostly the noise. Our flat was never quiet and I used to hate it. Now the three of you are the noise.",
          creditId: "person-maya",
          source: { asset: version("ver-story") },
        },
      },
      {
        id: "w-kitchen",
        kind: "image",
        frame: { x: 40, y: 148, w: 94, h: 52 },
        assets: [version("ver-kitchen")],
      },
    ]),
    page("photos", "collage", [
      {
        id: "w-photo-1",
        kind: "image",
        frame: { x: 10, y: 12, w: 84, h: 96 },
        assets: [version("ver-kitchen")],
      },
      {
        id: "w-photo-2",
        kind: "image",
        frame: { x: 54, y: 90, w: 84, h: 84 },
        assets: [derivative("drv-still-dance")],
      },
      {
        id: "w-photo-caption",
        kind: "caption",
        frame: { x: 10, y: 182, w: 128, h: 18 },
        text: {
          value: "The night we stopped pretending we weren’t homesick.",
          creditId: "person-maya",
          source: { asset: version("ver-kitchen") },
        },
      },
    ]),
    page("perspectives", "stack", [
      {
        id: "w-quote-1",
        kind: "quote",
        frame: { x: 14, y: 20, w: 120, h: 70 },
        text: {
          value: "Do you remember thinking a year was a long time?",
          creditId: "person-priya",
          source: { asset: version("ver-voice"), startMs: 12000, endMs: 16500 },
        },
      },
      {
        id: "w-quote-2",
        kind: "quote",
        frame: { x: 14, y: 100, w: 120, h: 70 },
        text: {
          value:
            "It went by in about four phone calls home and one very bad haircut.",
          creditId: "person-maya",
          source: { asset: version("ver-voice"), startMs: 17000, endMs: 22000 },
        },
      },
    ]),
    page("more", "collage", [
      {
        id: "w-collage",
        kind: "collage",
        frame: { x: 8, y: 12, w: 132, h: 150 },
        assets: [
          version("ver-pier"),
          version("ver-kitchen"),
          derivative("drv-still-dance"),
        ],
      },
      {
        id: "w-collage-caption",
        kind: "caption",
        frame: { x: 14, y: 170, w: 120, h: 24 },
        text: {
          value: "Golden hour, every hour.",
          creditId: "person-maya",
          authored: true,
        },
      },
    ]),
    page("closing", "stack", [
      {
        id: "w-closing",
        kind: "heading",
        frame: { x: 14, y: 120, w: 120, h: 24 },
        text: { value: "Same pier next summer" },
      },
      {
        id: "w-closing-note",
        kind: "note",
        frame: { x: 14, y: 150, w: 120, h: 44 },
        text: {
          value:
            "To the people who made a strange city feel like a kitchen table.",
          creditId: "person-maya",
          authored: true,
        },
      },
    ]),
  ],
  influence: {
    visible: [
      derivative("drv-still-dance"),
      version("ver-kitchen"),
      version("ver-pier"),
      version("ver-story"),
      version("ver-voice"),
    ],
    // The moving-boxes photo shaped the palette but appears on no page.
    style: [version("ver-boxes")],
  },
  inspiration: {
    rationale:
      "Golden-hour photos and a voice note about the pier suggested a warm, handmade scrapbook: sunset oranges, taped corners and handwritten headings.",
  },
};

/** Bold editorial: full-bleed images, a split spread and a dense grid. */
export const boldEditorial: DesignPlan = {
  schemaVersion: PLAN_SCHEMA_VERSION,
  componentVersion: PLAN_COMPONENT_VERSION,
  provenance: {
    creationOrigin: {
      kind: "ai",
      jobId: "job-neon-1",
      modelVersion: "synthetic-design-v0",
    },
    revisionOrigin: {
      kind: "ai",
      jobId: "job-neon-1",
      modelVersion: "synthetic-design-v0",
    },
    aiJobs: [{ jobId: "job-neon-1", modelVersion: "synthetic-design-v0" }],
  },
  style: {
    name: "Bold editorial",
    paper: "#111111",
    ink: "#f5f5f5",
    accent: "#ff2e88",
    muted: "#13e2d0",
    headingFont: "grotesk",
    bodyFont: "sans",
    texture: "grain",
  },
  pages: [
    page("cover", "full", [
      {
        id: "n-cover",
        kind: "cover",
        frame: { x: 0, y: 0, w: 148, h: 210 },
        assets: [version("ver-neon")],
        text: { value: "NEON SUMMER" },
      },
    ]),
    page("opening", "stack", [
      {
        id: "n-heading",
        kind: "heading",
        frame: { x: 10, y: 10, w: 128, h: 60 },
        text: { value: "OPENED WITH THE SLOW ONE." },
      },
      {
        id: "n-note",
        kind: "note",
        frame: { x: 10, y: 80, w: 80, h: 120 },
        text: {
          value:
            "Nobody expected that. By the encore we had lost our voices and found two strangers who knew every word.",
          creditId: "person-maya",
          source: { asset: version("ver-setlist") },
        },
      },
    ]),
    page("photos", "full", [
      {
        id: "n-crowd",
        kind: "image",
        frame: { x: 0, y: 0, w: 148, h: 150 },
        assets: [version("ver-crowd")],
      },
      {
        id: "n-crowd-caption",
        kind: "caption",
        frame: { x: 10, y: 160, w: 128, h: 40 },
        text: {
          value: "We were never getting this close again.",
          creditId: "person-maya",
          source: { asset: version("ver-crowd") },
        },
      },
    ]),
    page("perspectives", "split", [
      {
        id: "n-split-image",
        kind: "image",
        frame: { x: 0, y: 0, w: 74, h: 210 },
        assets: [version("ver-neon")],
      },
      {
        id: "n-quote",
        kind: "quote",
        frame: { x: 82, y: 40, w: 58, h: 120 },
        text: {
          value: "The city at 1am looks like a music video.",
          creditId: "person-leo",
          source: { asset: version("ver-neon") },
        },
      },
    ]),
    page("more", "grid", [
      {
        id: "n-grid",
        kind: "grid",
        frame: { x: 10, y: 10, w: 128, h: 128 },
        assets: [
          version("ver-neon"),
          version("ver-crowd"),
          derivative("drv-still-encore"),
          version("ver-booth"),
        ],
      },
      {
        id: "n-grid-heading",
        kind: "heading",
        frame: { x: 10, y: 150, w: 128, h: 40 },
        text: { value: "FOUR SONGS, NO SLEEP" },
      },
    ]),
    page("closing", "stack", [
      {
        id: "n-closing",
        kind: "heading",
        frame: { x: 10, y: 20, w: 128, h: 40 },
        text: { value: "ENCORE" },
      },
      {
        id: "n-closing-note",
        kind: "note",
        frame: { x: 10, y: 170, w: 128, h: 30 },
        text: {
          value: "Same time next year.",
          creditId: "person-maya",
          authored: true,
        },
      },
    ]),
  ],
  influence: {
    visible: [
      derivative("drv-still-encore"),
      version("ver-booth"),
      version("ver-crowd"),
      version("ver-neon"),
      version("ver-setlist"),
    ],
    style: [],
  },
  inspiration: {
    rationale:
      "High-contrast neon photos and a setlist written at 1am suggested black paper, magenta accents and oversized condensed headings.",
  },
};
