import { manualEligible } from "./selectors";
import type {
  Block,
  DesignPlan,
  Memory,
  Page,
  PrototypeState,
  StyleTokens,
} from "./types";

// Deterministic six-page templates (FR-15). Building one never calls a model,
// needs no AI consent, and works from an empty draft: unfilled slots stay
// empty until the creator places an approved memory.

export type Template = {
  id: string;
  version: string;
  name: string;
  description: string;
  tokens: StyleTokens;
  /** Page layouts for the six editorial roles. */
  layouts: Record<Page["role"], Page["layout"]>;
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

/**
 * Builds a template plan from memories approved for manual use. Pass
 * `empty: true` for a blank draft whose slots the creator fills by hand.
 */
export function buildTemplatePlan(
  state: PrototypeState,
  collectionId: string,
  templateId: string,
  options: { revision: number; empty?: boolean; id: string },
): DesignPlan {
  const template = templateById(templateId) ?? templates[0];
  const collection = state.collections.find((c) => c.id === collectionId);
  const eligible: Memory[] = options.empty
    ? []
    : state.memories.filter(
        (m) => m.collectionId === collectionId && manualEligible(m),
      );
  const visuals = eligible.filter(
    (m) => m.art && (m.kind === "photo" || m.kind === "video"),
  );
  const texts = eligible.filter((m) => m.kind === "text");
  const quotes = eligible.flatMap((m) =>
    (m.transcript ?? []).filter((e) => e.reviewed).map((e) => ({ m, e })),
  );
  let n = 0;
  const bid = () => `${options.id}-b${++n}`;
  const image = (m?: Memory): Block => ({
    id: bid(),
    kind: "image",
    memoryIds: m ? [m.id] : [],
  });
  const caption = (m?: Memory): Block => ({
    id: bid(),
    kind: "caption",
    memoryIds: m ? [m.id] : undefined,
    text: m?.caption ?? "",
    attributionId: m?.uploaderId,
  });
  const L = template.layouts;
  const pages: Page[] = [
    {
      role: "cover",
      layout: L.cover,
      blocks: [
        {
          id: bid(),
          kind: "cover",
          memoryIds: visuals[0] ? [visuals[0].id] : [],
          text: collection?.title ?? "Untitled",
        },
      ],
    },
    {
      role: "opening",
      layout: L.opening,
      blocks: [
        { id: bid(), kind: "heading", text: collection?.occasion ?? "" },
        texts[0]
          ? {
              id: bid(),
              kind: "note",
              memoryIds: [texts[0].id],
              text: texts[0].story.slice(0, 220),
              attributionId: texts[0].uploaderId,
            }
          : { id: bid(), kind: "note", text: "" },
      ],
    },
    {
      role: "photos",
      layout: L.photos,
      blocks:
        L.photos === "full"
          ? [image(visuals[1] ?? visuals[0]), caption(visuals[1] ?? visuals[0])]
          : [
              image(visuals[0]),
              caption(visuals[0]),
              image(visuals[1]),
              caption(visuals[1]),
            ],
    },
    {
      role: "perspectives",
      layout: L.perspectives,
      blocks: [
        ...(L.perspectives === "split" ? [image(visuals[2])] : []),
        ...(quotes.length
          ? quotes.slice(0, 2).map(({ m, e }): Block => ({
              id: bid(),
              kind: "quote",
              memoryIds: [m.id],
              excerptId: e.id,
              text: e.text,
              attributionId: e.speakerId,
            }))
          : [{ id: bid(), kind: "quote", text: "" } as Block]),
      ],
    },
    {
      role: "more",
      layout: L.more,
      blocks: [
        {
          id: bid(),
          kind: L.more === "collage" ? "collage" : "grid",
          memoryIds: visuals.slice(0, 4).map((m) => m.id),
        },
      ],
    },
    {
      role: "closing",
      layout: L.closing,
      blocks: [
        { id: bid(), kind: "heading", text: "Until next time" },
        { id: bid(), kind: "note", text: "" },
      ],
    },
  ];
  return {
    id: options.id,
    collectionId,
    revision: options.revision,
    origin: "template",
    templateId: template.id,
    createdAt: new Date().toISOString(),
    inspiration: `Built from the ${template.name} template (v${template.version}) without AI.`,
    styleOnlyIds: [],
    schemaVersion: "design-plan/0.2",
    tokens: { ...template.tokens },
    pages,
  };
}
