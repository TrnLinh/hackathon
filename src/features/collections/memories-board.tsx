import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, Images, Plus, Sparkles } from "lucide-react";
import { kindMeta, MemoryThumb } from "@/components/chorus/memory-thumb";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { PersonAvatar, PersonStack } from "@/components/chorus/people";
import {
  MemoryStatusBadge,
  memoryStatusHint,
} from "@/components/chorus/status";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/features/prototype/store";
import {
  LIMITS,
  collectionMemories,
  formatBytes,
  memoryStatus,
  pendingApproverIds,
  personById,
} from "@/features/prototype/selectors";
import type { MemoryStatus } from "@/features/prototype/types";
import { BudgetMeter } from "./budget-meter";

const filters: { value: MemoryStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available · AI allowed" },
  { value: "manual-only", label: "Available · no AI" },
  { value: "awaiting", label: "Awaiting" },
  { value: "excluded", label: "Excluded" },
  { value: "private", label: "My drafts" },
];

export function MemoriesBoard({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const [filter, setFilter] = useState<MemoryStatus | "all">("all");

  // Private drafts are visible only to their uploader.
  const visible = collectionMemories(state, collectionId).filter(
    (m) => m.submitted || m.uploaderId === state.viewerId,
  );
  const active = visible.filter((m) => {
    const s = memoryStatus(m);
    return s !== "excluded" && m.submitted;
  });
  const bytes = active.reduce((sum, m) => sum + (m.media?.sizeBytes ?? 0), 0);
  const shown = visible.filter(
    (m) => filter === "all" || memoryStatus(m) === filter,
  );
  const atLimit = active.length >= LIMITS.activeMemories;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <BudgetMeter
          label="Active memories"
          used={active.length}
          limit={LIMITS.activeMemories}
        />
        <BudgetMeter
          label="Upload budget"
          used={bytes}
          limit={LIMITS.collectionBytes}
          format={formatBytes}
        />
        {atLimit ? (
          <Button disabled title="This collection has twelve active memories">
            <Plus aria-hidden="true" /> Add memory
          </Button>
        ) : (
          <Button asChild>
            <Link
              to="/collections/$collectionId/memories/new"
              params={{ collectionId }}
            >
              <Plus aria-hidden="true" /> Add memory
            </Link>
          </Button>
        )}
      </div>

      <div
        role="group"
        aria-label="Filter by status"
        className="flex flex-wrap gap-1.5"
      >
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "secondary" : "ghost"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" aria-hidden="true" />}
          title="Nothing here yet"
        >
          {filter === "all"
            ? "Add a photo, voice note, short video, or story. Everyone in it will be asked before it is used."
            : "No memories match this filter."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((memory) => {
            const status = memoryStatus(memory);
            const uploader = personById(state, memory.uploaderId);
            const waiting = memory.submitted ? pendingApproverIds(memory) : [];
            const KindIcon = kindMeta[memory.kind].icon;
            // Excluded memories show status only to members other than the uploader.
            const hideContent =
              status === "excluded" && memory.uploaderId !== state.viewerId;
            return (
              <li key={memory.id}>
                <article className="relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40">
                  {hideContent ? (
                    <div className="grid aspect-[4/3] place-items-center bg-muted text-muted-foreground">
                      <Ban className="size-6" aria-hidden="true" />
                    </div>
                  ) : (
                    <MemoryThumb memory={memory} className="aspect-[4/3]" />
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <KindIcon className="size-3.5" aria-hidden="true" />
                      {kindMeta[memory.kind].label} · v{memory.version}
                    </div>
                    <h3 className="font-medium leading-snug">
                      <Link
                        to="/collections/$collectionId/memories/$memoryId"
                        params={{ collectionId, memoryId: memory.id }}
                        className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-2"
                      >
                        {hideContent ? "Excluded memory" : memory.title}
                      </Link>
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <PersonAvatar person={uploader} size="sm" />
                      Added by{" "}
                      {uploader.id === state.viewerId ? "you" : uploader.name}
                    </div>
                    <div className="mt-auto space-y-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MemoryStatusBadge status={status} />
                        {status === "available" && (
                          <span className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] text-muted-foreground">
                            <Sparkles className="size-3" aria-hidden="true" />
                            AI allowed
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {memoryStatusHint(status)}
                      </p>
                      {waiting.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <PersonStack
                            people={waiting.map((id) => personById(state, id))}
                          />
                          <span>
                            Waiting on{" "}
                            {waiting
                              .map((id) =>
                                id === state.viewerId
                                  ? "you"
                                  : personById(state, id).name.split(" ")[0],
                              )
                              .join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <TrustNote>
        Thumbnails here are synthetic placeholders. In the real build, only
        people with a current review or release grant can decrypt a preview.
        Others see status only, never a rejection reason.
      </TrustNote>
    </div>
  );
}
