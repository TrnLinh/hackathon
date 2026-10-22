import { Check, Lock } from "lucide-react";
import { PersonAvatar } from "@/components/chorus/people";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Person, PersonId } from "@/features/prototype/types";

export function codePoints(text: string) {
  return Array.from(text).length;
}

/** Text field with a live code-point counter that reports the limit before submission. */
export function CountedField({
  id,
  label,
  value,
  onChange,
  limit,
  multiline,
  placeholder,
  hint,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  limit: number;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}) {
  const used = codePoints(value);
  const over = used > limit;
  const describedBy = [hint && `${id}-hint`, `${id}-count`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>
          {label}
          {!required && (
            <span className="font-normal text-muted-foreground">
              {" "}
              (optional)
            </span>
          )}
        </Label>
        <span
          id={`${id}-count`}
          className={cn(
            "text-xs tabular-nums",
            over ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {used}/{limit}
          {over && " — too long"}
        </span>
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={over}
          aria-describedby={describedBy}
          rows={5}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={over}
          aria-describedby={describedBy}
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Declared people. The uploader is always included and cannot be removed. */
export function PeoplePicker({
  people,
  uploaderId,
  selected,
  onChange,
  legend = "People in this memory",
}: {
  people: Person[];
  uploaderId: PersonId;
  selected: PersonId[];
  onChange: (ids: PersonId[]) => void;
  legend?: string;
}) {
  const count = people.filter(
    (p) => p.id === uploaderId || selected.includes(p.id),
  ).length;
  return (
    <fieldset className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <legend className="text-sm font-medium">{legend}</legend>
        <span className="text-xs text-muted-foreground tabular-nums">
          {count} will be asked to approve
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Include everyone shown or speaking. Chorus never identifies faces or
        voices automatically.
      </p>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {people.map((p) => {
          const locked = p.id === uploaderId;
          const checked = locked || selected.includes(p.id);
          const inputId = `person-${p.id}`;
          return (
            <li key={p.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors has-focus-visible:bg-secondary/60",
                  locked
                    ? "cursor-default"
                    : "cursor-pointer hover:bg-muted/60",
                )}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  disabled={locked}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, p.id]
                        : selected.filter((id) => id !== p.id),
                    )
                  }
                />
                <PersonAvatar person={p} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {locked
                      ? "You · uploader, always included"
                      : checked
                        ? "Will be asked to approve"
                        : "Not in this memory"}
                  </span>
                </span>
                {locked ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                    <Lock className="size-3" aria-hidden="true" />
                    Uploader
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
