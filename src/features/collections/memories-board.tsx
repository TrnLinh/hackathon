import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, Check, Clock, Images, Lock, Plus } from "lucide-react";
import { ArtworkFill, MemoryThumb } from "@/components/chorus/memory-thumb";
import { EmptyState } from "@/components/chorus/page-header";
import { PersonStack } from "@/components/chorus/people";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/features/prototype/store";
import {
  LIMITS,
  approverIds,
  collectionMemories,
  formatBytes,
  memoryStatus,
  personById,
} from "@/features/prototype/selectors";
import type { MemoryStatus } from "@/features/prototype/types";
import { ConvexMemoriesBoard } from "@/features/memories/convex-memories";
import { cn } from "@/lib/utils";
import { BudgetMeter } from "./budget-meter";

type Filter = "all" | "waiting" | "ready";

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "waiting", label: "Waiting" },
  { value: "ready", label: "Ready" },
];

const statusGlyph: Record<
  MemoryStatus,
  { icon: typeof Check; label: string; className: string }
> = {
  available: {
    icon: Check,
    label: "Ready",
    className: "bg-primary text-primary-foreground",
  },
  "manual-only": {
    icon: Check,
    label: "Ready",
    className: "bg-primary text-primary-foreground",
  },
  awaiting: {
    icon: Clock,
    label: "Waiting for approval",
    className: "bg-lime text-lime-ink",
  },
  private: {
    icon: Lock,
    label: "Private draft",
    className: "bg-card text-foreground",
  },
  excluded: {
    icon: Ban,
    label: "Not used",
    className: "bg-card text-muted-foreground",
  },
};

function matches(filter: Filter, status: MemoryStatus) {
  if (filter === "all") return true;
  if (filter === "waiting") return status === "awaiting";
  return status === "available" || status === "manual-only";
}

export function MemoriesBoard({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  return state.collections.some((c) => c.id === collectionId) ? (
    <PrototypeMemoriesBoard collectionId={collectionId} />
  ) : (
    <ConvexMemoriesBoard collectionId={collectionId} />
  );
}

function PrototypeMemoriesBoard({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const [filter, setFilter] = useState<Filter>("all");

  // Private drafts are visible only to their uploader.
  const visible = collectionMemories(state, collectionId).filter(
    (m) => m.submitted || m.uploaderId === state.viewerId,
  );
  const active = visible.filter(
    (m) => memoryStatus(m) !== "excluded" && m.submitted,
  );
  const bytes = active.reduce((sum, m) => sum + (m.media?.sizeBytes ?? 0), 0);
  const shown = visible.filter((m) => matches(filter, memoryStatus(m)));
  const atLimit = active.length >= LIMITS.activeMemories;

  const addButton = (extra: string, large = false) =>
    atLimit ? (
      <Button
        disabled
        variant="highlight"
        size={large ? "lg" : "default"}
        className={extra}
        title="This zine is full"
      >
        <Plus aria-hidden="true" /> Add memory
      </Button>
    ) : (
      <Button
        asChild
        size={large ? "lg" : "default"}
        variant="highlight"
        className={extra}
      >
        <Link
          to="/collections/$collectionId/memories/new"
          params={{ collectionId }}
        >
          <Plus aria-hidden="true" /> Add memory
        </Link>
      </Button>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Show"
          className="inline-flex rounded-full bg-muted p-1"
        >
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "min-h-10 rounded-full px-4 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                filter === f.value
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {addButton("hidden md:inline-flex")}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" aria-hidden="true" />}
          title={filter === "all" ? "No memories yet" : "Nothing here"}
          action={filter === "all" ? addButton("", true) : undefined}
        >
          {filter === "all"
            ? "Add a photo, voice note or story."
            : "Nothing matches this view."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
          {shown.map((memory, i) => {
            const status = memoryStatus(memory);
            const glyph = statusGlyph[status];
            const Glyph = glyph.icon;
            // Excluded memories show status only to members other than the uploader.
            const hideContent =
              status === "excluded" && memory.uploaderId !== state.viewerId;
            const people = (
              memory.submitted ? approverIds(memory) : [memory.uploaderId]
            ).map((id) => personById(state, id));
            return (
              <li
                key={memory.id}
                className={cn("rise", i === 0 && "sm:col-span-2 sm:row-span-2")}
                style={{ "--i": i } as React.CSSProperties}
              >
                <Link
                  to="/collections/$collectionId/memories/$memoryId"
                  params={{ collectionId, memoryId: memory.id }}
                  className={cn(
                    "press group relative block aspect-4/5 overflow-hidden rounded-[2rem] bg-muted shadow-soft ring-1 ring-border outline-none transition-shadow duration-200 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring",
                    i === 0 && "sm:aspect-auto sm:h-full sm:min-h-80",
                  )}
                >
                  {hideContent ? (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <Ban className="size-6" aria-hidden="true" />
                    </div>
                  ) : memory.art &&
                    (memory.kind === "photo" || memory.kind === "video") ? (
                    <ArtworkFill
                      art={memory.art}
                      showScene={false}
                      className="absolute inset-0"
                    />
                  ) : (
                    <MemoryThumb memory={memory} className="size-full pb-16" />
                  )}
                  <span
                    className={cn(
                      "absolute top-3 right-3 grid size-9 place-items-center rounded-full shadow-soft",
                      glyph.className,
                    )}
                  >
                    <Glyph className="size-4" aria-hidden="true" />
                    <span className="sr-only">{glyph.label}</span>
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-linear-to-t from-black/70 via-black/30 to-transparent p-4 pt-14">
                    <p className="font-display line-clamp-2 text-lg leading-tight font-bold tracking-tight text-white">
                      {hideContent ? "Not used" : memory.title}
                    </p>
                    {!hideContent && <PersonStack people={people} max={3} />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <BudgetMeter
          label="Memories"
          used={active.length}
          limit={LIMITS.activeMemories}
        />{" "}
        memories,{" "}
        <BudgetMeter
          label="Upload size"
          used={bytes}
          limit={LIMITS.collectionBytes}
          format={formatBytes}
        />
      </p>

      {shown.length > 0 && (
        <div className="fixed right-4 bottom-[calc(var(--nav-bottom)+env(safe-area-inset-bottom)+1rem)] z-30 md:hidden">
          {addButton("shadow-lift", true)}
        </div>
      )}
    </div>
  );
}
