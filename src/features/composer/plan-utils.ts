import {
  COMPONENT_KINDS,
  codePoints as countCodePoints,
  contrastRatio,
  MIN_TEXT_CONTRAST,
  PLAN_SCHEMA_VERSION,
  validatePlan as validateDesignPlan,
} from "@/lib/design-plan";
import { contractContext, toContractPlan } from "@/features/prototype/contract";
import {
  aiEligible,
  LIMITS,
  manualEligible,
  planInfluenceIds,
} from "@/features/prototype/selectors";
import { templateById } from "@/features/prototype/templates";
import type {
  Block,
  BlockKind,
  DesignPlan,
  Memory,
} from "@/features/prototype/types";

// Composer checks. Consent rows are prototype-specific; the "contract" row
// runs the shared CH-20 validator (src/lib/design-plan) on the adapted plan.

export { contrastRatio };
export const ALLOWED_BLOCKS: readonly BlockKind[] = COMPONENT_KINDS;

export function codePoints(text: string | undefined) {
  return countCodePoints(text ?? "");
}

export const originLabel: Record<DesignPlan["origin"], string> = {
  template: "Template",
  ai: "AI",
  refinement: "Refinement",
  manual: "Manual",
};

/** True when AI produced this plan or an ancestor it was edited from. */
export function hasAiLineage(plan: DesignPlan) {
  return Boolean(
    plan.aiLineage || plan.origin === "ai" || plan.origin === "refinement",
  );
}

/** Short provenance line: origin, template and version, parent revision. */
export function provenanceSummary(plan: DesignPlan) {
  const template = templateById(plan.templateId);
  return [
    originLabel[plan.origin],
    template && `${template.name} v${template.version}`,
    plan.parentRevision !== undefined && `from revision ${plan.parentRevision}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

const textSlotKinds: BlockKind[] = ["heading", "note", "caption", "quote"];

/** Unfilled template slot: a photo slot without a source, or blank text. */
export function isEmptyBlock(block: Block) {
  if (block.kind === "cover" || block.kind === "image")
    return !block.memoryIds?.length;
  if (block.kind === "grid" || block.kind === "collage")
    return !block.memoryIds?.length;
  if (textSlotKinds.includes(block.kind)) return !block.text?.trim();
  return false;
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
  const isAi = hasAiLineage(plan);
  const emptySlots = blocks.filter(isEmptyBlock);
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
  // Empty slots have their own row; the contract row covers the rest.
  const contract = validateDesignPlan(toContractPlan(plan, memories), {
    ...contractContext(memories),
    allowEmptySlots: true,
  });

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
        ? plan.origin === "template"
          ? "Template plan: no AI processing involved"
          : "Manual revision: no AI processing involved"
        : aiViolations.length === 0
          ? "Manual-only memories appear only where you placed them"
          : `${aiViolations.length} reference(s) lack AI permission`,
    },
    {
      id: "slots",
      label: "Every slot is filled",
      ok: emptySlots.length === 0,
      detail:
        emptySlots.length === 0
          ? "No empty photo or text slots"
          : `${emptySlots.length} empty slot(s): fill or remove them before saving or freezing`,
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
      ok: ratio >= MIN_TEXT_CONTRAST,
      detail: `${ratio.toFixed(1)}:1 (minimum ${MIN_TEXT_CONTRAST}:1)`,
    },
    {
      id: "contract",
      label: "Matches the shared design-plan contract",
      ok: contract.ok,
      detail: contract.ok
        ? `${PLAN_SCHEMA_VERSION}: allowlisted parts, A5 bounds, safe text, full influence`
        : `${contract.errors.length} issue(s): ${contract.errors[0].message}`,
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
