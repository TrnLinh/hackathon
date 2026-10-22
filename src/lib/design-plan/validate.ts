import { findTemplate } from "./templates";
import {
  BODY_FONTS,
  COMPONENT_KINDS,
  HEADING_FONTS,
  MIN_DISPLAY_CONTRAST,
  MIN_TEXT_CONTRAST,
  PAGE_COUNT,
  PAGE_HEIGHT_MM,
  PAGE_LAYOUTS,
  PAGE_ROLES,
  PAGE_WIDTH_MM,
  PLAN_COMPONENT_VERSION,
  PLAN_LIMITS,
  PLAN_SCHEMA_VERSION,
  TEXT_LIMITS,
  TEXTURES,
  codePoints,
  contrastRatio,
  refKey,
  textFits,
  type AssetRef,
  type DesignPlan,
  type TextKind,
} from "./schema";

// The one DesignPlan validator (FR-29). Template, manual and AI plans all
// pass through it before preview, save and freeze. Pure and deterministic:
// the same input and context always give the same ordered errors.

export type PlanErrorCode =
  | "MALFORMED"
  | "UNKNOWN_FIELD"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "UNSUPPORTED_COMPONENT_VERSION"
  | "PAGE_COUNT"
  | "PAGE_FORMAT"
  | "UNKNOWN_PAGE_ROLE"
  | "UNKNOWN_LAYOUT"
  | "UNKNOWN_COMPONENT"
  | "UNKNOWN_FONT"
  | "UNKNOWN_TEXTURE"
  | "INVALID_COLOR"
  | "LOW_CONTRAST"
  | "UNSAFE_MARKUP"
  | "EXTERNAL_URL"
  | "CONTROL_CHARACTER"
  | "INVALID_ID"
  | "DUPLICATE_ID"
  | "INVALID_BOUNDS"
  | "COMPONENT_LIMIT"
  | "COMPONENT_CONTENT"
  | "EMPTY_SLOT"
  | "TEXT_OVERFLOW"
  | "INVALID_TIME_RANGE"
  | "ATTRIBUTION_REQUIRED"
  | "UNKNOWN_PERSON"
  | "UNKNOWN_ASSET"
  | "INFLUENCE_MISSING"
  | "CLOSURE_INVALID"
  | "UNKNOWN_TEMPLATE"
  | "INVALID_PROVENANCE";

export type PlanError = { code: PlanErrorCode; path: string; message: string };

export type ValidationContext = {
  /**
   * Assets the editor may use right now: currently approved source versions
   * and derivatives. Membership here never grants access; real callers pass
   * what the authorized backend returned.
   */
  authorizedAssets: readonly AssetRef[];
  /** People who may be credited. Omit to skip the check. */
  people?: readonly string[];
  /** Drafts may keep unfilled slots; saving for freeze must not. */
  allowEmptySlots?: boolean;
};

export type ValidationResult =
  | { ok: true; plan: DesignPlan; errors: [] }
  | { ok: false; errors: PlanError[] };

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const COLOR = /^#[0-9a-f]{6}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MARKUP =
  /<[a-z!/?%]|&#?[a-z0-9]+;|\$\{|\{\{|\bjavascript:|\bon[a-z]+\s*=|\burl\(/i;
const NETWORK_URL =
  /[a-z][a-z0-9+.-]*:\/\/|\/\/[a-z0-9-]+\.[a-z]|\bwww\.[a-z0-9-]+\.[a-z]|\b(?:data|blob|file|javascript|vbscript|mailto|tel|ftp):\S/i;
// C0/C1 controls except newline, plus bidirectional overrides.
const CONTROL =
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const MAX_DEPTH = 12;
const MAX_NODES = 20000;
const MAX_ERRORS = 100;

type Report = (code: PlanErrorCode, path: string, message: string) => void;
type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Rejects markup, URLs and control characters in every string, known field or not. */
function scanStrings(input: unknown, report: Report) {
  let nodes = 0;
  const walk = (value: unknown, path: string, depth: number) => {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) {
      if (nodes === MAX_NODES + 1 || depth === MAX_DEPTH + 1)
        report("MALFORMED", path, "Plan is too large or too deeply nested.");
      return;
    }
    if (typeof value === "string") {
      if (MARKUP.test(value))
        report("UNSAFE_MARKUP", path, "Text contains markup or code.");
      if (NETWORK_URL.test(value))
        report("EXTERNAL_URL", path, "Text contains a URL.");
      if (CONTROL.test(value))
        report("CONTROL_CHARACTER", path, "Text contains a control character.");
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value))
        walk(item, `${path}.${key}`, depth + 1);
    }
  };
  walk(input, "plan", 0);
}

