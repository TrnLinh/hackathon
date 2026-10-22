import { describe, expect, it } from "vitest";
import {
  buildTemplatePlan,
  commitPlan,
  contrastRatio,
  layoutFrames,
  PAGE_COUNT,
  PAGE_HEIGHT_MM,
  PAGE_LAYOUTS,
  PAGE_WIDTH_MM,
  planBytes,
  planDigest,
  reviseManually,
  templates,
  TEXT_LIMITS,
  textFits,
  validatePlan,
  type AssetRef,
  type ComponentKind,
  type DesignPlan,
  type PlanText,
  type TemplateContent,
} from "../src/lib/design-plan";
import { adversarialPlans } from "./fixtures/design-plans/adversarial";
import {
  boldEditorial,
  context,
  warmScrapbook,
} from "./fixtures/design-plans/plans";

const codes = (plan: unknown, ctx = context) => {
  const result = validatePlan(plan, ctx);
  return result.ok ? [] : [...new Set(result.errors.map((e) => e.code))].sort();
};
const composition = (plan: DesignPlan) =>
  plan.pages.map((p) => p.components.map((c) => [c.kind, c.frame]));

const version = (id: string): AssetRef => ({ kind: "version", id });
const said = (
  id: string,
  value: string,
  creditId = "person-maya",
): PlanText => ({
  value,
  creditId,
  source: { asset: version(id) },
});
const content: TemplateContent = {
  title: "Our First Year",
  occasion: "Moving cities",
  visuals: ["ver-pier", "ver-kitchen", "ver-crowd", "ver-neon"].map((id) => ({
    asset: version(id),
    caption: said(id, "Golden hour, again."),
  })),
  note: said("ver-story", "Mostly the noise. Now the three of you are it."),
  quotes: [
    {
      ...said("ver-voice", "A year felt long.", "person-priya"),
      source: { asset: version("ver-voice"), startMs: 1000, endMs: 4000 },
    },
  ],
  closing: { value: "Same pier next summer.", authored: true },
};

describe("CH-20 design-plan contract", () => {
  it("accepts both synthetic styles as six portrait A5 pages with different compositions", () => {
    for (const plan of [warmScrapbook, boldEditorial]) {
      expect(validatePlan(plan, context)).toMatchObject({ ok: true });
      expect(plan.pages).toHaveLength(PAGE_COUNT);
      for (const page of plan.pages)
        expect([page.widthMm, page.heightMm]).toEqual([
          PAGE_WIDTH_MM,
          PAGE_HEIGHT_MM,
        ]);
    }
    expect(composition(warmScrapbook)).not.toEqual(composition(boldEditorial));
    expect(warmScrapbook.style).not.toEqual(boldEditorial.style);
  });

  it.each(adversarialPlans)("rejects $name", ({ plan, expected }) => {
    expect(codes(plan)).toEqual([...expected].sort());
  });

  it("validates a complete template plan without processor metadata or AI", async () => {
    for (const template of templates) {
      const plan = buildTemplatePlan(template.id, content);
      expect(codes(plan)).toEqual([]);
      expect(plan.provenance).toEqual({
        creationOrigin: {
          kind: "template",
          templateId: template.id,
          templateVersion: template.version,
        },
        revisionOrigin: plan.provenance.creationOrigin,
        aiJobs: [],
      });
      expect(plan.inspiration).toBeUndefined();
      // Deterministic: building twice gives the same bytes.
      expect(await planDigest(buildTemplatePlan(template.id, content))).toBe(
        await planDigest(plan),
      );
    }
  });

  it("keeps empty template drafts editable but not freezable", () => {
    const empty = buildTemplatePlan("tpl-film", {
      title: "",
      occasion: "",
      visuals: [],
      quotes: [],
    });
    expect(codes(empty, { ...context, allowEmptySlots: true })).toEqual([]);
    expect(codes(empty)).toEqual(["EMPTY_SLOT"]);
    expect(() => buildTemplatePlan("tpl-remote", content)).toThrow();
  });

  it("cannot grant source access: fixture refs fail without an authorized context", () => {
    expect(codes(warmScrapbook, { authorizedAssets: [] })).toEqual([
      "UNKNOWN_ASSET",
    ]);
  });

  it("is pure: same errors every time and the input is not modified", () => {
    const plan = adversarialPlans[0].plan;
    const before = structuredClone(plan);
    expect(validatePlan(plan, context)).toEqual(validatePlan(plan, context));
    expect(plan).toEqual(before);
  });

  it("counts Unicode code points, not UTF-16 units", () => {
    const plan = structuredClone(warmScrapbook);
    const caption = plan.pages[4].components[1];
    if (!("text" in caption)) throw new Error("expected text");
    caption.text.value = "😀".repeat(240);
    expect(codes(plan)).toEqual([]);
    caption.text.value = "😀".repeat(241);
    expect(codes(plan)).toEqual(["TEXT_OVERFLOW"]);
  });

  it("lays out every page kind inside the A5 page", () => {
    const kinds: ComponentKind[] = ["image", "caption", "heading", "note"];
    for (const layout of PAGE_LAYOUTS)
      for (let n = 1; n <= 8; n++)
        for (const f of layoutFrames(
          layout,
          Array.from({ length: n }, (_, i) => kinds[i % kinds.length]),
        )) {
          expect(f.x + f.w).toBeLessThanOrEqual(PAGE_WIDTH_MM);
          expect(f.y + f.h).toBeLessThanOrEqual(PAGE_HEIGHT_MM);
          expect(Math.min(f.w, f.h)).toBeGreaterThanOrEqual(8);
        }
  });
});

