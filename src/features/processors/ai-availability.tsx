import { useState } from "react";
import { History, Power, PowerOff, ShieldAlert } from "lucide-react";
import { PersonAvatar } from "@/components/chorus/people";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { actions, usePrototype } from "@/features/prototype/store";
import { formatWhen, personById } from "@/features/prototype/selectors";

// CH-22: runtime AI availability. The server is the source of truth; this card
// only reflects it and lets an authorized operator change it.

export function AiAvailabilityCard() {
  const state = usePrototype();
  const [message, setMessage] = useState<string | null>(null);
  const config = state.aiConfig;
  const viewer = personById(state, state.viewerId);
  const isOperator = !!viewer.operator;
  const changedBy =
    config.changedBy === "system" ? null : personById(state, config.changedBy);
  const audit = state.history
    .filter((e) => e.kind === "ai.enabled" || e.kind === "ai.disabled")
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);
  const StateIcon = config.enabled ? Power : PowerOff;

  function toggle() {
    const result = actions.setAiEnabled(!config.enabled);
    setMessage(result.ok ? null : result.reason);
  }

  return (
    <Card className="shadow-none" aria-labelledby="ai-availability">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle id="ai-availability" className="text-base">
              AI availability
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              One workspace-wide switch for design generation, refinement,
              transcription, and visual analysis.
            </p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium",
              config.enabled
                ? "border-[color-mix(in_srgb,var(--status-available)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-available)_10%,transparent)] text-[var(--status-available)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <StateIcon className="size-4" aria-hidden="true" />
            AI is {config.enabled ? "on" : "off"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/60 p-3">
          <button
            type="button"
            role="switch"
            aria-checked={config.enabled}
            aria-label="AI processing"
            aria-describedby="ai-switch-help"
            disabled={!isOperator}
            onClick={toggle}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              config.enabled ? "bg-primary" : "bg-input",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-block size-5 rounded-full bg-background shadow transition-transform",
                config.enabled ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {config.enabled ? "Turn AI off" : "Turn AI on"}
            </p>
            <p id="ai-switch-help" className="text-xs text-muted-foreground">
              {isOperator
                ? "You’re signed in as an authorized operator. The change is audited."
                : "Only an authorized operator can change this. Switch to Avery Kim (operator) in Viewing as to try it."}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Configuration revision</dt>
            <dd className="font-mono">r{config.revision}</dd>
            <dt className="text-muted-foreground">Last changed</dt>
            <dd className="inline-flex items-center gap-1.5">
              {changedBy && <PersonAvatar person={changedBy} size="sm" />}
              {changedBy?.name ?? "System"} · {formatWhen(config.changedAt)}
            </dd>
          </dl>
          {message && (
            <p
              role="alert"
              className="basis-full text-xs text-[var(--status-excluded)]"
            >
              {message}
            </p>
          )}
        </div>

        <ul className="grid gap-3 text-sm leading-relaxed sm:grid-cols-2">
          <li>
            <p className="font-medium">The server decides</p>
            <p className="text-muted-foreground">
              Availability is checked when a job is admitted and again right
              before anything is sent. If the configuration is missing or
              unreadable, AI is off.
            </p>
          </li>
          <li>
            <p className="font-medium">Turning it off</p>
            <p className="text-muted-foreground">
              Cancels queued jobs and invalidates running ones; late results are
              discarded. Anything already sent to a processor can’t be recalled.
            </p>
          </li>
          <li>
            <p className="font-medium">Turning it on</p>
            <p className="text-muted-foreground">
              Resumes nothing and processes no existing drafts. It grants no
              contributor permission: every source still needs its own AI
              approval.
            </p>
          </li>
          <li>
            <p className="font-medium">Always available</p>
            <p className="text-muted-foreground">
              Templates, manual editing, approvals, receipts, and downloads work
              either way. Accepted AI designs stay editable.
            </p>
          </li>
        </ul>

        {!config.processorsConfigured && (
          <p className="flex items-start gap-2 text-xs text-[var(--status-awaiting)]">
            <ShieldAlert className="mt-0.5 size-3.5" aria-hidden="true" />
            Processor roles aren’t configured, so AI can’t be turned on.
          </p>
        )}

        <div className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <History className="size-4" aria-hidden="true" />
            Audit log
          </h3>
          {audit.length === 0 ? (
            <p className="text-xs text-muted-foreground">No changes yet.</p>
          ) : (
            <ol className="divide-y rounded-lg border">
              {audit.map((e) => {
                const actor =
                  e.actorId === "system" ? null : personById(state, e.actorId);
                return (
                  <li
                    key={e.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs"
                  >
                    {e.kind === "ai.enabled" ? (
                      <Power
                        className="size-3.5 text-[var(--status-available)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <PowerOff
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1">{e.summary}</span>
                    <span className="text-muted-foreground">
                      {actor?.name ?? "System"} · {formatWhen(e.at)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">
            The audit records who changed availability and when. It never
            contains prompts or memory content.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
