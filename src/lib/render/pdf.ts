import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  clip,
  concatTransformationMatrix,
  endPath,
  fill,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingRgbColor,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
  type PDFImage,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import {
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  TYPE_SIZE_MM,
  refKey,
  type AssetRef,
  type Component,
  type DesignPlan,
  type Frame,
  type PlanText,
  type StyleTokens,
  type TextKind,
} from "../design-plan/schema";
import { validatePlan, type ValidationContext } from "../design-plan/validate";
import { RenderError } from "./errors";
import {
  BODY_FACE,
  BODY_ITALIC_FACE,
  HEADING_FACE,
  fontVersion,
  loadFont,
  pinnedFont,
  quoteFace,
  sha256Hex,
  type FontId,
} from "./fonts";
import { fitText, prepareText, type Face, type TextPart } from "./text";
import {
  RENDERER_COMPONENT_VERSIONS,
  RENDERER_EPOCH,
  RENDERER_VERSION,
} from "./version";

// CH-10 renderer: one validated DesignPlan to six A5 PDF pages through
// pinned components and fonts. Framework-free so the browser freeze step
// and Node tests share it. Plans are data: text is drawn literally, assets
// come only from the caller's decrypted map, and nothing is fetched.

export type RenderAsset = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
};

export type RenderOptions = {
  /**
   * The context the freeze step passed to `commitPlan`. Defaults to the
   * refs in `assets` with no people check; pass the backend's authorized
   * list when the plan has text sources (recordings) or style-only refs.
   */
  context?: Omit<ValidationContext, "allowEmptySlots">;
  /** Display names printed for `creditId`s. Every credited text needs one. */
  credits?: ReadonlyMap<string, string>;
  /** Edition identifier written to the PDF Subject (FR-25). */
  editionId?: string;
};

export type RenderResult = {
  bytes: Uint8Array;
  /** Lowercase SHA-256 hex of `bytes`: the candidate's `pdfDigest`. */
  digest: string;
  rendererVersion: string;
  /** Sorted, one per embedded font: `PostScriptName@version+sha256:<hex>`. */
  fontVersions: string[];
};

const MM = 72 / 25.4;
const mm = (value: number) => value * MM;
const PAGE_W = mm(PAGE_WIDTH_MM);
const PAGE_H = mm(PAGE_HEIGHT_MM);
const GAP = mm(2.5);
const EDITION_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const WHITE: Rgb = [1, 1, 1];
/** cos/sin of whole-degree tilts, as literals so no engine-specific Math.cos. */
const TILT: Record<number, [number, number]> = {
  [-8]: [0.9902680687415704, -0.13917310096006544],
  [-6]: [0.9945218953682733, -0.10452846326765347],
  [-2]: [0.9993908270190958, -0.03489949670250097],
  4: [0.9975640502598242, 0.0697564737441253],
  7: [0.992546151641322, 0.12186934340514748],
};
const COLLAGE_TILT = [-6, 4, -2, 7];
const COLLAGE_LEFT = [0.02, 0.42, 0.06, 0.46];
const COLLAGE_TOP = [0, 0.22, 0.08, 0.3];

type Rgb = [number, number, number];
/** Box in PDF points, origin bottom left. */
type Box = { x: number; y: number; w: number; h: number };

/** Three decimals keep streams compact and identical across engines. */
const r = (value: number) => Math.round(value * 1000) / 1000;

