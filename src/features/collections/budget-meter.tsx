import { cn } from "@/lib/utils";

/** Quiet usage text. The text carries the state, not color. */
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
  const over = used > limit;
  return (
    <span
      className={cn(
        "tabular text-sm text-muted-foreground",
        over && "font-medium text-destructive",
        className,
      )}
    >
      <span className="sr-only">{label}: </span>
      {format(used)} of {format(limit)}
    </span>
  );
}
