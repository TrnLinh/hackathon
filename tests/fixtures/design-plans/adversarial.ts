import {
  influenceClosure,
  type DesignPlan,
  type PlanErrorCode,
} from "../../../src/lib/design-plan";
import { warmScrapbook } from "./plans";

// One hostile or broken plan per rejection rule, each derived from the
// valid warm scrapbook so that exactly the named rule fails.

type Loose = Record<string, unknown> & DesignPlan;

function variant(mutate: (plan: Loose) => void, reclose = false): unknown {
  const plan = structuredClone(warmScrapbook) as Loose;
  mutate(plan);
  if (reclose)
    plan.influence = influenceClosure(plan.pages, plan.influence.style);
  return plan;
}
const component = (plan: DesignPlan, page: number, index: number) =>
  plan.pages[page].components[index] as unknown as Record<string, unknown>;
const text = (plan: DesignPlan, page: number, index: number) =>
  component(plan, page, index).text as Record<string, unknown>;

export const adversarialPlans: {
  name: string;
  expected: PlanErrorCode[];
  plan: unknown;
}[] = [
  {
    name: "unknown asset placed on a page",
    expected: ["UNKNOWN_ASSET"],
    plan: variant((p) => {
      component(p, 2, 0).assets = [{ kind: "version", id: "ver-not-shared" }];
    }, true),
  },
  {
    name: "unauthorized style-only influence",
    expected: ["UNKNOWN_ASSET"],
    plan: variant((p) => {
      p.influence.style.push({ kind: "version", id: "ver-withdrawn" });
    }),
  },
  {
    name: "unknown component",
    expected: ["UNKNOWN_COMPONENT"],
    plan: variant((p) => {
      component(p, 1, 0).kind = "iframe";
    }),
  },
  {
    name: "unknown font",
    expected: ["UNKNOWN_FONT"],
    plan: variant((p) => {
      (p.style as Record<string, unknown>).headingFont = "remote-webfont";
    }),
  },
  {
    name: "unknown texture",
    expected: ["UNKNOWN_TEXTURE"],
    plan: variant((p) => {
      (p.style as Record<string, unknown>).texture = "glitter";
    }),
  },
  {
    name: "HTML in text",
    expected: ["UNSAFE_MARKUP"],
    plan: variant((p) => {
      text(p, 1, 1).value = "<img src=x onerror=alert(1)>";
    }),
  },
  {
    name: "template code in text",
    expected: ["UNSAFE_MARKUP"],
    plan: variant((p) => {
      text(p, 5, 0).value = "{{constructor.constructor('alert(1)')()}}";
    }),
  },
  {
    name: "network URL in a caption",
    expected: ["EXTERNAL_URL"],
    plan: variant((p) => {
      text(p, 2, 2).value = "Full size at https://example.com/pier.jpg";
    }),
  },
  {
    name: "data URL in the style name",
    expected: ["EXTERNAL_URL"],
    plan: variant((p) => {
      p.style.name = "data:image/png;base64,AAAA";
    }),
  },
  {
    name: "URL smuggled in an unknown field",
    expected: ["UNKNOWN_FIELD", "EXTERNAL_URL"],
    plan: variant((p) => {
      component(p, 0, 0).href = "//cdn.example.net/cover.png";
    }),
  },
  {
    name: "bidirectional override character",
    expected: ["CONTROL_CHARACTER"],
    plan: variant((p) => {
      text(p, 1, 0).value = "Before we knew \u202eeach other";
    }),
  },
  {
    name: "frame outside the page",
    expected: ["INVALID_BOUNDS"],
    plan: variant((p) => {
      component(p, 2, 1).frame = { x: 100, y: 90, w: 84, h: 84 };
    }),
  },
  {
    name: "malformed frame",
    expected: ["INVALID_BOUNDS"],
    plan: variant((p) => {
      component(p, 2, 0).frame = { x: 10.5, y: -4, w: "84" };
    }),
  },
  {
    name: "five pages",
    expected: ["PAGE_COUNT"],
    plan: variant((p) => {
      p.pages.pop();
    }),
  },
  {
    name: "seven pages",
    expected: ["PAGE_COUNT"],
    plan: variant((p) => {
      p.pages.push({
        ...structuredClone(p.pages[5]),
        components: p.pages[5].components.map((c) => ({
          ...structuredClone(c),
          id: `${c.id}-extra`,
        })),
      });
    }),
  },
  {
    name: "landscape page",
    expected: ["PAGE_FORMAT"],
    plan: variant((p) => {
      p.pages[3].widthMm = 210;
      p.pages[3].heightMm = 148;
    }),
  },
  {
    name: "caption over the code-point limit",
    expected: ["TEXT_OVERFLOW"],
    plan: variant((p) => {
      text(p, 4, 1).value = "a".repeat(241);
    }),
  },
  {
    name: "heading that cannot fit its frame",
    expected: ["TEXT_OVERFLOW"],
    plan: variant((p) => {
      component(p, 5, 0).frame = { x: 14, y: 120, w: 40, h: 10 };
    }),
  },
  {
    name: "unreadable ink",
    expected: ["LOW_CONTRAST"],
    plan: variant((p) => {
      p.style.ink = "#b8a898";
    }),
  },
  {
    name: "unreadable accent",
    expected: ["LOW_CONTRAST"],
    plan: variant((p) => {
      p.style.accent = "#f2c9a0";
    }),
  },
  {
    name: "placed asset missing from the influence closure",
    expected: ["INFLUENCE_MISSING"],
    plan: variant((p) => {
      p.influence.visible = p.influence.visible.filter(
        (ref) => ref.id !== "ver-story",
      );
    }),
  },
  {
    name: "visible ref that is not placed",
    expected: ["CLOSURE_INVALID"],
    plan: variant((p) => {
      p.influence.visible.push({ kind: "version", id: "ver-boxes" });
      p.influence.style = [];
    }),
  },
  {
    name: "unattributed recording excerpt",
    expected: ["ATTRIBUTION_REQUIRED"],
    plan: variant((p) => {
      delete text(p, 3, 0).creditId;
    }),
  },
  {
    name: "unknown credited person",
    expected: ["UNKNOWN_PERSON"],
    plan: variant((p) => {
      text(p, 3, 0).creditId = "person-unknown";
    }),
  },
  {
    name: "inverted excerpt range",
    expected: ["INVALID_TIME_RANGE"],
    plan: variant((p) => {
      Object.assign(text(p, 3, 1).source as object, {
        startMs: 22000,
        endMs: 17000,
      });
    }),
  },
  {
    name: "empty slot in a plan saved for freezing",
    expected: ["EMPTY_SLOT"],
    plan: variant((p) => {
      text(p, 5, 1).value = " ";
    }),
  },
  {
    name: "blank page in a plan saved for freezing",
    expected: ["EMPTY_SLOT"],
    plan: variant((p) => {
      p.pages[5].components = [];
    }),
  },
  {
    name: "duplicate component ID",
    expected: ["DUPLICATE_ID"],
    plan: variant((p) => {
      component(p, 5, 1).id = "w-closing";
    }),
  },
  {
    name: "too many collage photos",
    expected: ["COMPONENT_CONTENT"],
    plan: variant((p) => {
      component(p, 4, 0).assets = ["ver-pier", "ver-kitchen", "ver-story"]
        .map((id) => ({ kind: "version", id }))
        .concat([
          { kind: "derivative", id: "drv-still-dance" },
          { kind: "version", id: "ver-voice" },
        ]);
    }, true),
  },
  {
    name: "unsupported schema version",
    expected: ["UNSUPPORTED_SCHEMA_VERSION"],
    plan: variant((p) => {
      p.schemaVersion = "chorus-plan/v0";
    }),
  },
  {
    name: "unsupported component version",
    expected: ["UNSUPPORTED_COMPONENT_VERSION"],
    plan: variant((p) => {
      p.componentVersion = "chorus-components/v9";
    }),
  },
  {
    name: "unknown template",
    expected: ["UNKNOWN_TEMPLATE"],
    plan: variant((p) => {
      p.provenance.revisionOrigin = {
        kind: "template",
        templateId: "tpl-scrapbook",
        templateVersion: "9.9",
      };
    }),
  },
  {
    name: "AI origin without job lineage",
    expected: ["INVALID_PROVENANCE"],
    plan: variant((p) => {
      p.provenance.aiJobs = [];
    }),
  },
  ...(
    [
      ["zero-width space", "Before\u200bwe"],
      ["byte order mark", "Before\ufeffwe"],
      ["left-to-right mark", "Before\u200ewe"],
      ["Arabic letter mark", "Before\u061cwe"],
      ["line separator", "Before\u2028we"],
      ["tag character", `Before${String.fromCodePoint(0xe0041)}we`],
      ["unpaired surrogate", `Before${String.fromCharCode(0xd800)}we`],
    ] as const
  ).map(([name, value]) => ({
    name: `invisible text: ${name}`,
    expected: ["CONTROL_CHARACTER"] as PlanErrorCode[],
    plan: variant((p) => {
      text(p, 1, 0).value = value;
    }),
  })),
  {
    name: "fullwidth URL",
    expected: ["EXTERNAL_URL"],
    plan: variant((p) => {
      text(p, 2, 2).value = "See ｈｔｔｐｓ：／／example.com";
    }),
  },
  {
    name: "fullwidth markup",
    expected: ["UNSAFE_MARKUP"],
    plan: variant((p) => {
      text(p, 2, 2).value = "＜script＞alert(1)＜/script＞";
    }),
  },
  {
    name: "three-digit color",
    expected: ["INVALID_COLOR"],
    plan: variant((p) => {
      p.style.paper = "#fff";
    }),
  },
  {
    name: "explicit undefined inspiration",
    expected: ["MALFORMED"],
    plan: variant((p) => {
      p.inspiration = undefined;
    }),
  },
  {
    name: "explicit undefined parent digest",
    expected: ["MALFORMED"],
    plan: variant((p) => {
      p.provenance.parentDigest = undefined;
    }),
  },
  {
    name: "pages out of order",
    expected: ["PAGE_ORDER"],
    plan: variant((p) => {
      [p.pages[1], p.pages[2]] = [p.pages[2], p.pages[1]];
    }),
  },
  {
    name: "six cover pages",
    expected: ["PAGE_ORDER"],
    plan: variant((p) => {
      for (const page of p.pages) page.role = "cover";
    }),
  },
  {
    name: "image painted over a quote",
    expected: ["FRAME_OVERLAP"],
    plan: variant((p) => {
      p.pages[3].components.push({
        id: "w-sticker",
        kind: "image",
        frame: { x: 60, y: 30, w: 60, h: 40 },
        assets: [{ kind: "version", id: "ver-pier" }],
      });
    }),
  },
  {
    name: "executable payload field",
    expected: ["UNKNOWN_FIELD"],
    plan: variant((p) => {
      p.script = "renderPage()";
    }),
  },
];
