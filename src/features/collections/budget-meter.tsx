import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/** Labeled usage meter for SRD budgets. The text carries the state, not color. */
export function BudgetMeter({
  label,
  used,
  limit,
  format = (n) => String(n),
  className,
}: {
  label: string;
  used: number;
  limit: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "tabular-nums text-muted-foreground",
            over && "font-medium text-destructive",
          )}
        >
          {format(used)} of {format(limit)}
          {over ? " — over budget" : pct >= 85 ? " — nearly full" : ""}
        </span>
      </div>
      <Progress
        value={pct}
        aria-label={`${label}: ${format(used)} of ${format(limit)}`}
      />
    </div>
  );
}
