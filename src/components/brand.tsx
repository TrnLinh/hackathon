import { BookOpen } from "lucide-react";

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <BookOpen className="size-4" aria-hidden="true" />
      </span>
      <span className="text-2xl font-semibold tracking-tight">chorus.</span>
    </span>
  );
}
