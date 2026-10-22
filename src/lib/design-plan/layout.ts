import {
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  reservedHeight,
  TEXT_KINDS,
  type ComponentKind,
  type Frame,
  type PageLayout,
  type TextKind,
} from "./schema";

// Deterministic frames for a page layout. Templates and the prototype
// adapter use the same arithmetic, so equal content gives equal geometry.

const MARGIN = 12;
const GAP = 4;
const WEIGHT: Record<ComponentKind, number> = {
  cover: 10,
  image: 6,
  grid: 8,
  collage: 8,
  heading: 2,
  quote: 3,
  caption: 2,
  note: 5,
};

const MIN_VISUAL = 24;
const hasAssets = (kind: ComponentKind) =>
  kind === "cover" || kind === "image" || kind === "grid" || kind === "collage";

function heights(
  space: number,
  reserved: number[],
  weights: number[],
): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  const free = space - reserved.reduce((sum, h) => sum + h, 0);
  return reserved.map((h, i) => h + Math.floor((free * weights[i]) / total));
}

/**
 * Each text component first gets the height its longest allowed text needs
 * (`reservedHeight`); the rest goes to photos by weight, or to the text when
 * there are none. If that leaves photos too small, every component shares
 * the space by weight and over-long text fails validation instead.
 */
function stack(box: Frame, kinds: readonly ComponentKind[]): Frame[] {
  const space = box.h - GAP * (kinds.length - 1);
  const visual = kinds.some(hasAssets);
  let result = heights(
    space,
    kinds.map((k) =>
      k === "cover" || TEXT_KINDS.includes(k as TextKind)
        ? reservedHeight(k as "cover" | TextKind, box.w)
        : 0,
    ),
    kinds.map((k) => (!visual || hasAssets(k) ? WEIGHT[k] : 0)),
  );
  if (
    result.some(
      (h, i) => !Number.isFinite(h) || (hasAssets(kinds[i]) && h < MIN_VISUAL),
    )
  )
    result = heights(
      space,
      kinds.map(() => 0),
      kinds.map((k) => WEIGHT[k]),
    );
  let y = box.y;
  return kinds.map((_, i) => {
    const h = i === kinds.length - 1 ? box.y + box.h - y : result[i];
    const frame = { x: box.x, y, w: box.w, h };
    y += h + GAP;
    return frame;
  });
}

/**
 * A single component on a `full` page bleeds to the edges; `split` stacks
 * the first half of the components left and the rest right; every other
 * layout stacks inside the margins.
 */
export function layoutFrames(
  layout: PageLayout,
  kinds: readonly ComponentKind[],
): Frame[] {
  if (!kinds.length) return [];
  if (layout === "full" && kinds.length === 1)
    return [{ x: 0, y: 0, w: PAGE_WIDTH_MM, h: PAGE_HEIGHT_MM }];
  const box = {
    x: MARGIN,
    y: MARGIN,
    w: PAGE_WIDTH_MM - 2 * MARGIN,
    h: PAGE_HEIGHT_MM - 2 * MARGIN,
  };
  if (layout !== "split" || kinds.length === 1) return stack(box, kinds);
  const half = Math.ceil(kinds.length / 2);
  const w = Math.floor((box.w - GAP) / 2);
  return [
    ...stack({ ...box, w }, kinds.slice(0, half)),
    ...stack({ ...box, x: box.x + w + GAP, w }, kinds.slice(half)),
  ];
}
