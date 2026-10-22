import {
  buildTemplatePlan as buildContractPlan,
  templateById,
  templates,
} from "@/lib/design-plan";
import { contractText, fromContractPages, memoryRef } from "./contract";
import { manualEligible } from "./selectors";
import type { DesignPlan, Memory, PrototypeState } from "./types";

// Presets and the deterministic six-page builder live in the shared CH-20
// contract (src/lib/design-plan). This wrapper picks approved prototype
// memories and maps the result back to the composer's plan shape.

export { templateById, templates, type Template } from "@/lib/design-plan";

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
  const sourced = (
    memoryId: string,
    text: string,
    attributionId: string,
    excerptId?: string,
  ) =>
    contractText(
      {
        id: memoryId,
        kind: "quote",
        memoryIds: [memoryId],
        text,
        attributionId,
        excerptId,
      },
      state.memories,
      true,
    );
  const plan = buildContractPlan(
    template.id,
    {
      title: collection?.title ?? "Untitled",
      occasion: collection?.occasion ?? "",
      visuals: visuals.map((m) => ({
        asset: memoryRef(m.id),
        caption: sourced(m.id, m.caption, m.uploaderId),
      })),
      note: texts[0]
        ? sourced(
            texts[0].id,
            // Code points, so a surrogate pair is never split.
            Array.from(texts[0].story).slice(0, 220).join(""),
            texts[0].uploaderId,
          )
        : undefined,
      quotes: quotes.map(({ m, e }) =>
        sourced(m.id, e.text, e.speakerId, e.id),
      ),
    },
    { idPrefix: options.id },
  );
  return {
    id: options.id,
    collectionId,
    revision: options.revision,
    origin: "template",
    templateId: template.id,
    createdAt: new Date().toISOString(),
    inspiration: `Built from the ${template.name} template (v${template.version}) without AI.`,
    styleOnlyIds: [],
    schemaVersion: plan.schemaVersion,
    tokens: { ...plan.style },
    pages: fromContractPages(plan.pages, state.memories),
  };
}
