import { Lock } from "lucide-react";
import { PersonAvatar } from "@/components/chorus/people";
import { Checkbox } from "@/components/ui/checkbox";
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
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-muted-foreground">
        Include everyone shown or speaking. Each person must approve before the
        memory is used. Chorus never identifies faces or voices automatically.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {people.map((p) => {
          const locked = p.id === uploaderId;
          const checked = locked || selected.includes(p.id);
          const inputId = `person-${p.id}`;
          return (
            <li key={p.id}>
              <label
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
                  checked && "border-primary/40 bg-secondary/50",
                  locked && "cursor-default",
                )}
              >
                <Checkbox
                  id={inputId}
                  checked={checked}
                  disabled={locked}
                  onCheckedChange={(v) =>
                    onChange(
                      v
                        ? [...selected, p.id]
                        : selected.filter((id) => id !== p.id),
                    )
                  }
                />
                <PersonAvatar person={p} size="sm" />
                <span className="flex-1">{p.name}</span>
                {locked && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="size-3" aria-hidden="true" /> Uploader
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
