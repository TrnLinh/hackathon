import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  Hand,
  PowerOff,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { JobStatusBadge } from "@/components/chorus/status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { actions } from "@/features/prototype/store";
import { formatWhen, LIMITS } from "@/features/prototype/selectors";
import type {
  DesignPlan,
  ProcessingJob,
  Processor,
} from "@/features/prototype/types";
import {
  codePoints,
  hasAiLineage,
  originLabel,
  provenanceSummary,
} from "./plan-utils";

export function AiPanel({
  collectionId,
  aiEnabled,
  designer,
  jobs,
  eligibleCount,
  overBudget,
  hasPlan,
  onManual,
}: {
  collectionId: string;
  /** Server-reported runtime availability (CH-22). */
  aiEnabled: boolean;
  designer?: Processor;
  jobs: ProcessingJob[];
  eligibleCount: number;
  overBudget: boolean;
  hasPlan: boolean;
  onManual: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState<string | undefined>();
  const [message, setMessage] = useState<string | null>(null);
  const designJobs = jobs
    .filter((j) => j.processorId === "designer")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const active = designJobs.find(
    (j) => j.status === "running" || j.status === "queued",
  );
  const latest = designJobs[0];
  const offline = designer?.health === "offline";
  const promptLength = codePoints(prompt);
  const promptTooLong = promptLength > LIMITS.promptChars;
  const blocked = Boolean(active) || overBudget || eligibleCount === 0;

  function run(withPrompt?: string) {
    const trimmed = withPrompt?.trim() || undefined;
    setLastPrompt(trimmed);
    const result = actions.generateDesign(collectionId, trimmed);
    setMessage(result.ok ? null : result.reason);
  }

  const jobStatus = latest && (
    <div className="space-y-2 rounded-lg border bg-card p-3" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium">
          {latest.label}
        </span>
        <JobStatusBadge status={latest.status} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Started {formatWhen(latest.createdAt)}
      </p>
      {active && (
        <Button
          size="xs"
          variant="outline"
          onClick={() => actions.cancelJob(active.id)}
        >
          <Ban aria-hidden="true" />
          Cancel
        </Button>
      )}
      {latest.status === "failed" && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed">{latest.error}</p>
          <p className="text-[11px] text-muted-foreground">
            No content was sent to any other provider.
          </p>
          <div className="flex flex-wrap gap-2">
            {aiEnabled && (
              <Button
                size="xs"
                variant="outline"
                disabled={blocked}
                onClick={() => run(lastPrompt)}
              >
                <RefreshCw aria-hidden="true" />
                Retry
              </Button>
            )}
            <Button size="xs" variant="ghost" onClick={onManual}>
              <Hand aria-hidden="true" />
              Continue manually
            </Button>
          </div>
        </div>
      )}
      {latest.status === "cancelled" && latest.error && (
        <p className="text-xs text-muted-foreground">{latest.error}</p>
      )}
    </div>
  );

  if (!aiEnabled)
    return (
      <section aria-labelledby="ai-heading" className="space-y-3">
        <h3
          id="ai-heading"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <PowerOff
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          AI is off
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          An operator turned AI off for this workspace. Templates and manual
          editing work exactly the same, and no model is contacted.{" "}
          <Link to="/processors" className="underline underline-offset-2">
            AI processors
          </Link>
        </p>
        {jobStatus}
      </section>
    );

  return (
    <section aria-labelledby="ai-heading" className="space-y-3">
      <h3
        id="ai-heading"
        className="flex items-center gap-2 text-sm font-semibold"
      >
        <Sparkles className="size-4 text-primary" aria-hidden="true" />
        Create with AI
      </h3>
      {offline && (
        <p
          role="alert"
          className="flex gap-2 rounded-md border border-[var(--status-excluded)]/30 bg-[var(--status-excluded)]/5 p-2.5 text-xs leading-relaxed"
        >
          <AlertTriangle
            className="mt-0.5 size-3.5 shrink-0 text-[var(--status-excluded)]"
            aria-hidden="true"
          />
          <span>
            Team designer is offline, so generation will fail. Chorus will not
            switch to another provider.{" "}
            <Link to="/processors" className="underline underline-offset-2">
              Check AI processors
            </Link>{" "}
            or continue manually.
          </span>
        </p>
      )}
      <Button
        className="w-full"
        disabled={blocked}
        onClick={() => run(undefined)}
      >
        <Sparkles aria-hidden="true" />
        {hasPlan ? "Generate a new design" : "Generate from my memories"}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Uses {eligibleCount} AI-approved memor
        {eligibleCount === 1 ? "y" : "ies"}. No style prompt is needed.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="style-prompt" className="text-xs">
          Optional style prompt or refinement
        </Label>
        <Textarea
          id="style-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. make it more playful"
          rows={2}
          aria-invalid={promptTooLong}
          aria-describedby="style-prompt-count"
        />
        <div className="flex items-center justify-between gap-2">
          <span
            id="style-prompt-count"
            className={cn(
              "text-[11px] text-muted-foreground tabular-nums",
              promptTooLong && "font-medium text-[var(--status-excluded)]",
            )}
          >
            {promptLength} / {LIMITS.promptChars}
            {promptTooLong && " — too long"}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={blocked || !prompt.trim() || promptTooLong}
            onClick={() => run(prompt)}
          >
            Refine
          </Button>
        </div>
      </div>
      {message && (
        <p role="alert" className="text-xs text-[var(--status-excluded)]">
          {message}
        </p>
      )}
      {jobStatus}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Sends approved derivatives to{" "}
        <strong>{designer?.name ?? "Team designer"}</strong> (
        {designer?.endpoint ?? "team cloud"}). {designer?.retention} The model
        returns a structured plan only, never code, external URLs, or a finished
        PDF.
      </p>
    </section>
  );
}

export function RevisionList({
  plans,
  selectedId,
  onSelect,
}: {
  plans: DesignPlan[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  if (plans.length === 0) return null;
  const sorted = [...plans].sort((a, b) => b.revision - a.revision);
  return (
    <section aria-labelledby="revisions-heading" className="space-y-2">
      <h3 id="revisions-heading" className="text-sm font-semibold">
        Design revisions
      </h3>
      <ul className="space-y-1">
        {sorted.map((plan) => (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => onSelect(plan.id)}
              aria-pressed={plan.id === selectedId}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                plan.id === selectedId
                  ? "border-primary bg-secondary"
                  : "border-transparent",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  Revision {plan.revision} · {originLabel[plan.origin]}
                </span>
                <span className="text-muted-foreground">
                  {formatWhen(plan.createdAt)}
                </span>
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                {plan.tokens.name}
                {plan.prompt && ` · “${plan.prompt}”`}
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                {provenanceSummary(plan)}
              </span>
              {hasAiLineage(plan) && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium">
                  <Sparkles className="size-3" aria-hidden="true" />
                  AI lineage
                </span>
              )}
              {plan.invalidatedReason && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--status-excluded)]/30 bg-[var(--status-excluded)]/5 px-2 py-0.5 font-medium text-[var(--status-excluded)]">
                  <Ban className="size-3" aria-hidden="true" />
                  Invalidated: {plan.invalidatedReason}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