describe("plan commitments", () => {
  it("are stable across key and closure order, and sensitive to content", async () => {
    const digest = await planDigest(warmScrapbook);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    const reverseKeys = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reverseKeys)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([k, v]) => [k, reverseKeys(v)]),
            )
          : value;
    const reordered = reverseKeys(warmScrapbook) as DesignPlan;
    reordered.influence = {
      style: [...warmScrapbook.influence.style],
      visible: [...warmScrapbook.influence.visible].reverse(),
    };
    expect(await planDigest(reordered)).toBe(digest);

    const caption = structuredClone(warmScrapbook);
    const text = caption.pages[2].components[2];
    if (!("text" in text)) throw new Error("expected text");
    text.text.value += "!";
    const frame = structuredClone(warmScrapbook);
    frame.pages[0].components[0].frame.x += 1;
    const style = structuredClone(warmScrapbook);
    style.style.accent = "#b8481f";
    for (const changed of [caption, frame, style])
      expect(await planDigest(changed)).not.toBe(digest);
  });

  it("freeze exactly the validated bytes and keep operational flags out", async () => {
    const committed = await commitPlan(warmScrapbook, context);
    if (!committed.ok) throw new Error("expected a valid plan");
    expect(committed.digest).toBe(await planDigest(warmScrapbook));
    expect(committed.bytes).toEqual(planBytes(warmScrapbook));
    expect(JSON.parse(new TextDecoder().decode(committed.bytes))).toEqual(
      committed.plan,
    );
    // AI on/off and editing mode are not plan content; they cannot be committed.
    for (const flag of [{ aiEnabled: false }, { editingMode: "template" }])
      expect(await commitPlan({ ...warmScrapbook, ...flag }, context)).toEqual({
        ok: false,
        errors: [expect.objectContaining({ code: "UNKNOWN_FIELD" })],
      });
    // Re-validating after AI is disabled changes nothing about the plan.
    const again = await commitPlan(structuredClone(warmScrapbook), context);
    expect(again.ok && again.digest).toBe(committed.digest);
  });
});

