import type { Font as FontkitFont } from "@pdf-lib/fontkit";
import type { PDFFont } from "pdf-lib";
import { RenderError } from "./errors";
import type { FontId } from "./fonts";

// Plain-text line breaking and fitting. Text is data: nothing is parsed as
// markup, and every code point must exist in the pinned font, otherwise the
// render fails instead of drawing missing glyphs. Only +, -, * and / are
// used so results are identical in every JavaScript engine.

export type Face = { id: FontId; pdf: PDFFont; metrics: FontkitFont };

/** Contract line height (`textFits` in the design-plan schema). */
export const LINE_HEIGHT = 1.25;
/** The renderer may shrink text to this fraction of nominal, never enlarge it. */
export const MIN_SCALE = 0.5;
const SHRINK = 0.95;
const LINE_BREAK = /\r\n|[\n\r\u2028\u2029]/;

/** One run of text in a block, sized relative to the block's size. */
export type TextPart = {
  text: string;
  face: Face;
  /** Size relative to the block size (1 = block size). */
  scale: number;
  /** Extra space above this part, in block-size ems. */
  gapBefore?: number;
};

export type PlacedLine = {
  text: string;
  face: Face;
  size: number;
  /** Baseline distance from the top of the box. */
  baseline: number;
};

export function prepareText(value: string, face: Face, where: string) {
  const text = value.normalize("NFC");
  for (const char of text) {
    if (LINE_BREAK.test(char)) continue;
    const cp = char.codePointAt(0)!;
    if (!face.metrics.hasGlyphForCodePoint(cp))
      throw new RenderError(
        "UNSUPPORTED_CHARACTER",
        `${where}: U+${cp.toString(16).toUpperCase().padStart(4, "0")} is not in the pinned ${face.id} font.`,
      );
  }
  return text;
}

function width(face: Face, text: string, size: number) {
  return face.pdf.widthOfTextAtSize(text, size);
}

/** Greedy word wrap; runs of spaces collapse and over-long words break. */
export function wrap(text: string, face: Face, size: number, max: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(LINE_BREAK)) {
    const words = paragraph.split(" ").filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (width(face, candidate, size) <= max) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      if (width(face, word, size) <= max) {
        line = word;
        continue;
      }
      // A word wider than the line breaks between code points.
      for (const char of Array.from(word)) {
        const next = line + char;
        if (line && width(face, next, size) > max) {
          lines.push(line);
          line = char;
        } else line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

function ascentRatio(face: Face) {
  const { ascent, descent } = face.metrics;
  return ascent / (ascent - descent);
}

function layout(parts: TextPart[], size: number, maxWidth: number) {
  const lines: PlacedLine[] = [];
  let top = 0;
  for (const part of parts) {
    const partSize = size * part.scale;
    const lineHeight = partSize * LINE_HEIGHT;
    if (lines.length) top += (part.gapBefore ?? 0) * size;
    for (const text of wrap(part.text, part.face, partSize, maxWidth)) {
      lines.push({
        text,
        face: part.face,
        size: partSize,
        baseline:
          top + (lineHeight - partSize) / 2 + partSize * ascentRatio(part.face),
      });
      top += lineHeight;
    }
  }
  return { lines, height: top };
}

/**
 * Lays the parts out at the nominal size, shrinking in fixed steps until
 * they fit `width` × `height` (points). Never clips: if the text cannot fit
 * at `MIN_SCALE` the render fails with `TEXT_OVERFLOW` (NFR-03).
 */
export function fitText(
  parts: TextPart[],
  nominal: number,
  box: { width: number; height: number },
  where: string,
) {
  for (let scale = 1; scale >= MIN_SCALE; scale *= SHRINK) {
    const size = nominal * scale;
    const result = layout(parts, size, box.width);
    const fitsWidth = result.lines.every(
      (line) => width(line.face, line.text, line.size) <= box.width,
    );
    if (fitsWidth && result.height <= box.height) return { size, ...result };
  }
  throw new RenderError(
    "TEXT_OVERFLOW",
    `${where}: text does not fit its frame at ${MIN_SCALE * 100}% of the nominal size.`,
  );
}
