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
import { PersonAvatar } from "@/components/chorus/people";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { JobStatusBadge } from "@/components/chorus/status";
import { Button } from "@/components/ui/button";
import { actions, usePrototype } from "@/features/prototype/store";
import { formatWhen, personById } from "@/features/prototype/selectors";
import type { HistoryKind } from "@/features/prototype/types";

type Filter =
  "all" | "decisions" | "processing" | "design" | "editions" | "members" | "ai";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "decisions", label: "Decisions" },
  { id: "processing", label: "Processing" },
  { id: "design", label: "Design" },
  { id: "editions", label: "Editions" },
  { id: "members", label: "Members" },
  { id: "ai", label: "AI settings" },
];

const kindMeta: Record<
  HistoryKind,
  { icon: ComponentType<{ className?: string }>; group: Exclude<Filter, "all"> }
> = {
  "collection.created": { icon: FolderPlus, group: "members" },
  "member.joined": { icon: UserPlus, group: "members" },
  "member.admitted": { icon: UserPlus, group: "members" },
  "member.removed": { icon: UserMinus, group: "members" },
  "memory.added": { icon: FilePlus2, group: "decisions" },
  "memory.revised": { icon: PenLine, group: "decisions" },
  "decision.approved": { icon: CheckCircle2, group: "decisions" },
  "decision.declined": { icon: XCircle, group: "decisions" },
  "decision.withdrawn": { icon: Undo2, group: "decisions" },
  "decision.edit-requested": { icon: PenLine, group: "decisions" },
  "job.dispatched": { icon: Cpu, group: "processing" },
  "job.finished": { icon: Cpu, group: "processing" },
  "job.failed": { icon: Ban, group: "processing" },
  "plan.created": { icon: Layers, group: "design" },
  "plan.invalidated": { icon: FileX2, group: "design" },
  "candidate.frozen": { icon: Snowflake, group: "editions" },
  "candidate.invalidated": { icon: FileX2, group: "editions" },
  "final.approved": { icon: CheckCircle2, group: "editions" },
  "final.declined": { icon: XCircle, group: "editions" },
  "edition.issued": { icon: BookCheck, group: "editions" },
  "edition.downloaded": { icon: Download, group: "editions" },
  "ai.enabled": { icon: Power, group: "ai" },
  "ai.disabled": { icon: PowerOff, group: "ai" },
  "job.invalidated": { icon: Zap, group: "processing" },
};

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function HistoryPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState<string | null>(null);

  const events = state.history
    // Workspace-wide events (AI availability) appear in every timeline.
    .filter((e) => e.collectionId === collectionId || e.collectionId === "*")
    .filter((e) => filter === "all" || kindMeta[e.kind]?.group === filter)
    .sort((a, b) => b.at.localeCompare(a.at));

  const days: { day: string; items: typeof events }[] = [];
  for (const e of events) {
    const day = dayLabel(e.at);
    const last = days[days.length - 1];
    if (last?.day === day) last.items.push(e);
    else days.push({ day, items: [e] });
  }

  const jobs = state.jobs
    .filter((j) => j.collectionId === collectionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Consent and activity history
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Every decision, withdrawal, processing job, design revision, edition
            event, and AI availability change, in order. Past events are never
            rewritten.
          </p>
        </div>
        <p className="rounded-lg border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Current permission revision{" "}
          </span>
          <span className="font-mono font-medium">
            #{state.permissionRevision}
          </span>
          <span className="text-muted-foreground"> · AI config </span>
          <span className="font-mono font-medium">
            r{state.aiConfig.revision} ({state.aiConfig.enabled ? "on" : "off"})
          </span>
        </p>
      </div>

      <div
        role="group"
        aria-label="Filter events"
        className="flex flex-wrap gap-1.5"
      >
        {filters.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filter === f.id ? "default" : "outline"}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {days.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-5" aria-hidden="true" />}
          title="No events yet"
        >
          Nothing matches this filter for the collection.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {days.map(({ day, items }) => (
            <section key={day} aria-label={day}>
              <h3 className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
                {day}
              </h3>
              <ol className="space-y-0 border-l pl-5">
                {items.map((e) => {
                  const Icon = kindMeta[e.kind]?.icon ?? Layers;
                  const actor =
                    e.actorId === "system"
                      ? null
                      : personById(state, e.actorId);
                  return (
                    <li key={e.id} className="relative py-2.5">
                      <span className="absolute top-3.5 -left-[29px] grid size-4 place-items-center rounded-full border bg-background">
                        <Icon
                          className="size-2.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        {actor ? (
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <PersonAvatar person={actor} size="sm" />
                            {actor.name}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
                            <span className="grid size-6 place-items-center rounded-full bg-muted">
                              <Cpu className="size-3" aria-hidden="true" />
                            </span>
                            System
                          </span>
                        )}
                        <span>{e.summary}</span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 pl-[30px] text-xs text-muted-foreground">
                        <time dateTime={e.at}>{formatWhen(e.at)}</time>
                        {e.resource && (
                          <span className="font-mono">{e.resource}</span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      <section aria-labelledby="jobs-heading" className="space-y-3">
        <h2 id="jobs-heading" className="text-lg font-semibold tracking-tight">
          Processing jobs
        </h2>
        {notice && (
          <p role="status" className="rounded-lg border bg-card p-3 text-sm">
            {notice}
          </p>
        )}
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No processing jobs have run for this collection.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Job
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Processor
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Memories
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{j.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatWhen(j.createdAt)}
                        {j.configRevision !== undefined && (
                          <>
                            {" "}
                            · admitted under AI config{" "}
                            <span className="font-mono">
                              r{j.configRevision}
                            </span>
                          </>
                        )}
                      </p>
                      {j.error && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {j.error}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {state.processors.find((p) => p.id === j.processorId)
                        ?.name ?? j.processorId}
                    </td>
                    <td className="px-4 py-3">{j.memoryIds.length}</td>
                    <td className="px-4 py-3">
                      <JobStatusBadge status={j.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {j.status === "failed" &&
                        j.processorId === "designer" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const r = actions.generateDesign(collectionId);
                              setNotice(
                                r.ok
                                  ? "Retry started. A new job is running."
                                  : r.reason,
                              );
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TrustNote>
        History is shown only to collection members. Private explanations for a
        decline are never recorded or exported. Turning AI off is an operator
        setting, not a withdrawal: it changes no contributor permission.
        Telemetry and error traces exclude media, transcripts, style prompts,
        and tokens. Prototype: these events live in this browser, not in an
        authoritative log.
      </TrustNote>
    </div>
  );
}