describe("manual revisions", () => {
  it("retain AI provenance and every dependency through repeated edits", async () => {
    // Continue manually: drop the opening note and its source.
    const opening = structuredClone(warmScrapbook.pages);
    opening[1].components = opening[1].components.filter(
      (c) => c.id !== "w-note",
    );
    const first = await reviseManually(warmScrapbook, { pages: opening });
    expect(codes(first)).toEqual([]);
    expect(first.provenance).toEqual({
      creationOrigin: warmScrapbook.provenance.creationOrigin,
      revisionOrigin: { kind: "manual" },
      parentDigest: await planDigest(warmScrapbook),
      aiJobs: warmScrapbook.provenance.aiJobs,
    });
    expect(first.influence.style).toEqual([
      version("ver-boxes"),
      version("ver-story"),
    ]);

    const restyled = await reviseManually(first, {
      style: { ...first.style, accent: "#b8481f" },
    });
    expect(codes(restyled)).toEqual([]);
    expect(restyled.provenance.creationOrigin).toEqual(
      warmScrapbook.provenance.creationOrigin,
    );
    expect(restyled.provenance.aiJobs).toEqual(warmScrapbook.provenance.aiJobs);
    expect(restyled.provenance.parentDigest).toBe(await planDigest(first));
    expect(restyled.influence).toEqual(first.influence);
    expect(await planDigest(restyled)).not.toBe(await planDigest(first));
    // The accepted parent is untouched.
    expect(codes(warmScrapbook)).toEqual([]);
    expect(warmScrapbook.pages[1].components).toHaveLength(3);
  });
});

describe("review regressions", () => {
  const timed = (plan: unknown) => {
    const start = performance.now();
    const result = codes(plan);
    return { result, ms: performance.now() - start };
  };

  it("caps string size before pattern scanning, so hostile text stays fast", () => {
    for (const rationale of ["a".repeat(200_000), "a".repeat(3999)]) {
      const { result, ms } = timed({
        ...warmScrapbook,
        inspiration: { rationale },
      });
      expect(result).toEqual(["TEXT_OVERFLOW"]);
      expect(ms).toBeLessThan(50);
    }
    const { result } = timed({
      ...warmScrapbook,
      extra: Array.from({ length: 70 }, () => "a".repeat(3999)),
    });
    expect(result).toEqual(["MALFORMED", "UNKNOWN_FIELD"]);
  });

  it("gives every template room for text at the editor's limits", () => {
    const max = (n: number, creditId?: string): PlanText => ({
      value: "a".repeat(n),
      ...(creditId ? { creditId } : {}),
    });
    const full: TemplateContent = {
      title: "a".repeat(TEXT_LIMITS.cover),
      occasion: "a".repeat(TEXT_LIMITS.heading),
      visuals: content.visuals.map((v) => ({
        ...v,
        caption: max(TEXT_LIMITS.caption),
      })),
      note: max(TEXT_LIMITS.note),
      quotes: [
        max(TEXT_LIMITS.quote, "person-priya"),
        max(TEXT_LIMITS.quote, "person-maya"),
      ],
      closing: max(TEXT_LIMITS.note),
    };
    for (const template of templates)
      expect(codes(buildTemplatePlan(template.id, full))).toEqual([]);
  });

  it("counts U+2028/U+2029 as line breaks", () => {
    const frame = { x: 0, y: 0, w: 124, h: 10 };
    expect(textFits("caption", frame, "a b")).toBe(true);
    expect(textFits("caption", frame, "a\u2028b\u2029c")).toBe(false);
  });

  it("reads three-digit colors in contrastRatio", () => {
    expect(contrastRatio("#fff", "#111111")).toBeCloseTo(
      contrastRatio("#ffffff", "#111111"),
    );
  });

  it("commits only schema fields and never throws on explicit undefined", async () => {
    const extra = { ...warmScrapbook, editingMode: "ai" } as DesignPlan;
    expect(await planDigest(extra)).toBe(await planDigest(warmScrapbook));
    expect(planBytes(extra)).toEqual(planBytes(warmScrapbook));
    const undef = { ...warmScrapbook, inspiration: undefined };
    await expect(commitPlan(undef, context)).resolves.toMatchObject({
      ok: false,
    });
  });

  it("allows text painted over an earlier image", () => {
    const plan = structuredClone(warmScrapbook);
    plan.pages[2].components.push({
      id: "w-overlay",
      kind: "caption",
      frame: { x: 14, y: 80, w: 70, h: 20 },
      text: { value: "Taped in", creditId: "person-maya", authored: true },
    });
    expect(codes(plan)).toEqual([]);
  });
});
