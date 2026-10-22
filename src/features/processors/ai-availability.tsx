import { useState } from "react";
import { History, Power, PowerOff, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  BackendOnly,
  formatTime,
  QueryBoundary,
} from "@/features/data/backend";
import {
  useAiCapabilities,
  useAiConfig,
  useAiHistory,
  useSetAiEnabled,
} from "@/features/data/ai-config";

// CH-22: runtime AI availability. The server is the source of truth; this card
// only reflects it and lets an authorized operator change it.

const unreadable = (
  <p role="status" className="text-sm text-muted-foreground">
    AI is off. Availability can’t be read from the backend right now; templates
    and manual editing still work.
  </p>
);

export function AiAvailabilityCard() {
  return (
    <BackendOnly fallback={unreadable}>
      <QueryBoundary fallback={unreadable}>
        <ConnectedAiAvailabilityCard />
      </QueryBoundary>
    </BackendOnly>
  );
}

function ConnectedAiAvailabilityCard() {
  const config = useAiConfig();
  const capabilities = useAiCapabilities();
  const audit = useAiHistory() ?? [];
  const setAiEnabled = useSetAiEnabled();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Missing or unreadable configuration means off.
  const enabled = config?.enabled ?? false;
  const isOperator = capabilities?.isOperator ?? false;
  const latest = audit.find((e) => e.revision === config?.revision);
  const loading = config === undefined;
  const StateIcon = enabled ? Power : PowerOff;

  async function toggle() {
    if (!config) return;
    setPending(true);
    const result = await setAiEnabled(!config.enabled, config.revision);
    setPending(false);
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
              enabled
                ? "border-[color-mix(in_srgb,var(--status-available)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-available)_10%,transparent)] text-[var(--status-available)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            <StateIcon className="size-4" aria-hidden="true" />
            {loading ? "Checking…" : `AI is ${enabled ? "on" : "off"}`}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/60 p-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-busy={loading || pending}
            aria-label="AI processing"
            aria-describedby="ai-switch-help"
            disabled={!isOperator || !config || pending}
            onClick={() => void toggle()}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
              enabled ? "bg-primary" : "bg-input",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "inline-block size-5 rounded-full bg-background shadow transition-transform",
                enabled ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              {enabled ? "Turn AI off" : "Turn AI on"}
            </p>
            <p id="ai-switch-help" className="text-xs text-muted-foreground">
              {isOperator
                ? "You’re signed in as an authorized operator. The change is audited."
                : capabilities?.signedIn
                  ? "Only an authorized operator can change this."
                  : "Sign in as an authorized operator to change this."}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Configuration revision</dt>
            <dd className="font-mono">r{config?.revision ?? 0}</dd>
            <dt className="text-muted-foreground">Last changed</dt>
            <dd>
              {config?.changedAt
                ? `${latest?.changedByYou ? "You" : (latest?.changedByName ?? "An operator")} · ${formatTime(config.changedAt)}`
                : "Never (off by default)"}
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

        {capabilities && !capabilities.processorsConfigured && (
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
            <p className="text-xs text-muted-foreground">
              {capabilities?.signedIn
                ? "No changes yet."
                : "Sign in to see who changed availability and when."}
            </p>
          ) : (
            <ol className="divide-y rounded-lg border">
              {audit.map((e) => (
                <li
                  key={e.revision}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs"
                >
                  {e.enabled ? (
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
                  <span className="min-w-0 flex-1">
                    Turned AI {e.enabled ? "on" : "off"} (configuration revision{" "}
                    {e.revision})
                  </span>
                  <span className="text-muted-foreground">
                    {e.changedByYou
                      ? "You"
                      : (e.changedByName ?? "An operator")}{" "}
                    · {formatTime(e.changedAt)}
                  </span>
                </li>
              ))}
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
