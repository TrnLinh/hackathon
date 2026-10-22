import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Hand,
  Loader2,
  Lock,
  PenLine,
  Undo2,
  XCircle,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type {
  Decision,
  FinalDecision,
  JobStatus,
  MemoryStatus,
} from "@/features/prototype/types";

// Every status pairs an icon and words with color (NFR-05: never color only).

type Tone = "available" | "awaiting" | "excluded" | "manual" | "neutral";

const toneClass: Record<Tone, string> = {
  available:
    "border-[color-mix(in_srgb,var(--status-available)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-available)_10%,transparent)] text-[var(--status-available)]",
  awaiting:
    "border-[color-mix(in_srgb,var(--status-awaiting)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-awaiting)_10%,transparent)] text-[var(--status-awaiting)]",
  excluded:
    "border-[color-mix(in_srgb,var(--status-excluded)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-excluded)_8%,transparent)] text-[var(--status-excluded)]",
  manual:
    "border-[color-mix(in_srgb,var(--status-manual)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-manual)_10%,transparent)] text-[var(--status-manual)]",
  neutral: "border-border bg-muted text-muted-foreground",
};

function Pill({
  tone,
  icon: Icon,
  label,
  spin,
  className,
}: {
  tone: Tone;
  icon: ComponentType<{ className?: string }>;
  label: string;
  spin?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      <Icon
        className={cn("size-3.5", spin && "animate-spin")}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

const memoryStatusMeta: Record<
  MemoryStatus,
  {
    tone: Tone;
    icon: ComponentType<{ className?: string }>;
    label: string;
    hint: string;
  }
> = {
  private: {
    tone: "neutral",
    icon: Lock,
    label: "Private draft",
    hint: "Only the uploader can see this. Submit it to ask for permission.",
  },
  awaiting: {
    tone: "awaiting",
    icon: Clock3,
    label: "Awaiting permission",
    hint: "Someone involved has not decided yet. Silence never counts as consent.",
  },
  available: {
    tone: "available",
    icon: CheckCircle2,
    label: "Available",
    hint: "Approved for templates and manual editing, and for AI processing.",
  },
  "manual-only": {
    tone: "manual",
    icon: Hand,
    label: "Available · no AI",
    hint: "Approved for templates and manual editing. AI processing isn’t approved, so it never reaches a model.",
  },
  excluded: {
    tone: "excluded",
    icon: Ban,
    label: "Excluded",
    hint: "Someone involved declined or withdrew. It will not appear or influence the design.",
  },
};

export function memoryStatusHint(status: MemoryStatus) {
  return memoryStatusMeta[status].hint;
}

export function MemoryStatusBadge({
  status,
  className,
}: {
  status: MemoryStatus;
  className?: string;
}) {
  const meta = memoryStatusMeta[status];
  return (
    <Pill
      tone={meta.tone}
      icon={meta.icon}
      label={meta.label}
      className={className}
    />
  );
}

const decisionMeta: Record<
  Decision,
  { tone: Tone; icon: ComponentType<{ className?: string }>; label: string }
> = {
  pending: { tone: "awaiting", icon: CircleDashed, label: "Not decided" },
  approved: { tone: "available", icon: CheckCircle2, label: "Approved" },
  declined: { tone: "excluded", icon: XCircle, label: "Declined" },
  withdrawn: { tone: "excluded", icon: Undo2, label: "Withdrawn" },
};

export function DecisionBadge({
  decision,
  label,
  className,
}: {
  decision: Decision | FinalDecision;
  /** Override the default wording, e.g. "Edit requested". */
  label?: string;
  className?: string;
}) {
  const meta = decisionMeta[decision];
  return (
    <Pill
      tone={meta.tone}
      icon={label === "Edit requested" ? PenLine : meta.icon}
      label={label ?? meta.label}
      className={className}
    />
  );
}

const jobMeta: Record<
  JobStatus,
  {
    tone: Tone;
    icon: ComponentType<{ className?: string }>;
    label: string;
    spin?: boolean;
  }
> = {
  queued: { tone: "neutral", icon: Clock3, label: "Queued" },
  running: { tone: "awaiting", icon: Loader2, label: "Running", spin: true },
  succeeded: { tone: "available", icon: CheckCircle2, label: "Finished" },
  failed: { tone: "excluded", icon: XCircle, label: "Failed" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = jobMeta[status];
  return (
    <Pill
      tone={meta.tone}
      icon={meta.icon}
      label={meta.label}
      spin={meta.spin}
    />
  );
}

export function ToneDot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 rounded-full border", toneClass[tone])}
    />
  );
}
