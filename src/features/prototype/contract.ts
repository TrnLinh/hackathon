import {
  influenceClosure,
  layoutFrames,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  PLAN_COMPONENT_VERSION,
  PLAN_SCHEMA_VERSION,
  templateById,
  type AssetRef,
  type Component,
  type DesignPlan as ContractPlan,
  type PlanOrigin,
  type PlanPage,
  type PlanText,
  type ValidationContext,
} from "@/lib/design-plan";
import { manualEligible } from "./selectors";
import type { Block, DesignPlan, Memory, Page } from "./types";

// Adapter between the prototype's UI plan and the shared CH-20 contract.
// The prototype has no version or job IDs, so memory IDs stand in for
// memory versions, still IDs for derivatives, and one synthetic job for AI.

const PROTOTYPE_JOB = { jobId: "prototype-design", modelVersion: "prototype" };

export const memoryRef = (id: string): AssetRef => ({ kind: "version", id });
export const stillRef = (id: string): AssetRef => ({ kind: "derivative", id });

/**
 * Assets this editor may use (manually approved memories and their stills)
 * and, when given, the collection members who may be credited.
 */
export function contractContext(
  memories: Memory[],
  memberIds?: string[],
): ValidationContext {
  return {
    authorizedAssets: memories
      .filter(manualEligible)
      .flatMap((m) => [
        memoryRef(m.id),
        ...(m.stills ?? []).map((s) => stillRef(s.id)),
      ]),
    ...(memberIds ? { people: memberIds } : {}),
  };
}

/** Prototype quote/caption/note text in contract form. */
export function contractText(
  block: Block,
  memories: Memory[],
  sourced: boolean,
): PlanText {
  const text: PlanText = { value: block.text ?? "" };
  if (block.attributionId) text.creditId = block.attributionId;
  if (block.edited) text.authored = true;
  const sourceId = sourced ? block.memoryIds?.[0] : undefined;
  if (sourceId) {
    const excerpt = memories
      .find((m) => m.id === sourceId)
      ?.transcript?.find((e) => e.id === block.excerptId);
    text.source = {
      asset: memoryRef(sourceId),
      ...(excerpt
        ? {
            startMs: Math.round(excerpt.startSec * 1000),
            endMs: Math.round(excerpt.endSec * 1000),
          }
        : {}),
    };
  }
  return text;
}

function assets(block: Block): AssetRef[] {
  if (block.kind !== "grid" && block.kind !== "collage" && block.stillIds?.[0])
    return [stillRef(block.stillIds[0])];
  return (block.memoryIds ?? []).map(memoryRef);
}

function page(source: Page, memories: Memory[]): PlanPage {
  const frames = layoutFrames(
    source.layout,
    source.blocks.map((b) => b.kind),
  );
  return {
    role: source.role,
    layout: source.layout,
    widthMm: PAGE_WIDTH_MM,
    heightMm: PAGE_HEIGHT_MM,
    components: source.blocks.map((block, i): Component => {
      const base = { id: block.id, frame: frames[i] };
      switch (block.kind) {
        case "cover":
          return {
            ...base,
            kind: "cover",
            assets: assets(block),
            text: contractText(block, memories, false),
          };
        case "image":
        case "grid":
        case "collage":
          return { ...base, kind: block.kind, assets: assets(block) };
        default:
          return {
            ...base,
            kind: block.kind,
            text: contractText(block, memories, true),
          };
      }
    }),
  };
}

function origins(plan: DesignPlan) {
  const template = templateById(plan.templateId);
  const ai: PlanOrigin = { kind: "ai", ...PROTOTYPE_JOB };
  const creation: PlanOrigin =
    plan.origin === "template"
      ? {
          kind: "template",
          templateId: plan.templateId ?? "unknown",
          templateVersion: template?.version ?? "unknown",
        }
      : plan.origin === "manual"
        ? { kind: "manual" }
        : ai;
  const revision: PlanOrigin =
    plan.origin === "refinement"
      ? ai
      : plan.parentRevision === undefined
        ? creation
        : { kind: "manual" };
  const aiLineage =
    plan.aiLineage || plan.origin === "ai" || plan.origin === "refinement";
  return { creation, revision, aiJobs: aiLineage ? [PROTOTYPE_JOB] : [] };
}

/** The prototype plan as the shared contract sees it (frames from its layouts). */
export function toContractPlan(
  plan: DesignPlan,
  memories: Memory[],
): ContractPlan {
  const pages = plan.pages.map((p) => page(p, memories));
  const { creation, revision, aiJobs } = origins(plan);
  const rationale = plan.inspiration.trim();
  const prompt = plan.prompt?.trim();
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    componentVersion: PLAN_COMPONENT_VERSION,
    provenance: {
      creationOrigin: creation,
      revisionOrigin: revision,
      aiJobs: aiJobs.map((job) => ({ ...job })),
    },
    style: {
      ...plan.tokens,
      paper: plan.tokens.paper.toLowerCase(),
      ink: plan.tokens.ink.toLowerCase(),
      accent: plan.tokens.accent.toLowerCase(),
      muted: plan.tokens.muted.toLowerCase(),
    },
    pages,
    influence: influenceClosure(pages, plan.styleOnlyIds.map(memoryRef)),
    ...(rationale
      ? { inspiration: { rationale, ...(prompt ? { prompt } : {}) } }
      : {}),
  };
}

/** Shared-contract pages back in prototype form, recovering excerpt IDs. */
export function fromContractPages(
  pages: PlanPage[],
  memories: Memory[],
): Page[] {
  const memoryOf = (ref: AssetRef) =>
    ref.kind === "version"
      ? ref.id
      : memories.find((m) => m.stills?.some((s) => s.id === ref.id))?.id;
  return pages.map((p) => ({
    role: p.role,
    layout: p.layout,
    blocks: p.components.map((c): Block => {
      const block: Block = { id: c.id, kind: c.kind };
      if ("assets" in c) {
        block.memoryIds = c.assets
          .map(memoryOf)
          .filter((id): id is string => !!id);
        const stills = c.assets.filter((a) => a.kind === "derivative");
        if (stills.length) block.stillIds = stills.map((a) => a.id);
      }
      if ("text" in c) {
        block.text = c.text.value;
        if (c.text.creditId) block.attributionId = c.text.creditId;
        if (c.text.authored) block.edited = true;
        const source = c.text.source;
        if (source && c.kind !== "cover") {
          const memoryId = memoryOf(source.asset);
          if (memoryId) block.memoryIds = [memoryId];
          const excerpt = memories
            .find((m) => m.id === memoryId)
            ?.transcript?.find(
              (e) =>
                source.startMs !== undefined &&
                Math.round(e.startSec * 1000) === source.startMs &&
                Math.round(e.endSec * 1000) === source.endMs,
            );
          if (excerpt) block.excerptId = excerpt.id;
        }
      }
      return block;
    }),
  }));
}
