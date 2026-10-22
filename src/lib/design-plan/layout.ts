import {
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  type ComponentKind,
  type Frame,
  type PageLayout,
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

function stack(box: Frame, kinds: readonly ComponentKind[]): Frame[] {
  const total = kinds.reduce((sum, kind) => sum + WEIGHT[kind], 0);
  const free = box.h - GAP * (kinds.length - 1);
  let y = box.y;
  return kinds.map((kind, i) => {
    const h =
      i === kinds.length - 1
        ? box.y + box.h - y
        : Math.floor((free * WEIGHT[kind]) / total);
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
