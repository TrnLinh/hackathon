import {
  refKey,
  type AssetRef,
  type InfluenceClosure,
  type PlanPage,
} from "./schema";

function unique(refs: readonly AssetRef[]) {
  const byKey = new Map(refs.map((ref) => [refKey(ref), ref]));
  return [...byKey.keys()].sort().map((key) => ({ ...byKey.get(key)! }));
}

/** Every asset placed on a page, including the sources of quoted text. */
export function pageRefs(pages: readonly PlanPage[]): AssetRef[] {
  return unique(
    pages.flatMap((page) =>
      page.components.flatMap((c) => [
        ...("assets" in c ? c.assets : []),
        ...("text" in c && c.text.source ? [c.text.source.asset] : []),
      ]),
    ),
  );
}

/**
 * Sorted closure for `pages`. Any retained ref that is not placed stays as
 * style influence, so edits can move but never drop a dependency.
 */
export function influenceClosure(
  pages: readonly PlanPage[],
  retained: readonly AssetRef[] = [],
): InfluenceClosure {
  const visible = pageRefs(pages);
  const placed = new Set(visible.map(refKey));
  return {
    visible,
    style: unique(retained).filter((ref) => !placed.has(refKey(ref))),
  };
}
