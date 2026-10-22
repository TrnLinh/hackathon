import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Screen title with at most one short line beneath it. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-sm font-medium text-primary">{eyebrow}</p>
        )}
        <h1 className="text-[1.75rem] leading-[1.1] font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-prose text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Quiet inline note, e.g. what a decision does and does not do. */
export function TrustNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-2xl bg-muted/70 p-3.5 text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-card px-6 py-14 text-center shadow-soft ring-1 ring-border">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent text-primary">
        {icon}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && (
        <p className="mt-2 max-w-sm text-base leading-relaxed text-muted-foreground">
          {children}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
