import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArtworkFill } from "@/components/chorus/memory-thumb";
import type {
  Artwork,
  Block,
  Memory,
  Page,
  Person,
  StyleTokens,
} from "@/features/prototype/types";

// Preview renderer for the CH-20 design-plan contract. It renders only
// allowlisted block kinds from local data: no HTML from the plan, no external
// URLs. The frozen PDF renderer (CH-10) must consume the same plan.

const fontStack: Record<
  StyleTokens["headingFont"] | StyleTokens["bodyFont"],
  string
> = {
  serif: "var(--font-serif)",
  hand: "var(--font-hand)",
  grotesk: "var(--font-grotesk)",
  mono: "var(--font-mono)",
  sans: "var(--font-sans)",
};

export const pageRoleLabel: Record<Page["role"], string> = {
  cover: "Cover",
  opening: "Opening note",
  photos: "Photos & captions",
  perspectives: "Perspectives",
  more: "More memories",
  closing: "Closing",
};

type Ctx = {
  tokens: StyleTokens;
  memories: Memory[];
  people: Person[];
};

function artFor(
  ctx: Ctx,
  memoryId: string,
  index = 0,
  stillId?: string,
): Artwork | undefined {
  const m = ctx.memories.find((x) => x.id === memoryId);
  if (!m) return undefined;
  if (m.kind === "video") {
    const chosen = stillId && m.stills?.find((s) => s.id === stillId);
    if (chosen) return chosen.art;
    const stills = (m.stills ?? []).filter((s) => s.selected);
    return stills[index % Math.max(stills.length, 1)]?.art ?? m.art;
  }
  return m.art;
}

function attribution(ctx: Ctx, block: Block) {
  if (!block.attributionId) return null;
  const person = ctx.people.find((p) => p.id === block.attributionId);
  const memory = block.memoryIds?.[0]
    ? ctx.memories.find((m) => m.id === block.memoryIds![0])
    : undefined;
  const excerpt = memory?.transcript?.find((e) => e.id === block.excerptId);
  return (
    <span className="block opacity-70" style={{ fontSize: "2.6cqw" }}>
      — {person?.name.split(" ")[0] ?? "Unknown"}
      {excerpt &&
        `, voice note ${Math.floor(excerpt.startSec / 60)}:${String(excerpt.startSec % 60).padStart(2, "0")}`}
    </span>
  );
}

function MissingAsset() {
  return (
    <div
      className="grid size-full place-items-center border border-dashed text-center opacity-60"
      style={{ fontSize: "2.4cqw" }}
    >
      Source not available
    </div>
  );
}

function Img({
  art,
  className,
  style,
}: {
  art?: Artwork;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("relative overflow-hidden", className)} style={style}>
      {art ? (
        <ArtworkFill art={art} className="absolute inset-0" showScene={false} />
      ) : (
        <MissingAsset />
      )}
    </div>
  );
}

function Tape({ ctx, className }: { ctx: Ctx; className?: string }) {
  if (ctx.tokens.texture !== "tape") return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute z-10 h-[4cqw] w-[16cqw] rotate-[-8deg] opacity-70",
        className,
      )}
      style={{
        background: `color-mix(in srgb, ${ctx.tokens.muted} 55%, white)`,
      }}
    />
  );
}

