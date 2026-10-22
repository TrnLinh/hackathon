import { useState, type ComponentType } from "react";
import {
  Ban,
  BookCheck,
  CheckCircle2,
  Cpu,
  Download,
  FilePlus2,
  FileX2,
  FolderPlus,
  Layers,
  PenLine,
  Power,
  PowerOff,
  RefreshCw,
  Snowflake,
  Undo2,
  UserMinus,
  UserPlus,
  XCircle,
  Zap,
} from "lucide-react";
import { EmptyState } from "@/components/chorus/page-header";
import { Disclosure } from "@/components/chorus/primitives";
import { JobStatusBadge } from "@/components/chorus/status";
import { Button } from "@/components/ui/button";
import { actions, usePrototype } from "@/features/prototype/store";
import { formatWhen, personById } from "@/features/prototype/selectors";
import type { HistoryKind } from "@/features/prototype/types";

const kindIcon: Record<HistoryKind, ComponentType<{ className?: string }>> = {
  "collection.created": FolderPlus,
  "member.joined": UserPlus,
  "member.admitted": UserPlus,
  "member.removed": UserMinus,
  "memory.added": FilePlus2,
  "memory.revised": PenLine,
  "decision.approved": CheckCircle2,
  "decision.declined": XCircle,
  "decision.withdrawn": Undo2,
  "decision.edit-requested": PenLine,
  "job.dispatched": Cpu,
  "job.finished": Cpu,
  "job.failed": Ban,
  "plan.created": Layers,
  "plan.invalidated": FileX2,
  "candidate.frozen": Snowflake,
  "candidate.invalidated": FileX2,
  "final.approved": CheckCircle2,
  "final.declined": XCircle,
  "edition.issued": BookCheck,
  "edition.downloaded": Download,
  "ai.enabled": Power,
  "ai.disabled": PowerOff,
  "job.invalidated": Zap,
};

export function HistoryPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const [notice, setNotice] = useState<string | null>(null);

  const events = state.history
    // Workspace-wide events (AI availability) appear in every timeline.
    .filter((e) => e.collectionId === collectionId || e.collectionId === "*")
    .sort((a, b) => b.at.localeCompare(a.at));

  const jobs = state.jobs
    .filter((j) => j.collectionId === collectionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-in fade-in-0 slide-in-from-bottom-2">
      <h2 className="text-xl font-semibold tracking-tight">History</h2>

      {events.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-5" aria-hidden="true" />}
          title="Nothing yet"
        />
      ) : (
        <ol className="space-y-1">
          {events.map((e) => {
            const Icon = kindIcon[e.kind] ?? Layers;
            const actor =
              e.actorId === "system" ? null : personById(state, e.actorId);
            return (
              <li key={e.id} className="flex items-start gap-3 py-2">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base leading-snug">
                    <span className="font-medium">
                      {actor ? actor.name : "Chorus"}
                    </span>{" "}
                    {e.summary}
                  </p>
                  <time
                    dateTime={e.at}
                    className="text-sm text-muted-foreground"
                  >
                    {formatWhen(e.at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {jobs.length > 0 && (
        <Disclosure summary="AI helper runs">
          {notice && (
            <p role="status" className="text-foreground">
              {notice}
            </p>
          )}
          <ul className="divide-y">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{j.label}</p>
                  <p>
                    {state.processors.find((p) => p.id === j.processorId)
                      ?.name ?? j.processorId}
                    , {formatWhen(j.createdAt)}
                  </p>
                  {j.error && <p>{j.error}</p>}
                </div>
                <JobStatusBadge status={j.status} />
                {j.status === "failed" && j.processorId === "designer" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const r = actions.generateDesign(collectionId);
                      setNotice(r.ok ? "Trying again." : r.reason);
                    }}
                  >
                    <RefreshCw aria-hidden="true" /> Retry
                  </Button>
                )}
                {(j.status === "running" || j.status === "queued") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => actions.cancelJob(j.id)}
                  >
                    Cancel
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}
