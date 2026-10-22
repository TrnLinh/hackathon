import { describe, expect, it } from "vitest";
import {
  buildTemplatePlan as buildContractPlan,
  templates,
  validatePlan,
} from "@/lib/design-plan";
import { validatePlan as composerChecks } from "@/features/composer/plan-utils";
import { contractContext, toContractPlan } from "./contract";
import { createSeedState } from "./fixtures";
import { buildTemplatePlan } from "./templates";

// The composer's UI plans must satisfy the shared CH-20 contract.

describe("prototype adapter", () => {
  const state = createSeedState();
  const memoriesOf = (collectionId: string) =>
    state.memories.filter((m) => m.collectionId === collectionId);

  it("adapts every seed plan to a valid contract plan", () => {
    for (const plan of state.plans) {
      const result = validatePlan(
        toContractPlan(plan, memoriesOf(plan.collectionId)),
        contractContext(memoriesOf(plan.collectionId)),
      );
      expect(result.ok ? [] : result.errors).toEqual([]);
    }
  });

  it("builds template drafts through the shared builder", () => {
    for (const collection of state.collections)
      for (const template of templates)
        for (const empty of [false, true]) {
          const memories = memoriesOf(collection.id);
          const plan = buildTemplatePlan(state, collection.id, template.id, {
            id: "draft",
            revision: 1,
            empty,
          });
          const adapted = toContractPlan(plan, memories);
          const result = validatePlan(adapted, {
            ...contractContext(memories),
            allowEmptySlots: true,
          });
          expect(result.ok ? [] : result.errors).toEqual([]);
          const shared = buildContractPlan(
            template.id,
            {
              title: collection.title,
              occasion: collection.occasion,
              visuals: [],
              quotes: [],
            },
            { idPrefix: "draft" },
          );
          if (empty) expect(adapted.pages).toEqual(shared.pages);
          expect(adapted.provenance).toEqual(shared.provenance);
        }
  });

  it("passes the composer's contract check for every seed plan", () => {
    for (const plan of state.plans) {
      const rows = composerChecks(plan, memoriesOf(plan.collectionId));
      expect(rows.find((r) => r.id === "contract")).toMatchObject({
        ok: true,
      });
    }
  });
});
