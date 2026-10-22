import { canonicalJson, commitment } from "../consent/manifest";
import { influenceClosure } from "./closure";
import {
  PLAN_COMPONENT_VERSION,
  PLAN_SCHEMA_VERSION,
  refKey,
  type AssetRef,
  type Component,
  type DesignPlan,
  type Inspiration,
  type PlanOrigin,
  type PlanPage,
  type PlanText,
  type StyleTokens,
} from "./schema";
import {
  validatePlan,
  type PlanError,
  type ValidationContext,
} from "./validate";

// Commitments use the chorus-manifest/v1 canonical JSON. Set-valued fields
// (closure refs, AI jobs) are sorted so order never changes a digest; page
// and component order are content and stay as written.

const byKey = (a: AssetRef, b: AssetRef) =>
  refKey(a) < refKey(b) ? -1 : refKey(a) > refKey(b) ? 1 : 0;

/** Copies `keys` that are present and defined; nothing else is committed. */
function pick<T extends object, K extends keyof T>(value: T, keys: K[]) {
  const result = {} as Pick<T, K>;
  for (const key of keys)
    if (value[key] !== undefined) result[key] = value[key];
  return result;
}
const ref = (r: AssetRef): AssetRef => pick(r, ["kind", "id"]);
function origin(o: PlanOrigin): PlanOrigin {
  if (o.kind === "template")
    return pick(o, ["kind", "templateId", "templateVersion"]);
  if (o.kind === "ai") return pick(o, ["kind", "jobId", "modelVersion"]);
  return { kind: o.kind };
}
function text(t: PlanText): PlanText {
  return {
    ...pick(t, ["value", "creditId", "authored"]),
    ...(t.source
      ? {
          source: {
            asset: ref(t.source.asset),
            ...pick(t.source, ["startMs", "endMs"]),
          },
        }
      : {}),
  };
}
function component(c: Component): Component {
  return {
    ...pick(c, ["id", "kind"]),
    frame: pick(c.frame, ["x", "y", "w", "h"]),
    ...("assets" in c ? { assets: c.assets.map(ref) } : {}),
    ...("text" in c ? { text: text(c.text) } : {}),
  } as Component;
}

/**
 * Schema fields only, with sets sorted. Unknown or undefined fields never
 * reach the bytes, so a digest always describes exactly what was validated.
 */
export function canonicalPlan(plan: DesignPlan): DesignPlan {
  return {
    ...pick(plan, ["schemaVersion", "componentVersion"]),
    provenance: {
      creationOrigin: origin(plan.provenance.creationOrigin),
      revisionOrigin: origin(plan.provenance.revisionOrigin),
      ...pick(plan.provenance, ["parentDigest"]),
      aiJobs: plan.provenance.aiJobs
        .map((job) => pick(job, ["jobId", "modelVersion"]))
        .sort((a, b) => (a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0)),
    },
    style: pick(plan.style, [
      "name",
      "paper",
      "ink",
      "accent",
      "muted",
      "headingFont",
      "bodyFont",
      "texture",
    ]),
    pages: plan.pages.map((page) => ({
      ...pick(page, ["role", "layout", "widthMm", "heightMm"]),
      components: page.components.map(component),
    })),
    influence: {
      visible: plan.influence.visible.map(ref).sort(byKey),
      style: plan.influence.style.map(ref).sort(byKey),
    },
    ...(plan.inspiration
      ? { inspiration: pick(plan.inspiration, ["rationale", "prompt"]) }
      : {}),
  };
}

/** Exact UTF-8 bytes to encrypt into a plan payload. */
export function planBytes(plan: DesignPlan): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(canonicalJson(canonicalPlan(plan)));
}

/** SHA-256 of `planBytes`: the `contentDigest` stored with the revision. */
export function planDigest(plan: DesignPlan): Promise<string> {
  return commitment(canonicalPlan(plan));
}

/**
 * Validates, then returns the bytes and digest to save or freeze (CH-10).
 * Unknown fields, including operational flags, fail validation, so they
 * can never enter a commitment.
 */
export async function commitPlan(
  input: unknown,
  context: ValidationContext,
): Promise<
  | {
      ok: true;
      plan: DesignPlan;
      bytes: Uint8Array<ArrayBuffer>;
      digest: string;
    }
  | { ok: false; errors: PlanError[] }
> {
  const result = validatePlan(input, context);
  if (!result.ok) return result;
  const plan = canonicalPlan(result.plan);
  return {
    ok: true,
    plan,
    bytes: planBytes(plan),
    digest: await planDigest(plan),
  };
}

export type ManualEdit = {
  pages?: PlanPage[];
  style?: StyleTokens;
  /** `null` removes the inspiration text; provenance is unaffected. */
  inspiration?: Inspiration | null;
};

/**
 * Child revision for a manual edit or "Continue manually". Keeps the root
 * origin and AI job lineage, links the parent digest, and retains every
 * parent dependency: refs no longer placed move to style influence.
 */
export async function reviseManually(
  parent: DesignPlan,
  edit: ManualEdit,
): Promise<DesignPlan> {
  const pages = structuredClone(edit.pages ?? parent.pages);
  const inspiration =
    edit.inspiration === null
      ? undefined
      : (edit.inspiration ?? parent.inspiration);
  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    componentVersion: PLAN_COMPONENT_VERSION,
    provenance: {
      creationOrigin: structuredClone(parent.provenance.creationOrigin),
      revisionOrigin: { kind: "manual" },
      parentDigest: await planDigest(parent),
      aiJobs: structuredClone(parent.provenance.aiJobs),
    },
    style: { ...(edit.style ?? parent.style) },
    pages,
    influence: influenceClosure(pages, [
      ...parent.influence.visible,
      ...parent.influence.style,
    ]),
    ...(inspiration ? { inspiration: { ...inspiration } } : {}),
  };
}
