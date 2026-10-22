import { BookOpen } from "lucide-react";

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-9 -rotate-6 place-items-center rounded-xl bg-lime text-lime-ink shadow-soft">
        <BookOpen className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="font-display text-xl font-bold tracking-tight">
        chorus
      </span>
    </span>
  );
}
