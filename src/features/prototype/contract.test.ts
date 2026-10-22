import { describe, expect, it } from "vitest";
import {
  buildTemplatePlan as buildContractPlan,
  TEXT_LIMITS,
  templates,
  validatePlan,
} from "@/lib/design-plan";
import {
  validatePlan as composerChecks,
  textLimit,
} from "@/features/composer/plan-utils";
import { contractContext, toContractPlan } from "./contract";
import { createSeedState } from "./fixtures";
import { actions, getPrototypeState } from "./store";
import { buildTemplatePlan } from "./templates";
import type { DesignPlan } from "./types";

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

  const membersOf = (collectionId: string) =>
    state.collections.find((c) => c.id === collectionId)!.memberIds;
  const contractRow = (plan: DesignPlan) =>
    composerChecks(
      plan,
      memoriesOf(plan.collectionId),
      membersOf(plan.collectionId),
    ).find((r) => r.id === "contract")!;

  it("passes the composer's contract check for every seed plan", () => {
    for (const plan of state.plans)
      expect(contractRow(plan)).toMatchObject({ ok: true });
  });

  it("uses the shared heading limit and names the failing block", () => {
    expect(textLimit("heading")).toBe(TEXT_LIMITS.heading);
    const plan = structuredClone(state.plans[0]);
    plan.pages[1].blocks[0].text = "a".repeat(TEXT_LIMITS.heading + 1);
    const rows = composerChecks(plan, memoriesOf(plan.collectionId));
    expect(rows.find((r) => r.id === "length")?.ok).toBe(false);
    expect(contractRow(plan).detail).toContain("page 2, block 1");
  });

  it("checks credited people against collection members", () => {
    const plan = structuredClone(state.plans[0]);
    plan.pages[1].blocks[1].attributionId = "p-stranger";
    expect(contractRow(plan)).toMatchObject({ ok: false });
    expect(contractRow(plan).detail).toContain("Not a known person");
  });

  it("never splits a surrogate pair when trimming a story into a note", () => {
    const draft = structuredClone(state);
    const story = draft.memories.find((m) => m.kind === "text")!;
    story.story = "a" + "😀".repeat(300);
    const plan = buildTemplatePlan(draft, story.collectionId, "tpl-film", {
      id: "draft",
      revision: 1,
    });
    const note = plan.pages[1].blocks[1].text!;
    expect(Array.from(note)).toHaveLength(220);
    expect(note.endsWith("😀")).toBe(true);
  });

  it("keeps removed sources as style-only influence when saving by hand", () => {
    const base = getPrototypeState().plans.find((p) => p.id === "plan-fy-1")!;
    const draft = structuredClone(base);
    draft.pages[1].blocks = draft.pages[1].blocks.filter(
      (b) => b.kind !== "note",
    );
    const removed = base.pages[1].blocks.find((b) => b.kind === "note")!
      .memoryIds![0];
    actions.savePlanRevision(draft);
    const saved = getPrototypeState().plans.at(-1)!;
    expect(saved.parentRevision).toBe(base.revision);
    expect(saved.styleOnlyIds).toEqual(
      expect.arrayContaining([...base.styleOnlyIds, removed]),
    );
  });
});
