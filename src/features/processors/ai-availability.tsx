import { useState } from "react";
import { Power, PowerOff, ShieldAlert } from "lucide-react";
import { Disclosure } from "@/components/chorus/primitives";
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
  <p
    role="status"
    className="rounded-3xl bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-soft ring-1 ring-border sm:p-6"
  >
    AI is off. We can’t read the setting right now. Templates and manual editing
    still work.
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
    <section
      aria-labelledby="ai-availability"
      className="space-y-4 rise rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border sm:p-6"
    >
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-2xl",
            enabled
              ? "bg-lime text-lime-ink"
              : "bg-muted text-muted-foreground",
          )}
        >
          <StateIcon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="ai-availability"
            className="text-3xl font-semibold tracking-tight"
          >
            {loading ? "Checking…" : `AI is ${enabled ? "on" : "off"}`}
          </h2>
          <p
            id="ai-switch-help"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {isOperator
              ? "Turn it on to let AI help with designs. Templates work either way."
              : capabilities?.signedIn
                ? "Only the operator can change this"
                : "Sign in as the operator to change this"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-busy={loading || pending}
          aria-label="AI helpers"
          aria-describedby="ai-switch-help"
          disabled={!isOperator || !config || pending}
          onClick={() => void toggle()}
          className={cn(
            "press relative inline-flex h-11 w-[4.5rem] shrink-0 items-center rounded-full p-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
            enabled ? "bg-lime ring-1 ring-lime-ink/20" : "bg-input",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block size-9 rounded-full bg-background shadow-soft transition-transform duration-300 ease-out",
              enabled ? "translate-x-7" : "translate-x-0",
            )}
          />
        </button>
      </div>

      {message && (
        <p role="alert" className="text-sm text-[var(--status-excluded)]">
          {message}
        </p>
      )}
      {capabilities && !capabilities.processorsConfigured && (
        <p className="flex items-start gap-2 text-sm text-[var(--status-awaiting)]">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          AI helpers aren’t set up, so AI can’t be turned on.
        </p>
      )}

      <Disclosure summary="Details">
        <p>
          The server decides. It checks when a job starts and again right before
          anything is sent. If the setting is missing or can’t be read, AI is
          off.
        </p>
        <p>
          Turning AI off cancels queued jobs and discards late results. Anything
          already sent can’t be recalled. Turning it on grants no permission:
          every memory still needs its own AI approval. Templates, manual
          editing, approvals and downloads work either way.
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>Revision</span>
          <span className="tabular font-mono">r{config?.revision ?? 0}</span>
          <span>Last changed by</span>
          <span>
            {config?.changedAt
              ? `${latest?.changedByYou ? "You" : (latest?.changedByName ?? "An operator")}, ${formatTime(config.changedAt)}`
              : "nobody yet (off by default)"}
          </span>
        </p>
        <div className="space-y-2">
          <p className="font-medium text-foreground">Change log</p>
          {audit.length === 0 ? (
            <p>
              {capabilities?.signedIn
                ? "No changes yet."
                : "Sign in to see who changed it and when."}
            </p>
          ) : (
            <ol className="space-y-1.5">
              {audit.map((e) => (
                <li key={e.revision} className="flex flex-wrap gap-x-3">
                  <span className="min-w-0 flex-1">
                    Turned AI {e.enabled ? "on" : "off"} (revision {e.revision})
                  </span>
                  <span>
                    {e.changedByYou
                      ? "You"
                      : (e.changedByName ?? "An operator")}
                    , {formatTime(e.changedAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p>The log never contains prompts or memory content.</p>
        </div>
      </Disclosure>
    </section>
  );
}
