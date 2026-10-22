import { cn } from "@/lib/utils";
import type { Person } from "@/features/prototype/types";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PersonAvatar({
  person,
  size = "md",
  className,
}: {
  person: Person;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      title={person.name}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-white ring-2 ring-card",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-11 text-sm",
        className,
      )}
      style={{ background: `oklch(0.55 0.11 ${person.hue})` }}
    >
      <span aria-hidden="true">{initials(person.name)}</span>
      <span className="sr-only">{person.name}</span>
    </span>
  );
}

export function PersonStack({
  people,
  size = "sm",
  max = 4,
}: {
  people: Person[];
  size?: "sm" | "md";
  max?: number;
}) {
  const shown = people.slice(0, max);
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((p) => (
        <PersonAvatar key={p.id} person={p} size={size} />
      ))}
      {people.length > max && (
        <span className="ml-2 text-xs text-muted-foreground">
          +{people.length - max}
        </span>
      )}
    </span>
  );
}
