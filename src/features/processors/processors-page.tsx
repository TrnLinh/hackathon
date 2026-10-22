import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { Cpu, ShieldCheck } from "lucide-react";
import { PageHeader, TrustNote } from "@/components/chorus/page-header";
import { JobStatusBadge } from "@/components/chorus/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// CH-21: disclosure of the team-cloud inference services, with a health
// switch for demonstrating outages and manual recovery.

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
    label: "Degraded",
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

function ProcessorCard({ processor }: { processor: Processor }) {
  const selectId = useId();
  const health = healthMeta[processor.health];
  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" aria-hidden="true" />
              {processor.name}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {processor.role}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium">
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", health.dot)}
            />
            {health.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[120px_minmax(0,1fr)]">
          <dt className="text-xs text-muted-foreground">Receives</dt>
          <dd>
            <ul className="space-y-0.5">
              {processor.receives.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </dd>
          <dt className="text-xs text-muted-foreground">Retention</dt>
          <dd>{processor.retention}</dd>
          <dt className="text-xs text-muted-foreground">Model</dt>
          <dd>{processor.model}</dd>
          <dt className="text-xs text-muted-foreground">Runtime</dt>
          <dd>{processor.runtime}</dd>
          <dt className="text-xs text-muted-foreground">Endpoint</dt>
          <dd>
            <code className="font-mono text-xs break-all">
              {processor.endpoint}
            </code>{" "}
            <span className="text-xs text-muted-foreground">
              (internal, authenticated)
            </span>
          </dd>
          <dt className="text-xs text-muted-foreground">Used for</dt>
          <dd>{processor.appliesTo.join(", ")}</dd>
        </dl>
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 p-3">
          <Label htmlFor={selectId} className="text-xs">
            Simulate health
          </Label>
          <Select
            value={processor.health}
            onValueChange={(v) =>
              actions.setProcessorHealth(processor.id, v as Processor["health"])
            }
          >
            <SelectTrigger id={selectId} className="h-8 w-36 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
          <p className="basis-full text-xs text-muted-foreground">
            {health.detail}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProcessorsPage() {
  const state = usePrototype();
  const jobs = [...state.jobs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Disclosed recipients"
        title="AI processors"
        description="The inference services Chorus may send approved derivatives to. Each runs in the team’s cloud and only receives content after every person involved grants that specific processor."
      />

      <section aria-label="Processors" className="grid gap-5 xl:grid-cols-3">
        {state.processors.map((p) => (
          <ProcessorCard key={p.id} processor={p} />
        ))}
      </section>
      <p className="-mt-6 text-xs text-muted-foreground">
        Model weights, runtime versions, and GPU capacity are pending the CH-21
        selection. Health controls are a prototype tool for demonstrating
        outages.
      </p>

      <section
        aria-labelledby="data-handling"
        className="grid gap-6 lg:grid-cols-2"
      >
        <div className="space-y-3">
          <h2
            id="data-handling"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <ShieldCheck className="size-4" aria-hidden="true" /> Data handling
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>
              TLS on every connection; anonymous requests to the endpoints are
              rejected.
            </li>
            <li>
              Service credentials stay on the server and are never shipped to
              the browser.
            </li>
            <li>No logging of prompts, media, or transcripts.</li>
            <li>
              No training on requests; temporary data is deleted after each
              response.
            </li>
            <li>
              No managed AI API as a fallback. If a processor is down, the job
              fails and you can retry or{" "}
              <Link to="/collections" className="underline underline-offset-2">
                continue manually
              </Link>
              .
            </li>
            <li>Endpoint access never replaces contributor permission.</li>
          </ul>
        </div>
        <TrustNote className="self-start text-sm">
          <p className="font-medium text-foreground">
            Who can see what you approve
          </p>
          <p className="mt-1">
            Self-hosting changes who receives your memories, not whether someone
            does. The model process, and cloud operators with enough privileges,
            can see the plaintext derivatives you authorize. Content already
            sent to a processor cannot be recalled.
          </p>
        </TrustNote>
      </section>

      <section aria-labelledby="budgets" className="space-y-3">
        <h2 id="budgets" className="text-lg font-semibold tracking-tight">
          Budgets
        </h2>
        <p className="text-sm text-muted-foreground">
          Initial engineering limits from the SRD, enforced before any dispatch.
          Over-budget selections require you to reduce them; nothing is silently
          truncated.
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">Processing budgets</caption>
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Limit
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {budgets.map((b) => (
                <tr key={b.label}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {b.label}
                  </th>
                  <td className="px-3 py-2 font-mono text-xs">{b.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="recent-jobs" className="space-y-3">
        <h2 id="recent-jobs" className="text-lg font-semibold tracking-tight">
          Recent jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
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
                  className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{job.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {processor?.name ?? job.processorId} ·{" "}
                      {collection?.title ?? "Unknown collection"} ·{" "}
                      {formatWhen(job.createdAt)}
                    </p>
                    {job.error && (
                      <p className="mt-1 text-xs text-[var(--status-excluded)]">
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
      </section>
    </div>
  );
}
