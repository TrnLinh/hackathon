import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Details" collapsible. Technical or secondary information lives here so the
 * main view stays short. Native <details> keeps it keyboard and screen-reader
 * friendly with no JavaScript state.
 */
export function Disclosure({
  summary = "Details",
  children,
  defaultOpen = false,
  className,
}: {
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn(
        "group rounded-2xl bg-muted/60 px-4 py-1 open:bg-muted/80",
        className,
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-muted-foreground transition-colors select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        <span>{summary}</span>
        <ChevronDown
          className="size-4 transition-transform duration-200 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-3 pt-1 pb-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

export type Step = {
  key: string;
  label: string;
  state: "done" | "current" | "todo";
  /** Optional in-app destination for the step. */
  to?: string;
  params?: Record<string, string>;
};

/** Compact four-step progress used across a zine: Gather, Approve, Design, Share. */
export function StepProgress({
  steps,
  className,
}: {
  steps: Step[];
  className?: string;
}) {
  return (
    <ol
      aria-label="Progress"
      className={cn("grid max-w-xl gap-1", className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const inner = (
          <>
            <span
              className={cn(
                "relative grid size-8 place-items-center rounded-full text-sm font-semibold transition-colors duration-300",
                step.state === "done" && "bg-foreground text-background",
                step.state === "current" &&
                  "bg-lime text-lime-ink shadow-soft ring-2 ring-foreground",
                step.state === "todo" && "bg-muted text-muted-foreground",
              )}
            >
              {step.state === "done" ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <span className="tabular">{index + 1}</span>
              )}
            </span>
            <span
              className={cn(
                "text-xs leading-tight font-medium sm:text-sm",
                step.state === "todo"
                  ? "text-muted-foreground"
                  : "text-foreground",
              )}
            >
              {step.label}
              <span className="sr-only">
                {step.state === "done"
                  ? ", done"
                  : step.state === "current"
                    ? ", current step"
                    : ", not started"}
              </span>
            </span>
          </>
        );
        const base =
          "flex min-h-14 flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center";
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            {step.to ? (
              <Link
                to={step.to}
                params={step.params}
                className={cn(base, "press hover:bg-muted/70")}
              >
                {inner}
              </Link>
            ) : (
              <div className={base}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Sticky primary action. On phones it floats just above the bottom tab bar so
 * the next step is always one thumb-tap away; on desktop it sits inline.
 */
export function ActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-[calc(var(--nav-bottom)+env(safe-area-inset-bottom)+0.75rem)] z-30 flex flex-col gap-2 rounded-3xl bg-card/95 p-3 shadow-lift ring-1 ring-border backdrop-blur sm:flex-row sm:items-center sm:justify-end md:static md:bottom-auto md:rounded-2xl md:bg-transparent md:p-0 md:shadow-none md:ring-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