function BlockView({ block, ctx }: { block: Block; ctx: Ctx }) {
  const heading: CSSProperties = {
    fontFamily: fontStack[ctx.tokens.headingFont],
    color: ctx.tokens.accent,
    textTransform:
      ctx.tokens.headingFont === "grotesk" ? "uppercase" : undefined,
    letterSpacing: ctx.tokens.headingFont === "grotesk" ? "-0.02em" : undefined,
    fontWeight: ctx.tokens.headingFont === "grotesk" ? 800 : 600,
  };
  switch (block.kind) {
    case "cover": {
      const art = block.memoryIds?.[0]
        ? artFor(ctx, block.memoryIds[0], 0, block.stillIds?.[0])
        : undefined;
      return (
        <div className="relative size-full">
          <Img art={art} className="absolute inset-[6%] bottom-[28%]" />
          <Tape ctx={ctx} className="top-[4%] left-[10%]" />
          <h2
            className="absolute right-[6%] bottom-[7%] left-[6%] leading-[0.95]"
            style={{ ...heading, fontSize: "9cqw" }}
          >
            {block.text}
          </h2>
        </div>
      );
    }
    case "heading":
      return (
        <h3
          className="leading-tight"
          style={{ ...heading, fontSize: "6.5cqw" }}
        >
          {block.text}
        </h3>
      );
    case "note":
      return (
        <p className="leading-relaxed" style={{ fontSize: "3.4cqw" }}>
          {block.text}
          {attribution(ctx, block)}
        </p>
      );
    case "caption":
      return (
        <p className="leading-snug italic" style={{ fontSize: "3cqw" }}>
          {block.text}
          {attribution(ctx, block)}
        </p>
      );
    case "quote":
      return (
        <blockquote
          className="relative pl-[5cqw]"
          style={{ fontSize: "4.4cqw" }}
        >
          <span
            aria-hidden="true"
            className="absolute top-[-2cqw] left-0 leading-none"
            style={{ ...heading, fontSize: "10cqw" }}
          >
            “
          </span>
          <span
            className="leading-snug"
            style={{
              fontFamily:
                fontStack[
                  ctx.tokens.headingFont === "grotesk" ? "grotesk" : "serif"
                ],
            }}
          >
            {block.text}
          </span>
          {attribution(ctx, block)}
        </blockquote>
      );
    case "image": {
      const art = block.memoryIds?.[0]
        ? artFor(ctx, block.memoryIds[0], 0, block.stillIds?.[0])
        : undefined;
      return (
        <div className="relative">
          <Tape ctx={ctx} className="-top-[1.5cqw] left-[35%]" />
          <Img
            art={art}
            className="aspect-[4/3] w-full"
            style={{
              boxShadow:
                ctx.tokens.texture === "tape"
                  ? "0 1px 4px rgba(0,0,0,.18)"
                  : undefined,
            }}
          />
        </div>
      );
    }
    case "grid":
      return (
        <div className="grid grid-cols-2 gap-[2cqw]">
          {(block.memoryIds ?? []).slice(0, 4).map((id, i) => (
            <Img
              key={id + i}
              art={artFor(ctx, id, i)}
              className="aspect-square"
            />
          ))}
        </div>
      );
    case "collage": {
      const ids = block.memoryIds ?? [];
      const tilt = [-6, 4, -2, 7];
      return (
        <div className="relative h-[70cqw]">
          {ids.slice(0, 4).map((id, i) => (
            <div
              key={id + i}
              className="absolute w-[52%] bg-white p-[1.5cqw] pb-[5cqw] shadow-md"
              style={{
                top: `${(i % 2) * 22 + Math.floor(i / 2) * 8}%`,
                left: `${(i % 2) * 40 + (i > 1 ? 6 : 2)}%`,
                transform: `rotate(${tilt[i]}deg)`,
              }}
            >
              <Img art={artFor(ctx, id, i)} className="aspect-square" />
            </div>
          ))}
        </div>
      );
    }
  }
}

export function ZinePage({
  page,
  pageNumber,
  tokens,
  memories,
  people,
  selectedBlockId,
  onSelectBlock,
  className,
  overlay,
}: {
  page: Page;
  pageNumber: number;
  tokens: StyleTokens;
  memories: Memory[];
  people: Person[];
  selectedBlockId?: string;
  onSelectBlock?: (blockId: string) => void;
  className?: string;
  overlay?: ReactNode;
}) {
  const ctx: Ctx = { tokens, memories, people };
  const isCover = page.role === "cover";
  return (
    <figure
      aria-label={`Page ${pageNumber}: ${pageRoleLabel[page.role]}`}
      className={cn(
        "@container relative aspect-[148/210] w-full overflow-hidden rounded-[3px] shadow-[0_1px_2px_rgba(0,0,0,.12),0_6px_20px_-8px_rgba(0,0,0,.25)]",
        className,
      )}
      style={{
        background: tokens.paper,
        color: tokens.ink,
        fontFamily: fontStack[tokens.bodyFont],
      }}
    >
      {tokens.texture === "grain" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[.08]"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at 0 0, #fff 0 1px, transparent 1px 3px)",
          }}
        />
      )}
      {tokens.texture === "film" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-[3%] border"
          style={{ borderColor: tokens.muted }}
        />
      )}
      <div
        className={cn(
          "relative flex size-full flex-col",
          isCover ? "" : "gap-[4cqw] p-[8cqw]",
          !isCover && page.layout === "stack" && "justify-center",
        )}
      >
        {page.blocks.map((block) => {
          const content = <BlockView block={block} ctx={ctx} />;
          if (!onSelectBlock)
            return (
              <div key={block.id} className={cn(isCover && "size-full")}>
                {content}
              </div>
            );
          return (
            <button
              key={block.id}
              type="button"
              onClick={() => onSelectBlock(block.id)}
              aria-pressed={selectedBlockId === block.id}
              aria-label={`Edit ${block.kind} block`}
              className={cn(
                "relative rounded-sm text-left outline-offset-2 transition-shadow hover:outline hover:outline-1 hover:outline-dashed focus-visible:outline-2",
                isCover && "size-full",
                selectedBlockId === block.id && "outline-2 outline-solid",
              )}
              style={{ outlineColor: tokens.accent }}
            >
              {content}
              {block.edited && (
                <span
                  className="absolute -top-[2cqw] right-0 rounded-full px-[1.5cqw] font-sans text-[max(8px,2cqw)] font-medium text-white"
                  style={{ background: tokens.accent }}
                >
                  Edited
                </span>
              )}
            </button>
          );
        })}
      </div>
      <span
        aria-hidden="true"
        className="absolute right-[4cqw] bottom-[3cqw] font-mono opacity-50"
        style={{ fontSize: "2.2cqw" }}
      >
        {pageNumber}
      </span>
      {overlay}
    </figure>
  );
}
