import { canonicalJson, commitment } from "../consent/manifest";
import { influenceClosure } from "./closure";
import {
  PLAN_COMPONENT_VERSION,
  PLAN_SCHEMA_VERSION,
  refKey,
  type AssetRef,
  type DesignPlan,
  type Inspiration,
  type PlanPage,
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

export function canonicalPlan(plan: DesignPlan): DesignPlan {
  return {
    ...plan,
    provenance: {
      ...plan.provenance,
      aiJobs: [...plan.provenance.aiJobs].sort((a, b) =>
        a.jobId < b.jobId ? -1 : a.jobId > b.jobId ? 1 : 0,
      ),
    },
    influence: {
      visible: [...plan.influence.visible].sort(byKey),
      style: [...plan.influence.style].sort(byKey),
    },
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
