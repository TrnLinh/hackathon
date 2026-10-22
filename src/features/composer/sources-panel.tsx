import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ArtworkFill, kindMeta } from "@/components/chorus/memory-thumb";
import { MemoryStatusBadge } from "@/components/chorus/status";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  aiEligible,
  LIMITS,
  manualEligible,
  memoryStatus,
} from "@/features/prototype/selectors";
import type { DesignPlan, Memory } from "@/features/prototype/types";
import { type Budget, usageOf } from "./plan-utils";

const usageLabel = {
  visible: "On a page",
  "style-only": "Style only",
  unused: "Not used",
} as const;

function SquareThumb({ memory }: { memory: Memory }) {
  const Icon = kindMeta[memory.kind].icon;
  if ((memory.kind === "photo" || memory.kind === "video") && memory.art)
    return (
      <ArtworkFill
        art={memory.art}
        showScene={false}
        className="relative size-14 shrink-0 overflow-hidden rounded-2xl"
      />
    );
  return (
    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
      <Icon className="size-6" aria-hidden="true" />
    </span>
  );
}

function SourceRow({
  memory,
  plan,
  collectionId,
  index = 0,
}: {
  index?: number;
  memory: Memory;
  plan?: DesignPlan;
  collectionId: string;
}) {
  const usage = usageOf(plan, memory.id);
  return (
    <li className="rise" style={{ "--i": index } as React.CSSProperties}>
      <Link
        to="/collections/$collectionId/memories/$memoryId"
        params={{ collectionId, memoryId: memory.id }}
        className="press flex min-h-16 items-center gap-3 rounded-2xl p-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <SquareThumb memory={memory} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base">{memory.title}</span>
          {manualEligible(memory) ? (
            <span
              className={cn(
                "mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                usage === "visible"
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {usageLabel[usage]}
            </span>
          ) : (
            <MemoryStatusBadge
              status={memoryStatus(memory)}
              className="mt-0.5 h-6 px-2 text-xs"
            />
          )}
        </span>
      </Link>
    </li>
  );
}

function Group({
  title,
  memories,
  plan,
  collectionId,
}: {
  title: string;
  memories: Memory[];
  plan?: DesignPlan;
  collectionId: string;
}) {
  if (memories.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-1">
      <h3 className="px-1.5 text-sm font-medium text-muted-foreground">
        {title} <span className="tabular">({memories.length})</span>
      </h3>
      <ul>
        {memories.map((m, i) => (
          <SourceRow
            key={m.id}
            index={i}
            memory={m}
            plan={plan}
            collectionId={collectionId}
          />
        ))}
      </ul>
    </section>
  );
}

export function SourcesPanel({
  memories,
  plan,
  collectionId,
}: {
  memories: Memory[];
  plan?: DesignPlan;
  collectionId: string;
}) {
  const ai = memories.filter(aiEligible);
  const manual = memories.filter((m) => manualEligible(m) && !aiEligible(m));
  const unavailable = memories.filter((m) => !manualEligible(m));
  return (
    <div className="space-y-4">
      <Group
        title="Ready, AI allowed"
        memories={ai}
        plan={plan}
        collectionId={collectionId}
      />
      <Group
        title="Ready"
        memories={manual}
        plan={plan}
        collectionId={collectionId}
      />
      <Group
        title="Not ready yet"
        memories={unavailable}
        plan={plan}
        collectionId={collectionId}
      />
    </div>
  );
}

function Meter({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  unit?: string;
}) {
  const over = value > max;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span>{label}</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            over && "font-semibold text-[var(--status-excluded)]",
          )}
        >
          {value.toLocaleString()} / {max.toLocaleString()}
          {unit && ` ${unit}`}
          {over && " - over budget"}
        </span>
      </div>
      <Progress
        value={Math.min(100, (value / max) * 100)}
        aria-label={`${label}: ${value} of ${max}`}
      />
    </div>
  );
}

export function BudgetPanel({ budget }: { budget: Budget }) {
  return (
    <section aria-labelledby="budget-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="budget-heading" className="text-sm font-semibold">
          AI job budget
        </h3>
        {budget.over.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--status-available)]">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Within budget
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--status-excluded)]">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Over budget
          </span>
        )}
      </div>
      <Meter
        label="Memories"
        value={budget.memories}
        max={LIMITS.activeMemories}
      />
      <Meter
        label="Visual inputs (photos + stills)"
        value={budget.visuals}
        max={LIMITS.visualsPerJob}
      />
      <Meter
        label="Longest transcript"
        value={budget.maxTranscript}
        max={LIMITS.transcriptChars}
        unit="chars"
      />
      <Meter
        label="Source text"
        value={budget.sourceText}
        max={LIMITS.sourceTextChars}
        unit="chars"
      />
      {budget.over.length > 0 && (
        <p
          role="alert"
          className="rounded-md border border-[var(--status-excluded)]/30 bg-[var(--status-excluded)]/5 p-2.5 text-xs leading-relaxed"
        >
          <strong>Reduce selection</strong> before generating:{" "}
          {budget.over.join(", ")} exceed the job limits.
          {budget.overVideoStills.length > 0 &&
            ` Select at most ${LIMITS.framesPerVideo} stills in ${budget.overVideoStills.join(", ")}.`}{" "}
        </p>
      )}
    </section>
  );
}
