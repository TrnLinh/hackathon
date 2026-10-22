import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { MemoryThumb } from "@/components/chorus/memory-thumb";
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

function SourceRow({
  memory,
  plan,
  collectionId,
}: {
  memory: Memory;
  plan?: DesignPlan;
  collectionId: string;
}) {
  const usage = usageOf(plan, memory.id);
  return (
    <li>
      <Link
        to="/collections/$collectionId/memories/$memoryId"
        params={{ collectionId, memoryId: memory.id }}
        className="flex items-center gap-2.5 rounded-lg p-1 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MemoryThumb memory={memory} className="size-9 shrink-0 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{memory.title}</span>
          {manualEligible(memory) ? (
            <span
              className={cn(
                "block text-[11px]",
                usage === "unused"
                  ? "text-muted-foreground"
                  : "text-[var(--status-available)]",
              )}
            >
              {usageLabel[usage]}
            </span>
          ) : (
            <MemoryStatusBadge
              status={memoryStatus(memory)}
              className="mt-0.5 h-5 px-2 text-[11px]"
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
    <section aria-label={title} className="space-y-1.5">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title} <span className="font-normal">({memories.length})</span>
      </h3>
      {memories.length > 0 ? (
        <ul className="space-y-0.5">
          {memories.map((m) => (
            <SourceRow
              key={m.id}
              memory={m}
              plan={plan}
              collectionId={collectionId}
            />
          ))}
        </ul>
      ) : (
        <p className="py-1 text-xs text-muted-foreground italic">None</p>
      )}
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
    <div className="space-y-5">
      <Group
        title="Ready · AI ok"
        memories={ai}
        plan={plan}
        collectionId={collectionId}
      />
      <Group
        title="Ready · no AI"
        memories={manual}
        plan={plan}
        collectionId={collectionId}
      />
      <Group
        title="Not available"
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
          {over && " — over budget"}
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
