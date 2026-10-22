import { createHash } from "node:crypto";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  PINNED_FONTS,
  RENDERER_EPOCH,
  RENDERER_VERSION,
  RenderError,
  fontVersion,
  renderPlanPdf,
} from "../src/lib/render";
import fontkit from "@pdf-lib/fontkit";
import { loadFont } from "../src/lib/render/fonts";
import { MIN_SCALE, fitText, type Face } from "../src/lib/render/text";
import type { DesignPlan } from "../src/lib/design-plan";
import { adversarialPlans } from "./fixtures/design-plans/adversarial";
import {
  boldEditorial,
  context,
  warmScrapbook,
} from "./fixtures/design-plans/plans";
import {
  credits,
  fixtureAssets,
  makePng,
  tinyJpeg,
} from "./fixtures/render/images";

const A5 = { width: (148 * 72) / 25.4, height: (210 * 72) / 25.4 };
const render = (plan: DesignPlan, assets = fixtureAssets()) =>
  renderPlanPdf(plan, assets, { context, credits });

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RenderError);
    return error as RenderError;
  }
  throw new Error("Expected the render to fail.");
}

function objects(pdf: PDFDocument) {
  return pdf.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .map((object) => (object instanceof PDFRawStream ? object.dict : object))
    .filter((object): object is PDFDict => object instanceof PDFDict);
}
const name = (dict: PDFDict, key: string) =>
  dict.get(PDFName.of(key))?.toString();

