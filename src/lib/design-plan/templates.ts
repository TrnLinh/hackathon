import { influenceClosure } from "./closure";
import { layoutFrames } from "./layout";
import {
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  PLAN_COMPONENT_VERSION,
  PLAN_SCHEMA_VERSION,
  type AssetRef,
  type Component,
  type CoverComponent,
  type DesignPlan,
  type PageLayout,
  type PageRole,
  type PlanPage,
  type PlanText,
  type StyleTokens,
  type TextComponent,
  type VisualComponent,
} from "./schema";

// Deterministic six-page templates (FR-15). Building one never calls a
// model, needs no AI consent, and works from an empty draft: unfilled slots
// stay empty until the creator places an authorized asset. Published
// versions are immutable; change a preset by adding a new version.

export type Template = {
  id: string;
  version: string;
  name: string;
  description: string;
  tokens: StyleTokens;
  /** Page layouts for the six editorial roles. */
  layouts: Record<PageRole, PageLayout>;
};

export const templates: Template[] = [
  {
    id: "tpl-scrapbook",
    version: "1.0",
    name: "Warm scrapbook",
    description: "Taped photos, handwritten headings, and a collage spread.",
    tokens: {
      name: "Warm scrapbook",
      paper: "#fbf3e6",
      ink: "#3b2a22",
      accent: "#c2542b",
      muted: "#b9926f",
      headingFont: "hand",
      bodyFont: "serif",
      texture: "tape",
    },
    layouts: {
      cover: "full",
      opening: "stack",
      photos: "split",
      perspectives: "stack",
      more: "collage",
      closing: "stack",
    },
  },
  {
    id: "tpl-editorial",
    version: "1.0",
    name: "Bold editorial",
    description: "Dark paper, oversized headings, and full-bleed images.",
    tokens: {
      name: "Bold editorial",
      paper: "#111111",
      ink: "#f5f5f5",
      accent: "#ff2e88",
      muted: "#13e2d0",
      headingFont: "grotesk",
      bodyFont: "sans",
      texture: "grain",
    },
    layouts: {
      cover: "full",
      opening: "stack",
      photos: "full",
      perspectives: "split",
      more: "grid",
      closing: "stack",
    },
  },
  {
    id: "tpl-film",
    version: "1.0",
    name: "Quiet film",
    description: "Soft greens, thin frames, and plenty of white space.",
    tokens: {
      name: "Quiet film",
      paper: "#eef0ea",
      ink: "#23302a",
      accent: "#3f6b55",
      muted: "#93a596",
      headingFont: "serif",
      bodyFont: "serif",
      texture: "film",
    },
    layouts: {
      cover: "full",
      opening: "stack",
      photos: "split",
      perspectives: "stack",
      more: "grid",
      closing: "stack",
    },
  },
];

export function templateById(id: string | undefined) {
  return templates.find((t) => t.id === id);
}

/** Exact published preset, or undefined for unknown IDs and versions. */
export function findTemplate(id: string, version: string) {
  return templates.find((t) => t.id === id && t.version === version);
}

/** Authorized material in placement order; every field may be empty. */
export type TemplateContent = {
  title: string;
  occasion: string;
  /** Photos or stills, each with the caption placed beside it. */
  visuals: { asset: AssetRef; caption?: PlanText }[];
  note?: PlanText;
  /** Reviewed excerpts; the first two are placed. */
  quotes: PlanText[];
  /** Closing note; left empty for the creator when absent. */
  closing?: PlanText;
};

type Part =
  | Omit<CoverComponent, "frame">
  | Omit<VisualComponent, "frame">
  | Omit<TextComponent, "frame">;

function page(role: PageRole, layout: PageLayout, parts: Part[]): PlanPage {
  const frames = layoutFrames(
    layout,
    parts.map((p) => p.kind),
  );
  return {
    role,
    layout,
    widthMm: PAGE_WIDTH_MM,
    heightMm: PAGE_HEIGHT_MM,
    components: parts.map((p, i) => ({ ...p, frame: frames[i] }) as Component),
  };
}

/** Builds a template plan. `idPrefix` keeps component IDs unique per draft. */
export function buildTemplatePlan(
  templateId: string,
  content: TemplateContent,
  options: { idPrefix?: string } = {},
): DesignPlan {
  const template = templateById(templateId);
  if (!template) throw new Error("Unknown template.");
  let n = 0;
  const id = () => `${options.idPrefix ?? "tpl"}-b${++n}`;
  const v = content.visuals;
  const image = (visual?: TemplateContent["visuals"][number]): Part => ({
    id: id(),
    kind: "image",
    assets: visual ? [{ ...visual.asset }] : [],
  });
  const caption = (visual?: TemplateContent["visuals"][number]): Part => ({
    id: id(),
    kind: "caption",
    text: visual?.caption ?? { value: "" },
  });
  const L = template.layouts;
  const pages = [
    page("cover", L.cover, [
      {
        id: id(),
        kind: "cover",
        assets: v[0] ? [{ ...v[0].asset }] : [],
        text: { value: content.title },
      },
    ]),
    page("opening", L.opening, [
      { id: id(), kind: "heading", text: { value: content.occasion } },
      { id: id(), kind: "note", text: content.note ?? { value: "" } },
    ]),
    page(
      "photos",
      L.photos,
      L.photos === "full"
        ? [image(v[1] ?? v[0]), caption(v[1] ?? v[0])]
        : [image(v[0]), caption(v[0]), image(v[1]), caption(v[1])],
    ),
    page("perspectives", L.perspectives, [
      ...(L.perspectives === "split" ? [image(v[2])] : []),
      ...(content.quotes.length
        ? content.quotes.slice(0, 2)
        : [{ value: "" }]
      ).map((text): Part => ({ id: id(), kind: "quote", text })),
    ]),
    page("more", L.more, [
      {
        id: id(),
        kind: L.more === "collage" ? "collage" : "grid",
        assets: v.slice(0, 4).map((visual) => ({ ...visual.asset })),
      },
    ]),
    page("closing", L.closing, [
      { id: id(), kind: "heading", text: { value: "Until next time" } },
      { id: id(), kind: "note", text: content.closing ?? { value: "" } },
    ]),
  ];
  const origin = {
    kind: "template" as const,
    templateId: template.id,
    templateVersion: template.version,
  };
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    componentVersion: PLAN_COMPONENT_VERSION,
    provenance: { creationOrigin: origin, revisionOrigin: origin, aiJobs: [] },
    style: { ...template.tokens },
    pages,
    influence: influenceClosure(pages),
  };
}
