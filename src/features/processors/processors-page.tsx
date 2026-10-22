import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { JobStatusBadge } from "@/components/chorus/status";
import { PageHeader } from "@/components/chorus/page-header";
import { Disclosure } from "@/components/chorus/primitives";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { actions, usePrototype } from "@/features/prototype/store";
import {
  formatBytes,
  formatWhen,
  LIMITS,
} from "@/features/prototype/selectors";
import type { Processor } from "@/features/prototype/types";
import { AiAvailabilityCard } from "./ai-availability";

// CH-21/CH-22: runtime AI availability, disclosure of the team-cloud
// inference services, and a health switch for demonstrating outages.

const healthMeta: Record<
  Processor["health"],
  { label: string; detail: string; dot: string }
> = {
  online: {
    label: "Online",
    detail: "Accepting authorized jobs.",
    dot: "bg-[var(--status-available)]",
  },
  degraded: {
    label: "Slow",
    detail: "Slow responses; jobs may hit their deadline.",
    dot: "bg-[var(--status-awaiting)]",
  },
  offline: {
    label: "Offline",
    detail:
      "Jobs fail without sending content anywhere else. Manual editing stays available.",
    dot: "bg-[var(--status-excluded)]",
  },
};

const budgets: { label: string; value: string }[] = [
  {
    label: "Active memories per collection",
    value: String(LIMITS.activeMemories),
  },
  {
    label: "Selected upload bytes per composition",
    value: formatBytes(LIMITS.collectionBytes),
  },
  {
    label: "Image size / decoded pixels",
    value: `${formatBytes(LIMITS.imageBytes)} / ${LIMITS.imageMegapixels} MP`,
  },
  {
    label: "Audio length / size",
    value: `${LIMITS.audioSeconds} s / ${formatBytes(LIMITS.audioBytes)}`,
  },
  {
    label: "Video length / size",
    value: `${LIMITS.videoSeconds} s / ${formatBytes(LIMITS.videoBytes)}`,
  },
  { label: "Sampled frames per video", value: String(LIMITS.framesPerVideo) },
  {
    label: "Visual inputs per AI job",
    value: `${LIMITS.visualsPerJob} at 1280 px long edge`,
  },
  {
    label: "Transcript per recording",
    value: `${LIMITS.transcriptChars.toLocaleString()} code points`,
  },
  {
    label: "Source text per AI job",
    value: `${LIMITS.sourceTextChars.toLocaleString()} code points`,
  },
  {
    label: "Style prompt or refinement",
    value: `${LIMITS.promptChars} code points`,
  },
  { label: "Active AI jobs per collection", value: "1" },
];

function ProcessorRow({
  processor,
  aiEnabled,
}: {
  processor: Processor;
  aiEnabled: boolean;
}) {
  const selectId = useId();
  const health = aiEnabled
    ? healthMeta[processor.health]
    : {
        label: "Not in use",
        detail:
          "Not contacted while AI is off. Chorus sends no requests or health checks to it.",
        dot: "bg-muted-foreground/50",
      };
  return (
    <li className="rise space-y-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{processor.name}</h3>
          <p className="text-sm text-muted-foreground">{processor.role}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium">
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", health.dot)}
          />
          {health.label}
        </span>
      </div>
      <Disclosure summary="Practice a failure">
        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor={selectId} className="text-sm">
            Simulate health
          </Label>
          <Select
            value={processor.health}
            onValueChange={(v) =>
              actions.setProcessorHealth(processor.id, v as Processor["health"])
            }
          >
            <SelectTrigger
              id={selectId}
              className="h-12 w-44 bg-background data-[size=default]:h-12 sm:data-[size=default]:h-12"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="degraded">Slow</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p>{health.detail}</p>
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[110px_minmax(0,1fr)]">
          <dt>Receives</dt>
          <dd className="text-foreground">{processor.receives.join(", ")}</dd>
          <dt>Retention</dt>
          <dd className="text-foreground">{processor.retention}</dd>
          <dt>Model</dt>
          <dd className="text-foreground">{processor.model}</dd>
          <dt>Runtime</dt>
          <dd className="text-foreground">{processor.runtime}</dd>
          <dt>Endpoint</dt>
          <dd>
            <code className="font-mono text-sm break-all text-foreground">
              {processor.endpoint}
            </code>
          </dd>
          <dt>Used for</dt>
          <dd className="text-foreground">{processor.appliesTo.join(", ")}</dd>
        </dl>
      </Disclosure>
    </li>
  );
}

export function ProcessorsPage() {
  const state = usePrototype();
  const jobs = [...state.jobs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <PageHeader
        title="AI helpers"
        description="Optional. Friends approve each helper before it sees anything."
      />

      <AiAvailabilityCard />

      <ul aria-label="AI helpers" className="space-y-3">
        {state.processors.map((p) => (
          <ProcessorRow
            key={p.id}
            processor={p}
            aiEnabled={state.aiConfig.enabled}
          />
        ))}
      </ul>

      <Disclosure summary="Data handling and limits">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Every connection uses TLS; anonymous requests are rejected.</li>
          <li>Service credentials stay on the server.</li>
          <li>No logging of prompts, media, or transcripts.</li>
          <li>
            No training on requests; temporary data is deleted after each
            response.
          </li>
          <li>
            No outside AI fallback. If a helper is down, the job fails and you
            can retry or{" "}
            <Link to="/collections" className="underline underline-offset-2">
              continue manually
            </Link>
            .
          </li>
        </ul>
        <p>
          The model process, and cloud operators with enough privileges, can see
          the content you authorize. Content already sent can’t be recalled.
        </p>
        <dl className="divide-y">
          {budgets.map((b) => (
            <div key={b.label} className="flex justify-between gap-4 py-1.5">
              <dt>{b.label}</dt>
              <dd className="tabular text-right font-mono text-foreground">
                {b.value}
              </dd>
            </div>
          ))}
        </dl>
      </Disclosure>

      <Disclosure summary={`Recent jobs (${jobs.length})`}>
        {jobs.length === 0 ? (
          <p>No jobs yet.</p>
        ) : (
          <ul className="divide-y">
            {jobs.map((job) => {
              const collection = state.collections.find(
                (c) => c.id === job.collectionId,
              );
              const processor = state.processors.find(
                (p) => p.id === job.processorId,
              );
              return (
                <li
                  key={job.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{job.label}</p>
                    <p>
                      {processor?.name ?? job.processorId},{" "}
                      {collection?.title ?? "Unknown zine"},{" "}
                      {formatWhen(job.createdAt)}
                    </p>
                    {job.error && (
                      <p className="mt-1 text-[var(--status-excluded)]">
                        {job.error}
                      </p>
                    )}
                  </div>
                  <JobStatusBadge status={job.status} />
                </li>
              );
            })}
          </ul>
        )}
      </Disclosure>
    </div>
  );
}