export function validatePlan(
  input: unknown,
  context: ValidationContext,
): ValidationResult {
  const errors: PlanError[] = [];
  const report: Report = (code, path, message) => {
    if (errors.length < MAX_ERRORS) errors.push({ code, path, message });
  };
  scanStrings(input, report);

  const record = (
    value: unknown,
    path: string,
    required: string[],
    optional: string[] = [],
  ): Obj | undefined => {
    if (!isObject(value)) {
      report("MALFORMED", path, "Expected an object.");
      return undefined;
    }
    for (const key of Object.keys(value))
      if (!required.includes(key) && !optional.includes(key))
        report("UNKNOWN_FIELD", `${path}.${key}`, "Field is not allowed.");
    const missing = required.filter((key) => value[key] === undefined);
    if (missing.length) {
      report("MALFORMED", path, `Missing ${missing.join(", ")}.`);
      return undefined;
    }
    return value;
  };
  const text = (value: unknown, path: string, max = 128) => {
    if (typeof value !== "string" || !value.trim()) {
      report("MALFORMED", path, "Expected nonempty text.");
      return undefined;
    }
    if (codePoints(value) > max)
      report("TEXT_OVERFLOW", path, `Longer than ${max} characters.`);
    return value;
  };
  const list = (
    value: unknown,
    path: string,
    max: number,
    code: PlanErrorCode,
  ) => {
    if (!Array.isArray(value)) {
      report("MALFORMED", path, "Expected a list.");
      return [];
    }
    if (value.length > max) report(code, path, `At most ${max} entries.`);
    return value.slice(0, max);
  };
  const id = (value: unknown, path: string) => {
    if (typeof value !== "string" || !ID.test(value)) {
      report("INVALID_ID", path, "Expected an opaque identifier.");
      return undefined;
    }
    return value;
  };
  const assetRef = (value: unknown, path: string): AssetRef | undefined => {
    const r = record(value, path, ["kind", "id"]);
    if (!r) return undefined;
    if (r.kind !== "version" && r.kind !== "derivative") {
      report("MALFORMED", `${path}.kind`, "Expected version or derivative.");
      return undefined;
    }
    const refId = id(r.id, `${path}.id`);
    return refId ? { kind: r.kind, id: refId } : undefined;
  };

  const plan = record(
    input,
    "plan",
    [
      "schemaVersion",
      "componentVersion",
      "provenance",
      "style",
      "pages",
      "influence",
    ],
    ["inspiration"],
  );
  if (!plan) return { ok: false, errors };

  if (plan.schemaVersion !== PLAN_SCHEMA_VERSION)
    report(
      "UNSUPPORTED_SCHEMA_VERSION",
      "plan.schemaVersion",
      `Expected ${PLAN_SCHEMA_VERSION}.`,
    );
  if (plan.componentVersion !== PLAN_COMPONENT_VERSION)
    report(
      "UNSUPPORTED_COMPONENT_VERSION",
      "plan.componentVersion",
      `Expected ${PLAN_COMPONENT_VERSION}.`,
    );

  // Provenance: origins, AI ancestry and parent commitment.
  const provenance = record(
    plan.provenance,
    "plan.provenance",
    ["creationOrigin", "revisionOrigin", "aiJobs"],
    ["parentDigest"],
  );
  if (provenance) {
    const jobs = new Map<string, unknown>();
    const aiJobs = Array.isArray(provenance.aiJobs) ? provenance.aiJobs : null;
    if (!aiJobs || aiJobs.length > PLAN_LIMITS.aiJobs)
      report(
        "INVALID_PROVENANCE",
        "plan.provenance.aiJobs",
        "Expected a bounded list of AI jobs.",
      );
    (aiJobs ?? []).slice(0, PLAN_LIMITS.aiJobs).forEach((job, i) => {
      const path = `plan.provenance.aiJobs[${i}]`;
      const j = record(job, path, ["jobId", "modelVersion"]);
      if (!j) return;
      const jobId = text(j.jobId, `${path}.jobId`);
      text(j.modelVersion, `${path}.modelVersion`);
      if (jobId && jobs.has(jobId))
        report("INVALID_PROVENANCE", path, "Duplicate AI job.");
      if (jobId) jobs.set(jobId, j.modelVersion);
    });
    for (const key of ["creationOrigin", "revisionOrigin"]) {
      const path = `plan.provenance.${key}`;
      const o = provenance[key];
      if (!isObject(o)) {
        report("INVALID_PROVENANCE", path, "Expected a plan origin.");
        continue;
      }
      const keys = Object.keys(o).sort().join(",");
      if (o.kind === "manual" && keys === "kind") continue;
      if (o.kind === "template" && keys === "kind,templateId,templateVersion") {
        if (
          typeof o.templateId !== "string" ||
          typeof o.templateVersion !== "string" ||
          !findTemplate(o.templateId, o.templateVersion)
        )
          report("UNKNOWN_TEMPLATE", path, "Not a published template.");
        continue;
      }
      if (o.kind === "ai" && keys === "jobId,kind,modelVersion") {
        if (
          typeof o.jobId !== "string" ||
          !jobs.has(o.jobId) ||
          jobs.get(o.jobId) !== o.modelVersion
        )
          report(
            "INVALID_PROVENANCE",
            path,
            "AI origin is missing from the AI job lineage.",
          );
        continue;
      }
      report("INVALID_PROVENANCE", path, "Expected a plan origin.");
    }
    if (
      provenance.parentDigest !== undefined &&
      (typeof provenance.parentDigest !== "string" ||
        !DIGEST.test(provenance.parentDigest))
    )
      report(
        "INVALID_PROVENANCE",
        "plan.provenance.parentDigest",
        "Expected a lowercase SHA-256 digest.",
      );
  }

  // Style tokens and contrast.
  const style = record(plan.style, "plan.style", [
    "name",
    "paper",
    "ink",
    "accent",
    "muted",
    "headingFont",
    "bodyFont",
    "texture",
  ]);
  if (style) {
    text(style.name, "plan.style.name", PLAN_LIMITS.styleNameChars);
    let colors = true;
    for (const key of ["paper", "ink", "accent", "muted"])
      if (typeof style[key] !== "string" || !COLOR.test(style[key] as string)) {
        report(
          "INVALID_COLOR",
          `plan.style.${key}`,
          "Expected a lowercase #rrggbb color.",
        );
        colors = false;
      }
    if (!(HEADING_FONTS as readonly unknown[]).includes(style.headingFont))
      report("UNKNOWN_FONT", "plan.style.headingFont", "Font not allowlisted.");
    if (!(BODY_FONTS as readonly unknown[]).includes(style.bodyFont))
      report("UNKNOWN_FONT", "plan.style.bodyFont", "Font not allowlisted.");
    if (!(TEXTURES as readonly unknown[]).includes(style.texture))
      report(
        "UNKNOWN_TEXTURE",
        "plan.style.texture",
        "Texture not allowlisted.",
      );
    if (colors) {
      const paper = style.paper as string;
      const ink = contrastRatio(style.ink as string, paper);
      const accent = contrastRatio(style.accent as string, paper);
      if (ink < MIN_TEXT_CONTRAST)
        report(
          "LOW_CONTRAST",
          "plan.style.ink",
          `Ink on paper is ${ink.toFixed(2)}:1; minimum ${MIN_TEXT_CONTRAST}:1.`,
        );
      if (accent < MIN_DISPLAY_CONTRAST)
        report(
          "LOW_CONTRAST",
          "plan.style.accent",
          `Accent on paper is ${accent.toFixed(2)}:1; minimum ${MIN_DISPLAY_CONTRAST}:1.`,
        );
    }
  }

  // Pages, components and the refs they place.
  const authorized = new Set(context.authorizedAssets.map(refKey));
  const people = context.people ? new Set(context.people) : undefined;
  const componentIds = new Set<string>();
  const placed = new Map<string, string[]>();
  const place = (ref: AssetRef, path: string) => {
    const key = refKey(ref);
    placed.set(key, [...(placed.get(key) ?? []), path]);
    if (!authorized.has(key))
      report("UNKNOWN_ASSET", path, "Asset is not authorized for this plan.");
  };
  const empty = (path: string) => {
    if (!context.allowEmptySlots)
      report("EMPTY_SLOT", path, "Fill or remove this slot.");
  };

  const pages = Array.isArray(plan.pages) ? plan.pages : null;
  if (!pages) report("MALFORMED", "plan.pages", "Expected a list of pages.");
  else if (pages.length !== PAGE_COUNT)
    report("PAGE_COUNT", "plan.pages", `Expected exactly ${PAGE_COUNT} pages.`);
  (pages ?? []).slice(0, PAGE_COUNT * 2).forEach((value, p) => {
    const pagePath = `plan.pages[${p}]`;
    const page = record(value, pagePath, [
      "role",
      "layout",
      "widthMm",
      "heightMm",
      "components",
    ]);
    if (!page) return;
    if (!(PAGE_ROLES as readonly unknown[]).includes(page.role))
      report("UNKNOWN_PAGE_ROLE", `${pagePath}.role`, "Role not allowlisted.");
    if (!(PAGE_LAYOUTS as readonly unknown[]).includes(page.layout))
      report("UNKNOWN_LAYOUT", `${pagePath}.layout`, "Layout not allowlisted.");
    if (page.widthMm !== PAGE_WIDTH_MM || page.heightMm !== PAGE_HEIGHT_MM)
      report(
        "PAGE_FORMAT",
        pagePath,
        `Expected portrait A5 (${PAGE_WIDTH_MM} × ${PAGE_HEIGHT_MM} mm).`,
      );
    const components = list(
      page.components,
      `${pagePath}.components`,
      PLAN_LIMITS.componentsPerPage,
      "COMPONENT_LIMIT",
    );
    // A blank page is an unfilled draft, like an empty slot.
    if (Array.isArray(page.components) && !components.length)
      empty(`${pagePath}.components`);
    components.forEach((component, c) => {
      const path = `${pagePath}.components[${c}]`;
      if (!isObject(component)) {
        report("MALFORMED", path, "Expected an object.");
        return;
      }
      const kind = component.kind;
      if (!(COMPONENT_KINDS as readonly unknown[]).includes(kind)) {
        report(
          "UNKNOWN_COMPONENT",
          `${path}.kind`,
          "Component not allowlisted.",
        );
        return;
      }
      const hasAssets =
        kind === "cover" ||
        kind === "image" ||
        kind === "grid" ||
        kind === "collage";
      const hasText = kind !== "image" && kind !== "grid" && kind !== "collage";
      const r = record(component, path, [
        "id",
        "kind",
        "frame",
        ...(hasAssets ? ["assets"] : []),
        ...(hasText ? ["text"] : []),
      ]);
      if (!r) return;
      const componentId = id(r.id, `${path}.id`);
      if (componentId && componentIds.has(componentId))
        report("DUPLICATE_ID", `${path}.id`, "Component IDs must be unique.");
      if (componentId) componentIds.add(componentId);

      const f = isObject(r.frame) ? r.frame : undefined;
      const [x, y, w, h] = ["x", "y", "w", "h"].map((k) => f?.[k]) as number[];
      const frame =
        f &&
        Object.keys(f).sort().join(",") === "h,w,x,y" &&
        [x, y, w, h].every(Number.isSafeInteger) &&
        x >= 0 &&
        y >= 0 &&
        w >= PLAN_LIMITS.minFrameMm &&
        h >= PLAN_LIMITS.minFrameMm &&
        x + w <= PAGE_WIDTH_MM &&
        y + h <= PAGE_HEIGHT_MM
          ? { x, y, w, h }
          : undefined;
      if (!frame)
        report(
          "INVALID_BOUNDS",
          `${path}.frame`,
          `Expected whole millimetres inside the page, at least ${PLAN_LIMITS.minFrameMm} mm each way.`,
        );

      if (hasAssets) {
        const max =
          kind === "grid"
            ? PLAN_LIMITS.gridAssets
            : kind === "collage"
              ? PLAN_LIMITS.collageAssets
              : PLAN_LIMITS.imageAssets;
        const assets = Array.isArray(r.assets) ? r.assets : null;
        if (!assets) report("MALFORMED", `${path}.assets`, "Expected a list.");
        else if (assets.length > max)
          report(
            "COMPONENT_CONTENT",
            `${path}.assets`,
            `At most ${max} assets.`,
          );
        else if (!assets.length) empty(`${path}.assets`);
        const seen = new Set<string>();
        (assets ?? []).slice(0, max).forEach((value, a) => {
          const ref = assetRef(value, `${path}.assets[${a}]`);
          if (!ref) return;
          if (seen.has(refKey(ref)))
            report(
              "COMPONENT_CONTENT",
              `${path}.assets[${a}]`,
              "Duplicate asset.",
            );
          seen.add(refKey(ref));
          place(ref, `${path}.assets[${a}]`);
        });
      }

      if (hasText) {
        const textPath = `${path}.text`;
        const t = record(
          r.text,
          textPath,
          ["value"],
          ["creditId", "authored", "source"],
        );
        if (!t) return;
        const limitKind = kind as "cover" | TextKind;
        if (typeof t.value !== "string")
          report("MALFORMED", `${textPath}.value`, "Expected text.");
        else if (!t.value.trim()) empty(`${textPath}.value`);
        else if (codePoints(t.value) > TEXT_LIMITS[limitKind])
          report(
            "TEXT_OVERFLOW",
            `${textPath}.value`,
            `Longer than ${TEXT_LIMITS[limitKind]} characters.`,
          );
        else if (frame && !textFits(limitKind, frame, t.value))
          report(
            "TEXT_OVERFLOW",
            `${textPath}.value`,
            "Text does not fit its frame.",
          );
        if (t.creditId !== undefined) {
          const credit = id(t.creditId, `${textPath}.creditId`);
          if (credit && people && !people.has(credit))
            report(
              "UNKNOWN_PERSON",
              `${textPath}.creditId`,
              "Not a known person.",
            );
        }
        if (t.authored !== undefined && t.authored !== true)
          report(
            "MALFORMED",
            `${textPath}.authored`,
            "Expected true or absent.",
          );
        const hasWords = typeof t.value === "string" && !!t.value.trim();
        if (kind === "quote" && hasWords && t.creditId === undefined)
          report(
            "ATTRIBUTION_REQUIRED",
            `${textPath}.creditId`,
            "Quotes need a credited speaker.",
          );
        if (t.source !== undefined) {
          const s = record(
            t.source,
            `${textPath}.source`,
            ["asset"],
            ["startMs", "endMs"],
          );
          if (s) {
            const ref = assetRef(s.asset, `${textPath}.source.asset`);
            if (ref) place(ref, `${textPath}.source.asset`);
            if (s.startMs !== undefined || s.endMs !== undefined) {
              if (
                !Number.isSafeInteger(s.startMs) ||
                !Number.isSafeInteger(s.endMs) ||
                (s.startMs as number) < 0 ||
                (s.endMs as number) <= (s.startMs as number)
              )
                report(
                  "INVALID_TIME_RANGE",
                  `${textPath}.source`,
                  "Expected 0 ≤ startMs < endMs.",
                );
              if (t.creditId === undefined)
                report(
                  "ATTRIBUTION_REQUIRED",
                  `${textPath}.creditId`,
                  "Excerpts need a credited speaker.",
                );
            }
          }
        }
      }
    });
  });

  // Influence closure: visible equals placed refs; style holds the rest.
  const influence = record(plan.influence, "plan.influence", [
    "visible",
    "style",
  ]);
  if (influence) {
    const declared = new Set<string>();
    const visible = new Set<string>();
    for (const key of ["visible", "style"] as const) {
      list(
        influence[key],
        `plan.influence.${key}`,
        PLAN_LIMITS.closureRefs,
        "CLOSURE_INVALID",
      ).forEach((value, i) => {
        const path = `plan.influence.${key}[${i}]`;
        const ref = assetRef(value, path);
        if (!ref) return;
        const k = refKey(ref);
        if (declared.has(k))
          report(
            "CLOSURE_INVALID",
            path,
            "Each ref appears once in the closure.",
          );
        declared.add(k);
        if (key === "visible") {
          visible.add(k);
          if (!placed.has(k))
            report(
              "CLOSURE_INVALID",
              path,
              "Not placed on a page; move it to style.",
            );
        } else if (!authorized.has(k))
          report(
            "UNKNOWN_ASSET",
            path,
            "Asset is not authorized for this plan.",
          );
      });
    }
    for (const [k, paths] of placed)
      if (!visible.has(k))
        for (const path of paths)
          report(
            "INFLUENCE_MISSING",
            path,
            "Placed asset is missing from influence.visible.",
          );
  }

  if (plan.inspiration !== undefined) {
    const inspiration = record(
      plan.inspiration,
      "plan.inspiration",
      ["rationale"],
      ["prompt"],
    );
    if (inspiration) {
      text(
        inspiration.rationale,
        "plan.inspiration.rationale",
        PLAN_LIMITS.rationaleChars,
      );
      if (inspiration.prompt !== undefined)
        text(
          inspiration.prompt,
          "plan.inspiration.prompt",
          PLAN_LIMITS.promptChars,
        );
    }
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, plan: input as DesignPlan, errors: [] };
}