function hex(color: string): Rgb {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
/** `a` blended toward `b` by `t` (0 keeps `a`). */
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const color = (c: Rgb): RGB => rgb(r(c[0]), r(c[1]), r(c[2]));

function toBox(frame: Frame): Box {
  return {
    x: mm(frame.x),
    y: PAGE_H - mm(frame.y + frame.h),
    w: mm(frame.w),
    h: mm(frame.h),
  };
}

function parseRef(key: string): AssetRef | null {
  const at = key.indexOf(":");
  const kind = key.slice(0, at);
  if (kind !== "version" && kind !== "derivative") return null;
  return { kind, id: key.slice(at + 1) };
}

function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
/** Rejects PNGs whose header declares more than 24 megapixels (decode bomb). */
function pngWithinLimit(bytes: Uint8Array) {
  if (bytes.length < 24) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 && width * height <= 24_000_000;
}
function isPng(bytes: Uint8Array) {
  const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return magic.every((byte, i) => bytes[i] === byte);
}

/**
 * pdf-lib embeds JPEG bytes verbatim (DCTDecode), so rebuild the file from
 * only the segments needed to decode it: drop metadata (APP1-APP13, APP15:
 * EXIF/GPS, XMP, ICC, maker notes; COM comments), including between the scans
 * of a progressive JPEG, and stop at the end-of-image marker so trailing data
 * (multi-picture EXIF, gain maps, motion-photo video) never reaches the PDF.
 * APP0 (JFIF) and APP14 (Adobe colour transform) affect decoding and stay.
 * Returns null for anything malformed or without an end-of-image marker.
 * PNGs are decoded and re-encoded by pdf-lib, so their chunks never reach it.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  const keep: Uint8Array[] = [bytes.subarray(0, 2)];
  const finish = () => {
    const out = new Uint8Array(keep.reduce((n, part) => n + part.length, 0));
    let offset = 0;
    for (const part of keep) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  };
  let i = 2;
  while (i + 2 <= bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xd9) {
      keep.push(bytes.subarray(i, i + 2));
      return finish(); // anything after end-of-image is dropped
    }
    if (i + 4 > bytes.length) return null;
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2 || i + 2 + length > bytes.length) return null;
    const metadata =
      (marker >= 0xe1 && marker <= 0xed) || marker === 0xef || marker === 0xfe;
    if (!metadata) keep.push(bytes.subarray(i, i + 2 + length));
    i += 2 + length;
    if (marker === 0xda) {
      // Entropy-coded data runs until the next real marker: FF00 is a
      // stuffed byte and FFD0-FFD7 are restart markers inside the scan.
      let j = i;
      while (
        j + 1 < bytes.length &&
        !(
          bytes[j] === 0xff &&
          bytes[j + 1] !== 0x00 &&
          !(bytes[j + 1] >= 0xd0 && bytes[j + 1] <= 0xd7)
        )
      )
        j += 1;
      if (j + 1 >= bytes.length) return null;
      keep.push(bytes.subarray(i, j));
      i = j;
    }
  }
  return null;
}

function imageRefs(component: Component): AssetRef[] {
  return "assets" in component ? component.assets : [];
}

function formatMs(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Validates everything before any drawing so failures never leave partial output. */
function preflight(
  plan: DesignPlan,
  assets: ReadonlyMap<string, RenderAsset>,
  options: RenderOptions,
) {
  const authorizedAssets =
    options.context?.authorizedAssets ??
    [...assets.keys()].map(parseRef).filter((ref) => ref !== null);
  const people =
    options.context?.people ??
    (options.credits ? [...options.credits.keys()] : undefined);
  const result = validatePlan(plan, { authorizedAssets, people });
  if (!result.ok)
    throw new RenderError(
      "INVALID_PLAN",
      `Plan failed validation: ${[...new Set(result.errors.map((e) => e.code))].join(", ")}.`,
      result.errors,
    );
  const valid = result.plan;
  if (!RENDERER_COMPONENT_VERSIONS.includes(valid.componentVersion))
    throw new RenderError(
      "INVALID_PLAN",
      `Renderer does not draw ${valid.componentVersion}.`,
    );
  const components = valid.pages.flatMap((page) => page.components);
  const missing = new Set<string>();
  const images = new Map<string, RenderAsset>();
  for (const ref of components.flatMap(imageRefs)) {
    const key = refKey(ref);
    const asset = assets.get(key);
    if (!asset) {
      missing.add(key);
      continue;
    }
    const ok =
      asset.bytes instanceof Uint8Array &&
      ((asset.mimeType === "image/jpeg" && isJpeg(asset.bytes)) ||
        (asset.mimeType === "image/png" &&
          isPng(asset.bytes) &&
          pngWithinLimit(asset.bytes)));
    const bytes = !ok
      ? null
      : asset.mimeType === "image/jpeg"
        ? stripJpegMetadata(asset.bytes)
        : asset.bytes;
    if (!bytes)
      throw new RenderError(
        "INVALID_ASSET",
        `Asset ${key} is not a ${asset.mimeType} image.`,
      );
    images.set(key, { bytes, mimeType: asset.mimeType });
  }
  if (missing.size)
    throw new RenderError(
      "MISSING_ASSET",
      `Missing decrypted image for ${[...missing].sort().join(", ")}.`,
    );
  for (const component of components) {
    const creditId = "text" in component ? component.text.creditId : undefined;
    if (creditId && !options.credits?.get(creditId)?.trim())
      throw new RenderError(
        "MISSING_CREDIT",
        `${component.id}: no display name for ${creditId}.`,
      );
  }
  if (options.editionId !== undefined && !EDITION_ID.test(options.editionId))
    throw new RenderError("INVALID_PLAN", "Invalid edition identifier.");
  return { plan: valid, images };
}

class Renderer {
  private faces = new Map<FontId, Face>();
  private images = new Map<string, PDFImage>();
  private paper: Rgb;
  private ink: Rgb;
  private accent: Rgb;
  private muted: Rgb;

  constructor(
    private doc: PDFDocument,
    private style: StyleTokens,
    private assets: ReadonlyMap<string, RenderAsset>,
    private credits: ReadonlyMap<string, string> | undefined,
  ) {
    this.paper = hex(style.paper);
    this.ink = hex(style.ink);
    this.accent = hex(style.accent);
    this.muted = hex(style.muted);
  }

  /** Fonts embed on first use, so embedding order follows the plan. */
  private async face(id: FontId): Promise<Face> {
    const known = this.faces.get(id);
    if (known) return known;
    const bytes = await loadFont(id);
    const face: Face = {
      id,
      pdf: await this.doc.embedFont(bytes, { subset: true }),
      metrics: fontkit.create(bytes),
    };
    this.faces.set(id, face);
    return face;
  }

  fontVersions() {
    return [...this.faces.keys()]
      .map((id) => fontVersion(pinnedFont(id)))
      .sort();
  }

  private async image(ref: AssetRef): Promise<PDFImage> {
    const key = refKey(ref);
    const known = this.images.get(key);
    if (known) return known;
    const asset = this.assets.get(key)!;
    let image: PDFImage;
    try {
      image =
        asset.mimeType === "image/png"
          ? await this.doc.embedPng(asset.bytes)
          : await this.doc.embedJpg(asset.bytes);
    } catch {
      throw new RenderError(
        "INVALID_ASSET",
        `Asset ${key} could not be decoded.`,
      );
    }
    this.images.set(key, image);
    return image;
  }

  async page(index: number, components: Component[], isCover: boolean) {
    const page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.fillRect(page, { x: 0, y: 0, w: PAGE_W, h: PAGE_H }, this.paper);
    this.texture(page, index);
    for (const component of components) await this.component(page, component);
    if (!isCover) {
      const face = await this.face(BODY_FACE[this.style.bodyFont]);
      const label = String(index + 1);
      const size = 7;
      page.drawText(label, {
        x: r(PAGE_W - mm(6) - face.pdf.widthOfTextAtSize(label, size)),
        y: r(mm(4.5)),
        size,
        font: face.pdf,
        color: color(mix(this.ink, this.paper, 0.45)),
      });
    }
  }

  private fillRect(page: PDFPage, box: Box, c: Rgb) {
    page.pushOperators(
      pushGraphicsState(),
      setFillingRgbColor(r(c[0]), r(c[1]), r(c[2])),
      rectangle(r(box.x), r(box.y), r(box.w), r(box.h)),
      fill(),
      popGraphicsState(),
    );
  }

  /** Paper texture behind the components, as in the prototype preview. */
  private texture(page: PDFPage, index: number) {
    if (this.style.texture === "film") {
      const c = this.muted;
      const x = PAGE_W * 0.03;
      const y = PAGE_H * 0.03;
      page.pushOperators(
        pushGraphicsState(),
        setStrokingRgbColor(r(c[0]), r(c[1]), r(c[2])),
        setLineWidth(0.75),
        rectangle(r(x), r(y), r(PAGE_W - 2 * x), r(PAGE_H - 2 * y)),
        stroke(),
        popGraphicsState(),
      );
    }
    if (this.style.texture === "grain") {
      // Deterministic speckle (mulberry32 on integers) seeded by page index.
      let seed = (0x9e3779b9 ^ (index + 1)) >>> 0;
      const next = () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      const c = mix(this.paper, this.ink, 0.12);
      const ops = [];
      for (let i = 0; i < 900; i++) {
        const size = 0.4 + next() * 0.6;
        ops.push(
          rectangle(r(next() * PAGE_W), r(next() * PAGE_H), r(size), r(size)),
        );
      }
      page.pushOperators(
        pushGraphicsState(),
        setFillingRgbColor(r(c[0]), r(c[1]), r(c[2])),
        ...ops,
        fill(),
        popGraphicsState(),
      );
    }
  }

  private async component(page: PDFPage, component: Component) {
    const box = toBox(component.frame);
    switch (component.kind) {
      case "cover":
        return this.cover(
          page,
          box,
          component.id,
          component.assets,
          component.text,
        );
      case "image": {
        await this.photo(page, component.assets[0], box);
        if (this.style.texture === "tape")
          await this.tape(
            page,
            box.x + box.w * 0.35,
            box.y + box.h - mm(1.5),
            box.w,
          );
        return;
      }
      case "grid":
        return this.grid(page, box, component.assets);
      case "collage":
        return this.collage(page, box, component.assets);
      default:
        return this.text(
          page,
          box,
          component.id,
          component.kind,
          component.text,
        );
    }
  }

  /** Cover-crops an image into `box` and clips it there. */
  private async photo(page: PDFPage, ref: AssetRef, box: Box) {
    const image = await this.image(ref);
    const scale = Math.max(box.w / image.width, box.h / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.pushOperators(
      pushGraphicsState(),
      rectangle(r(box.x), r(box.y), r(box.w), r(box.h)),
      clip(),
      endPath(),
    );
    page.drawImage(image, {
      x: r(box.x + (box.w - w) / 2),
      y: r(box.y + (box.h - h) / 2),
      width: r(w),
      height: r(h),
    });
    page.pushOperators(popGraphicsState());
  }

  /** Runs `draw` in a coordinate system centred on (cx, cy) and tilted. */
  private async tilted(
    page: PDFPage,
    cx: number,
    cy: number,
    degrees: number,
    draw: () => Promise<void> | void,
  ) {
    // CSS rotate() is clockwise with y down; PDF y points up, so negate.
    const [cos, sin] = TILT[degrees];
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(1, 0, 0, 1, r(cx), r(cy)),
      concatTransformationMatrix(cos, -sin, sin, cos, 0, 0),
    );
    await draw();
    page.pushOperators(popGraphicsState());
  }

  private tape(page: PDFPage, left: number, top: number, width: number) {
    const w = Math.min(mm(24), width * 0.3);
    const h = mm(6);
    const c = mix(this.muted, WHITE, 0.45);
    return this.tilted(page, left + w / 2, top, -8, () =>
      this.fillRect(page, { x: -w / 2, y: -h / 2, w, h }, c),
    );
  }

  private async grid(page: PDFPage, box: Box, refs: AssetRef[]) {
    const cols = refs.length <= 1 ? 1 : refs.length <= 4 ? 2 : 3;
    const rows = Math.ceil(refs.length / cols);
    const w = (box.w - GAP * (cols - 1)) / cols;
    const h = (box.h - GAP * (rows - 1)) / rows;
    for (let i = 0; i < refs.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      await this.photo(page, refs[i], {
        x: box.x + col * (w + GAP),
        y: box.y + box.h - (row + 1) * h - row * GAP,
        w,
        h,
      });
    }
  }

  /** Tilted white prints like the prototype collage, clipped to the frame. */
  private async collage(page: PDFPage, box: Box, refs: AssetRef[]) {
    const pad = 0.03;
    const foot = 0.1;
    // Card is w wide and w * (1 - 2 pad + pad + foot) tall (square photo).
    const tall = 1 - pad + foot;
    const w = Math.min(box.w * 0.52, (box.h * 0.7) / tall);
    const h = w * tall;
    const single = refs.length === 1;
    const shadow = mix(this.paper, this.ink, 0.18);
    page.pushOperators(
      pushGraphicsState(),
      rectangle(r(box.x), r(box.y), r(box.w), r(box.h)),
      clip(),
      endPath(),
    );
    for (let i = 0; i < refs.length; i++) {
      const left = single ? (box.w - w) / 2 : COLLAGE_LEFT[i] * box.w;
      const top = single
        ? (box.h - h) / 2
        : (COLLAGE_TOP[i] / 0.3) * (box.h - h);
      const cx = box.x + left + w / 2;
      const cy = box.y + box.h - top - h / 2;
      await this.tilted(page, cx, cy, COLLAGE_TILT[i], async () => {
        this.fillRect(
          page,
          { x: -w / 2 + mm(0.4), y: -h / 2 - mm(0.6), w, h },
          shadow,
        );
        this.fillRect(page, { x: -w / 2, y: -h / 2, w, h }, WHITE);
        const p = w * pad;
        const side = w - 2 * p;
        await this.photo(page, refs[i], {
          x: -w / 2 + p,
          y: h / 2 - p - side,
          w: side,
          h: side,
        });
      });
    }
    page.pushOperators(popGraphicsState());
  }

  private attribution(text: PlanText) {
    if (!text.creditId) return null;
    const name = this.credits!.get(text.creditId)!.trim();
    const start = text.source?.startMs;
    return start === undefined ? `— ${name}` : `— ${name}, ${formatMs(start)}`;
  }

  private drawLines(
    page: PDFPage,
    lines: { text: string; face: Face; size: number; baseline: number }[],
    left: number,
    top: number,
    fill: (face: Face) => Rgb,
  ) {
    for (const line of lines) {
      if (!line.text) continue;
      page.drawText(line.text, {
        x: r(left),
        y: r(top - line.baseline),
        size: r(line.size),
        font: line.face.pdf,
        color: color(fill(line.face)),
      });
    }
  }

  private async headingFace() {
    return this.face(HEADING_FACE[this.style.headingFont]);
  }
  private headingText(value: string) {
    return this.style.headingFont === "grotesk" ? value.toUpperCase() : value;
  }

  private async cover(
    page: PDFPage,
    box: Box,
    id: string,
    refs: AssetRef[],
    text: PlanText,
  ) {
    const face = await this.headingFace();
    const value = prepareText(this.headingText(text.value), face, id);
    const side = box.w * 0.06;
    const topInset = box.h * 0.06;
    const bottomInset = box.h * 0.07;
    const room = box.h - topInset - bottomInset - GAP - box.h * 0.4;
    const fitted = fitText(
      [{ text: value, face, scale: 1 }],
      mm(TYPE_SIZE_MM.cover),
      { width: box.w - 2 * side, height: room },
      id,
    );
    const titleTop = box.y + bottomInset + fitted.height;
    const imageBottom = Math.max(titleTop + GAP, box.y + box.h * 0.28);
    if (refs[0])
      await this.photo(page, refs[0], {
        x: box.x + side,
        y: imageBottom,
        w: box.w - 2 * side,
        h: box.y + box.h - topInset - imageBottom,
      });
    if (this.style.texture === "tape")
      await this.tape(
        page,
        box.x + box.w * 0.1,
        box.y + box.h - topInset + mm(1),
        box.w,
      );
    this.drawLines(
      page,
      fitted.lines,
      box.x + side,
      titleTop,
      () => this.accent,
    );
  }

  private async text(
    page: PDFPage,
    box: Box,
    id: string,
    kind: TextKind,
    text: PlanText,
  ) {
    const nominal = mm(TYPE_SIZE_MM[kind]);
    const credit = this.attribution(text);
    const body = await this.face(BODY_FACE[this.style.bodyFont]);
    const parts: TextPart[] = [];
    let indent = 0;
    let mark: Face | null = null;
    if (kind === "heading") {
      const face = await this.headingFace();
      parts.push({
        text: prepareText(this.headingText(text.value), face, id),
        face,
        scale: 1,
      });
    } else {
      const face =
        kind === "quote"
          ? await this.face(quoteFace(this.style.headingFont))
          : kind === "caption"
            ? await this.face(BODY_ITALIC_FACE[this.style.bodyFont])
            : body;
      parts.push({ text: prepareText(text.value, face, id), face, scale: 1 });
      if (kind === "quote") {
        mark = await this.headingFace();
        prepareText("“", mark, id);
        indent = nominal * 1.2;
      }
    }
    if (credit && kind !== "heading")
      parts.push({
        text: prepareText(credit, body, `${id} attribution`),
        face: body,
        scale: 0.8,
        gapBefore: 0.35,
      });
    const fitted = fitText(
      parts,
      nominal,
      { width: box.w - indent, height: box.h },
      id,
    );
    const top = box.y + box.h;
    if (mark) {
      const size = fitted.size * 2;
      page.drawText("“", {
        x: r(box.x),
        y: r(top - size * 0.8),
        size: r(size),
        font: mark.pdf,
        color: color(this.accent),
      });
    }
    // Headings use the accent (display sizes only, contrast ≥ 3:1); all
    // other text, including attributions, uses ink (≥ 4.5:1).
    this.drawLines(page, fitted.lines, box.x + indent, top, () =>
      kind === "heading" ? this.accent : this.ink,
    );
  }
}

/**
 * Renders a DesignPlan to a six-page A5 PDF. Validates first (with the
 * shared validator, no empty slots), resolves every placed image from
 * `assets` only, embeds subsetted pinned fonts and returns byte-identical
 * output for identical input. Throws `RenderError`; never returns a partial PDF.
 */
export async function renderPlanPdf(
  plan: DesignPlan,
  assets: ReadonlyMap<string, RenderAsset>,
  options: RenderOptions = {},
): Promise<RenderResult> {
  const { plan: valid, images } = preflight(plan, assets, options);
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(fontkit);
  const cover = valid.pages[0].components.find((c) => c.kind === "cover");
  doc.setTitle(cover && "text" in cover ? cover.text.value : valid.style.name);
  if (options.editionId) doc.setSubject(`Chorus edition ${options.editionId}`);
  doc.setCreator("Chorus");
  doc.setProducer(RENDERER_VERSION);
  doc.setCreationDate(RENDERER_EPOCH);
  doc.setModificationDate(RENDERER_EPOCH);
  const renderer = new Renderer(doc, valid.style, images, options.credits);
  for (const [index, page] of valid.pages.entries())
    await renderer.page(index, page.components, page.role === "cover");
  const bytes = await doc.save({
    useObjectStreams: false,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  return {
    bytes,
    digest: await sha256Hex(bytes),
    rendererVersion: RENDERER_VERSION,
    fontVersions: renderer.fontVersions(),
  };
}