describe("CH-10 PDF renderer", () => {
  it("renders identical input to byte-identical PDFs", async () => {
    const first = await render(warmScrapbook);
    const second = await render(structuredClone(warmScrapbook));
    expect(Buffer.from(second.bytes).equals(Buffer.from(first.bytes))).toBe(
      true,
    );
    expect(second.digest).toBe(first.digest);
    expect(first.digest).toBe(
      createHash("sha256").update(first.bytes).digest("hex"),
    );
    expect(first.rendererVersion).toBe(RENDERER_VERSION);
    // Asset map insertion order is not content.
    const reversed = new Map([...fixtureAssets()].reverse());
    expect((await render(warmScrapbook, reversed)).digest).toBe(first.digest);
  });

  it("matches the recorded digests for this renderer version", async () => {
    // Same values from Node and headless Chrome. If output changes on
    // purpose, bump RENDERER_VERSION and update these.
    expect(RENDERER_VERSION).toBe(
      "chorus-pdf/1.0.0 (chorus-components/v1; pdf-lib 1.17.1; @pdf-lib/fontkit 1.1.1)",
    );
    expect((await render(warmScrapbook)).digest).toBe(
      "86b7cff9a7531e9f6c475b3768bd4b64380d61c8ff49448441b4734c6b7a6011",
    );
    expect((await render(boldEditorial)).digest).toBe(
      "be0ef347beafce15505f161a1bcd9e7c80ef7c51ec782bd2875d77748f46a426",
    );
  });

  it("changes the digest when one character of text changes", async () => {
    const changed = structuredClone(warmScrapbook);
    const note = changed.pages[1].components[1];
    if (!("text" in note)) throw new Error("fixture changed");
    note.text.value = note.text.value.replace("noise.", "noise!");
    const [a, b] = await Promise.all([render(warmScrapbook), render(changed)]);
    expect(b.digest).not.toBe(a.digest);
  });

  it.each([
    ["warm scrapbook", warmScrapbook],
    ["bold editorial", boldEditorial],
  ])(
    "renders %s as six portrait A5 pages with embedded fonts",
    async (_, plan) => {
      const result = await render(plan);
      const pdf = await PDFDocument.load(result.bytes, {
        updateMetadata: false,
      });
      expect(pdf.getPageCount()).toBe(6);
      for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();
        expect(Math.abs(width - A5.width)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(height - A5.height)).toBeLessThanOrEqual(0.5);
        expect(page.getRotation().angle).toBe(0);
      }
      const dicts = objects(pdf);
      const fonts = dicts.filter((d) => name(d, "Type") === "/Font");
      // Only composite TrueType fonts with embedded programs: no standard 14.
      const top = fonts.filter((d) => name(d, "Subtype") === "/Type0");
      expect(top).toHaveLength(result.fontVersions.length);
      expect(
        fonts.every((d) =>
          ["/Type0", "/CIDFontType2"].includes(name(d, "Subtype")!),
        ),
      ).toBe(true);
      const descriptors = dicts.filter(
        (d) => name(d, "Type") === "/FontDescriptor",
      );
      expect(descriptors).toHaveLength(result.fontVersions.length);
      for (const descriptor of descriptors)
        expect(descriptor.get(PDFName.of("FontFile2"))).toBeInstanceOf(PDFRef);
      const pinned = PINNED_FONTS.map(fontVersion);
      expect(result.fontVersions.every((v) => pinned.includes(v))).toBe(true);
      expect(result.fontVersions).toEqual([...result.fontVersions].sort());
    },
  );

  it("maps style tokens to their pinned faces", async () => {
    const warm = await render(warmScrapbook);
    const bold = await render(boldEditorial);
    const families = (versions: string[]) =>
      versions.map((v) => v.split("@")[0]);
    // hand heading + serif body; grotesk heading + sans body.
    expect(families(warm.fontVersions)).toEqual([
      "CrimsonText-Italic",
      "CrimsonText-Regular",
      "PatrickHand-Regular",
    ]);
    expect(families(bold.fontVersions)).toEqual([
      "Barlow-Italic",
      "Barlow-Regular",
      "BarlowCondensed-ExtraBold",
      "BarlowCondensed-Medium",
    ]);
  });

  it("writes fixed metadata", async () => {
    const result = await renderPlanPdf(warmScrapbook, fixtureAssets(), {
      context,
      credits,
      editionId: "edition-123",
    });
    const pdf = await PDFDocument.load(result.bytes, { updateMetadata: false });
    expect(pdf.getTitle()).toBe("Our First Year Away From Home");
    expect(pdf.getSubject()).toBe("Chorus edition edition-123");
    expect(pdf.getProducer()).toBe(RENDERER_VERSION);
    expect(pdf.getCreator()).toBe("Chorus");
    expect(pdf.getCreationDate()?.toISOString()).toBe(
      RENDERER_EPOCH.toISOString(),
    );
    expect(pdf.getModificationDate()?.toISOString()).toBe(
      RENDERER_EPOCH.toISOString(),
    );
    expect(pdf.getAuthor()).toBeUndefined();
    // No trailer /ID or other per-run identifiers.
    expect(pdf.context.trailerInfo.ID).toBeUndefined();
  });

  it("embeds only placed images; extra decrypted assets leave no trace", async () => {
    const assets = fixtureAssets();
    const base = await render(warmScrapbook, assets);
    const withExtra = new Map(assets).set("version:ver-boxes", {
      bytes: makePng(9, 9, [1, 2, 3], [4, 5, 6]),
      mimeType: "image/png",
    });
    const extra = await render(warmScrapbook, withExtra);
    expect(extra.digest).toBe(base.digest);
    const pdf = await PDFDocument.load(base.bytes, { updateMetadata: false });
    const images = objects(pdf).filter((d) => name(d, "Subtype") === "/Image");
    // pier, kitchen and the dance still; kitchen repeats but embeds once.
    expect(images).toHaveLength(3);
  });

  it("drops JPEG metadata segments before embedding", async () => {
    const secret = new TextEncoder().encode("Exif\0\0GPS 51.5007N 0.1246W");
    const app1 = new Uint8Array([0xff, 0xe1, 0, secret.length + 2, ...secret]);
    const tagged = new Uint8Array([
      ...tinyJpeg.subarray(0, 2),
      ...app1,
      ...tinyJpeg.subarray(2),
    ]);
    const assets = fixtureAssets().set("version:ver-kitchen", {
      bytes: tagged,
      mimeType: "image/jpeg",
    });
    const result = await render(warmScrapbook, assets);
    expect(Buffer.from(result.bytes).includes("GPS 51.5007N")).toBe(false);
    expect(result.digest).toBe((await render(warmScrapbook)).digest);
  });

  it("drops data appended after the end-of-image marker", async () => {
    // Multi-picture JPEGs, gain maps and motion photos append data after EOI.
    const trailer = new TextEncoder().encode("Exif\0\0GPS 48.8584N 2.2945E");
    const appended = new Uint8Array([...tinyJpeg, 0xff, 0xd8, ...trailer]);
    const assets = fixtureAssets().set("version:ver-kitchen", {
      bytes: appended,
      mimeType: "image/jpeg",
    });
    const result = await render(warmScrapbook, assets);
    expect(Buffer.from(result.bytes).includes("GPS 48.8584N")).toBe(false);
    expect(result.digest).toBe((await render(warmScrapbook)).digest);
  });

  it("rejects a JPEG without an end-of-image marker", async () => {
    const truncated = tinyJpeg.subarray(0, tinyJpeg.length - 2);
    const assets = fixtureAssets().set("version:ver-kitchen", {
      bytes: truncated,
      mimeType: "image/jpeg",
    });
    expect((await rejection(render(warmScrapbook, assets))).code).toBe(
      "INVALID_ASSET",
    );
  });

  it("fails clearly when a placed image is missing", async () => {
    const assets = fixtureAssets();
    assets.delete("derivative:drv-still-dance");
    const error = await rejection(render(warmScrapbook, assets));
    expect(error.code).toBe("MISSING_ASSET");
    expect(error.message).toContain("derivative:drv-still-dance");
  });

  it("rejects bytes that do not match the declared image type", async () => {
    const assets = fixtureAssets();
    assets.set("version:ver-pier", {
      bytes: new TextEncoder().encode("<svg/>"),
      mimeType: "image/png",
    });
    expect((await rejection(render(warmScrapbook, assets))).code).toBe(
      "INVALID_ASSET",
    );
  });

  it.each(adversarialPlans)(
    "rejects invalid plan: $name",
    async ({ plan, expected }) => {
      const error = await rejection(
        renderPlanPdf(plan as DesignPlan, fixtureAssets(), {
          context,
          credits,
        }),
      );
      expect(error.code).toBe("INVALID_PLAN");
      expect([...new Set(error.planErrors.map((e) => e.code))].sort()).toEqual(
        [...expected].sort(),
      );
    },
  );

  it("rejects empty slots that a draft preview would allow", async () => {
    const draft = structuredClone(warmScrapbook);
    const heading = draft.pages[5].components[0];
    if (!("text" in heading)) throw new Error("fixture changed");
    heading.text.value = "";
    const error = await rejection(render(draft));
    expect(error.planErrors.map((e) => e.code)).toContain("EMPTY_SLOT");
  });

  it("does not authorize assets just because bytes were supplied", async () => {
    // Without an explicit context only refs present in `assets` are
    // authorized, so the plan's recordings and style-only refs fail.
    const error = await rejection(
      renderPlanPdf(warmScrapbook, fixtureAssets(), { credits }),
    );
    expect(error.planErrors.map((e) => e.code)).toContain("UNKNOWN_ASSET");
  });

  it("requires a display name for every credited text", async () => {
    const error = await rejection(
      renderPlanPdf(warmScrapbook, fixtureAssets(), {
        context,
        credits: new Map([["person-maya", "Maya"]]),
      }),
    );
    expect(error.code).toBe("MISSING_CREDIT");
  });

  it("fails instead of drawing characters the pinned fonts lack", async () => {
    const plan = structuredClone(warmScrapbook);
    const caption = plan.pages[2].components[2];
    if (!("text" in caption)) throw new Error("fixture changed");
    caption.text.value = "Homesick 🙂";
    const error = await rejection(render(plan));
    expect(error.code).toBe("UNSUPPORTED_CHARACTER");
    expect(error.message).toContain("U+1F642");
  });

  it("draws markup-looking text literally and never fetches", async () => {
    const plan = structuredClone(boldEditorial);
    const note = plan.pages[5].components[1];
    if (!("text" in note)) throw new Error("fixture changed");
    note.text.value = "Same time next year * _really_ #1";
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      throw new Error("fetch called");
    };
    try {
      const result = await render(plan);
      expect(result.bytes.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("verifies vendored fonts against their pinned digests", async () => {
    for (const font of PINNED_FONTS) {
      const bytes = await loadFont(font.id);
      expect(bytes.length).toBe(font.size);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        font.sha256,
      );
    }
  });

  it("shrinks text to fit and fails rather than clipping", async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const bytes = await loadFont("barlow-regular");
    const face: Face = {
      id: "barlow-regular",
      pdf: await doc.embedFont(bytes, { subset: true }),
      metrics: fontkit.create(bytes),
    };
    const box = { width: 100, height: 26 };
    const part = (text: string) => [{ text, face, scale: 1 }];
    expect(fitText(part("Short"), 10, box, "t").size).toBe(10);
    const shrunk = fitText(part("word ".repeat(12).trim()), 10, box, "t");
    expect(shrunk.size).toBeLessThan(10);
    expect(shrunk.size).toBeGreaterThanOrEqual(10 * MIN_SCALE);
    expect(shrunk.height).toBeLessThanOrEqual(box.height);
    for (const line of shrunk.lines)
      expect(
        face.pdf.widthOfTextAtSize(line.text, line.size),
      ).toBeLessThanOrEqual(box.width);
    let error: unknown;
    try {
      fitText(part("word ".repeat(200)), 10, box, "t");
    } catch (e) {
      error = e;
    }
    expect((error as RenderError).code).toBe("TEXT_OVERFLOW");
  });
});
