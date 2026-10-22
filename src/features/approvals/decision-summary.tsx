import { DecisionBadge } from "@/components/chorus/status";
import type {
  ApproverDecisions,
  Memory,
  Processor,
} from "@/features/prototype/types";

/** One approver's decisions: manual use plus each requested processor. */
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
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      <div className="flex items-center gap-1.5">
        <dt className="text-muted-foreground">Manual use</dt>
        <dd>
          <DecisionBadge decision={decision?.manual ?? "pending"} />
        </dd>
      </div>
      {memory.requestedProcessors.map((id) => (
        <div key={id} className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">
            {processors.find((p) => p.id === id)?.name ?? id}
          </dt>
          <dd>
            <DecisionBadge decision={decision?.processors[id] ?? "pending"} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
