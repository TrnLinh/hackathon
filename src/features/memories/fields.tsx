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

/** Text field with a visible label, helper text below and an inline limit error. */
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
  const nearLimit = used > limit * 0.85;
  const describedBy = [hint && `${id}-hint`, over && `${id}-error`]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {!required && (
            <span className="font-normal text-muted-foreground">
              {" "}
              (optional)
            </span>
          )}
        </Label>
        {(nearLimit || over) && (
          <span
            className={cn(
              "tabular text-sm",
              over ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {used}/{limit}
          </span>
        )}
      </div>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={over}
          aria-describedby={describedBy || undefined}
          rows={5}
          className="rounded-xl text-base"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={over}
          aria-describedby={describedBy || undefined}
          className="h-11 rounded-xl text-base"
        />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {over && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          Too long by {used - limit}. Please shorten it.
        </p>
      )}
    </div>
  );
}

/** Declared people as tappable chips. The uploader is always included and locked. */
export function PeoplePicker({
  people,
  uploaderId,
  selected,
  onChange,
  legend = "Who's in this?",
}: {
  people: Person[];
  uploaderId: PersonId;
  selected: PersonId[];
  onChange: (ids: PersonId[]) => void;
  legend?: string;
}) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <ul className="flex flex-wrap gap-2">
        {people.map((p) => {
          const locked = p.id === uploaderId;
          const checked = locked || selected.includes(p.id);
          const inputId = `person-${p.id}`;
          return (
            <li key={p.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  "press flex min-h-11 items-center gap-2 rounded-full py-1 pr-4 pl-1.5 text-base ring-1 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  checked
                    ? "bg-accent text-accent-foreground ring-primary"
                    : "bg-card ring-border hover:bg-muted/60",
                  locked ? "cursor-default" : "cursor-pointer",
                )}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="sr-only"
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
                <PersonAvatar person={p} size="sm" />
                <span className="font-medium">
                  {locked ? "You" : p.name.split(" ")[0]}
                </span>
                {locked ? (
                  <Lock
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  checked && (
                    <Check
                      className="size-4 text-primary"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  )
                )}
                <span className="sr-only">
                  {locked ? " (always included)" : checked ? " (included)" : ""}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
