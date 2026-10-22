import { Check, CircleDashed, Cpu, X } from "lucide-react";
import { DecisionBadge } from "@/components/chorus/status";
import type {
  ApproverDecisions,
  Decision,
  Memory,
  Processor,
} from "@/features/prototype/types";

function Glyph({ value }: { value: Decision }) {
  if (value === "approved")
    return <Check className="size-4 text-[var(--status-available)]" />;
  if (value === "pending")
    return <CircleDashed className="size-4 text-muted-foreground" />;
  return <X className="size-4 text-[var(--status-excluded)]" />;
}

const words: Record<Decision, string> = {
  approved: "approved",
  declined: "declined",
  withdrawn: "withdrawn",
  pending: "not decided",
};

/** One approver's decisions: a compact glyph row (zine use plus AI helpers). */
export function DecisionSummary({
  memory,
  decision,
  processors,
}: {
  memory: Memory;
  decision: ApproverDecisions | undefined;
  processors: Processor[];
}) {
  if (decision?.editRequested)
    return <DecisionBadge decision="pending" label="Edit requested" />;
  const manual = decision?.manual ?? "pending";
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <li className="inline-flex items-center gap-1.5">
        <Glyph value={manual} />
        Zine {words[manual]}
      </li>
      {memory.requestedProcessors.map((id) => {
        const v = decision?.processors[id] ?? "pending";
        return (
          <li
            key={id}
            className="inline-flex items-center gap-1.5 text-muted-foreground"
          >
            <Cpu className="size-4" aria-hidden="true" />
            {processors.find((p) => p.id === id)?.name ?? id}
            <Glyph value={v} />
            <span className="sr-only">{words[v]}</span>
          </li>
        );
      })}
    </ul>
  );
}
