import {
  aiEligible,
  LIMITS,
  manualEligible,
  planInfluenceIds,
} from "@/features/prototype/selectors";
import { stylePresets } from "@/features/prototype/store";
import type {
  Block,
  BlockKind,
  DesignPlan,
  Memory,
  Page,
  PrototypeState,
} from "@/features/prototype/types";

// Local CH-20 checks for the prototype composer. The real validator must run
// in the shared contract package before preview and again before freezing.

export const ALLOWED_BLOCKS: BlockKind[] = [
  "cover",
  "heading",
  "image",
  "grid",
  "collage",
  "quote",
  "caption",
  "note",
];

export function codePoints(text: string | undefined) {
  return Array.from(text ?? "").length;
}

function luminance(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(value)) return 0;
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map(
    (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    },
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type ValidationRow = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export function validatePlan(
  plan: DesignPlan,
  memories: Memory[],
): ValidationRow[] {
  const byId = new Map(memories.map((m) => [m.id, m]));
  const blocks = plan.pages.flatMap((p) => p.blocks);
  const refs = planInfluenceIds(plan);

  const unknownKinds = blocks.filter((b) => !ALLOWED_BLOCKS.includes(b.kind));
  const badRefs = refs.filter((id) => {
    const m = byId.get(id);
    return !m || !manualEligible(m);
  });
  const isAi = plan.origin === "ai" || plan.origin === "refinement";
  const aiViolations = isAi
    ? blocks
        .filter((b) => !b.edited)
        .flatMap((b) => b.memoryIds ?? [])
        .concat(plan.styleOnlyIds)
        .filter((id) => {
          const m = byId.get(id);
          return m && !aiEligible(m);
        })
    : [];
  const longCaptions = blocks.filter(
    (b) =>
      (b.kind === "caption" && codePoints(b.text) > LIMITS.captionChars) ||
      (b.kind === "note" && codePoints(b.text) > LIMITS.storyChars),
  );
  const unreviewedQuotes = blocks.filter((b) => {
    if (b.kind !== "quote" || !b.excerptId) return false;
    const memory = b.memoryIds?.[0] ? byId.get(b.memoryIds[0]) : undefined;
    const excerpt = memory?.transcript?.find((e) => e.id === b.excerptId);
    return !excerpt || !excerpt.reviewed;
  });
  const ratio = contrastRatio(plan.tokens.ink, plan.tokens.paper);

  return [
    {
      id: "pages",
      label: "Exactly six A5 pages",
      ok: plan.pages.length === 6,
      detail: `${plan.pages.length} of 6 pages`,
    },
    {
      id: "kinds",
      label: "Only allowlisted components",
      ok: unknownKinds.length === 0,
      detail:
        unknownKinds.length === 0
          ? "Cover, heading, image, grid, collage, quote, caption, and note only"
          : `${unknownKinds.length} unknown component(s)`,
    },
    {
      id: "refs",
      label: "Every source is approved for this editor",
      ok: badRefs.length === 0,
      detail:
        badRefs.length === 0
          ? `${refs.length} source(s), including style-only influence`
          : `${badRefs.length} source(s) are pending, declined, withdrawn, or outside this collection`,
    },
    {
      id: "ai",
      label: "AI used only AI-approved sources",
      ok: aiViolations.length === 0,
      detail: !isAi
        ? "Manual revision: no AI processing involved"
        : aiViolations.length === 0
          ? "Manual-only memories appear only where you placed them"
          : `${aiViolations.length} reference(s) lack AI permission`,
    },
    {
      id: "length",
      label: "Text fits its limits",
      ok: longCaptions.length === 0,
      detail:
        longCaptions.length === 0
          ? `Captions ≤ ${LIMITS.captionChars}, notes ≤ ${LIMITS.storyChars.toLocaleString()} characters`
          : `${longCaptions.length} block(s) over the limit`,
    },
    {
      id: "quotes",
      label: "Quotes come from reviewed transcript excerpts",
      ok: unreviewedQuotes.length === 0,
      detail:
        unreviewedQuotes.length === 0
          ? "Every transcript quote has been reviewed"
          : `${unreviewedQuotes.length} quote(s) need transcript review`,
    },
    {
      id: "contrast",
      label: "Readable text contrast",
      ok: ratio >= 4.5,
      detail: `${ratio.toFixed(1)}:1 (minimum 4.5:1)`,
    },
    {
      id: "current",
      label: "Plan is current",
      ok: !plan.invalidatedReason,
      detail: plan.invalidatedReason
        ? `Invalidated: ${plan.invalidatedReason}`
        : "No withdrawn or changed sources",
    },
  ];
}

export type Budget = {
  memories: number;
  visuals: number;
  maxTranscript: number;
  sourceText: number;
  overVideoStills: string[];
  over: string[];
};

/** CH-19 job budgets for the AI-eligible memories of a collection. */
export function computeBudget(eligible: Memory[]): Budget {
  const visuals = eligible.reduce((sum, m) => {
    if (m.kind === "photo") return sum + 1;
    if (m.kind === "video")
      return sum + (m.stills ?? []).filter((s) => s.selected).length;
    return sum;
  }, 0);
  const transcriptLengths = eligible.map((m) =>
    (m.transcript ?? []).reduce((s, e) => s + codePoints(e.text), 0),
  );
  const maxTranscript = Math.max(0, ...transcriptLengths);
  const sourceText = eligible.reduce(
    (s, m, i) =>
      s + codePoints(m.caption) + codePoints(m.story) + transcriptLengths[i],
    0,
  );
  const overVideoStills = eligible
    .filter(
      (m) =>
        m.kind === "video" &&
        (m.stills ?? []).filter((s) => s.selected).length >
          LIMITS.framesPerVideo,
    )
    .map((m) => m.title);
  const over: string[] = [];
  if (eligible.length > LIMITS.activeMemories) over.push("memories");
  if (visuals > LIMITS.visualsPerJob) over.push("visual inputs");
  if (maxTranscript > LIMITS.transcriptChars) over.push("transcript length");
  if (sourceText > LIMITS.sourceTextChars) over.push("source text");
  if (overVideoStills.length) over.push("video stills");
  return {
    memories: eligible.length,
    visuals,
    maxTranscript,
    sourceText,
    overVideoStills,
    over,
  };
}

export type Usage = "visible" | "style-only" | "unused";

export function usageOf(plan: DesignPlan | undefined, memoryId: string): Usage {
  if (!plan) return "unused";
  if (
    plan.pages.some((p) =>
      p.blocks.some((b) => b.memoryIds?.includes(memoryId)),
    )
  )
    return "visible";
  if (plan.styleOnlyIds.includes(memoryId)) return "style-only";
  return "unused";
}

/**
 * Simple manual fallback layout from manually eligible memories. Needs no AI
 * processor; text is copied verbatim with its original attribution.
 */
export function buildManualPlan(
  state: PrototypeState,
  collectionId: string,
): DesignPlan {
  const collection = state.collections.find((c) => c.id === collectionId);
  const eligible = state.memories.filter(
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
  const id = () => `man-${Date.now().toString(36)}-${++n}`;
  const captionFor = (m: Memory): Block => ({
    id: id(),
    kind: "caption",
    memoryIds: [m.id],
    text: m.caption,
    attributionId: m.uploaderId,
  });
  const pages: Page[] = [
    {
      role: "cover",
      layout: "full",
      blocks: [
        {
          id: id(),
          kind: "cover",
          memoryIds: visuals[0] ? [visuals[0].id] : [],
          text: collection?.title ?? "Untitled",
        },
      ],
    },
    {
      role: "opening",
      layout: "stack",
      blocks: [
        { id: id(), kind: "heading", text: collection?.occasion ?? "" },
        ...(texts[0]
          ? [
              {
                id: id(),
                kind: "note" as const,
                memoryIds: [texts[0].id],
                text: texts[0].story,
                attributionId: texts[0].uploaderId,
              },
            ]
          : []),
      ],
    },
    {
      role: "photos",
      layout: "split",
      blocks: visuals
        .slice(0, 2)
        .flatMap((m) => [
          { id: id(), kind: "image" as const, memoryIds: [m.id] },
          captionFor(m),
        ]),
    },
    {
      role: "perspectives",
      layout: "stack",
      blocks: quotes.length
        ? quotes.slice(0, 3).map(({ m, e }) => ({
            id: id(),
            kind: "quote" as const,
            memoryIds: [m.id],
            excerptId: e.id,
            text: e.text,
            attributionId: e.speakerId,
          }))
        : texts.slice(1, 3).map((m) => ({
            id: id(),
            kind: "note" as const,
            memoryIds: [m.id],
            text: m.story,
            attributionId: m.uploaderId,
          })),
    },
    {
      role: "more",
      layout: "grid",
      blocks: [
        {
          id: id(),
          kind: "grid",
          memoryIds: visuals.slice(2, 6).map((m) => m.id),
        },
      ],
    },
    {
      role: "closing",
      layout: "stack",
      blocks: [{ id: id(), kind: "heading", text: "Until next time" }],
    },
  ];
  return {
    id: `draft-manual-${collectionId}`,
    collectionId,
    revision: 0,
    origin: "manual",
    createdAt: new Date().toISOString(),
    inspiration:
      "Manual layout: memories placed in upload order with their original captions. No AI processor was contacted.",
    styleOnlyIds: [],
    schemaVersion: "design-plan/0.1",
    tokens: { ...stylePresets.film, name: "Simple manual" },
    pages,
  };
}
