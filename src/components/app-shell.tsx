import { Link, Outlet } from "@tanstack/react-router";
import {
  BookOpen,
  Cpu,
  Power,
  PowerOff,
  FileCheck2,
  Home,
  Inbox,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { PersonAvatar } from "@/components/chorus/people";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountControls } from "@/features/auth/auth-status";
import { actions, usePrototype } from "@/features/prototype/store";
import { inboxFor, personById } from "@/features/prototype/selectors";

const links = [
  { to: "/", label: "Overview", icon: Home, exact: true },
  { to: "/collections", label: "Collections", icon: BookOpen, exact: false },
  { to: "/approvals", label: "Approvals", icon: Inbox, exact: false },
  { to: "/processors", label: "AI processors", icon: Cpu, exact: false },
  { to: "/verify", label: "Verify a receipt", icon: FileCheck2, exact: false },
  { to: "/settings", label: "Project setup", icon: Settings2, exact: false },
] as const;

/** Reflects server-authoritative AI availability (CH-22). */
function AiStatusPill() {
  const state = usePrototype();
  const on = state.aiConfig.enabled;
  const Icon = on ? Power : PowerOff;
  return (
    <Link
      to="/processors"
      title={`AI is ${on ? "on" : "off"} (configuration r${state.aiConfig.revision})`}
      className={
        on
          ? "inline-flex h-6 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--status-available)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-available)_10%,transparent)] px-2.5 text-xs font-medium text-[var(--status-available)] hover:underline"
          : "inline-flex h-6 items-center gap-1.5 rounded-full border bg-muted px-2.5 text-xs font-medium text-muted-foreground hover:underline"
      }
    >
      <Icon className="size-3.5" aria-hidden="true" />
      AI {on ? "on" : "off"}
    </Link>
  );
}

/** Demo-only persona switcher. Real identity comes from TideCloak (CH-01). */
function ViewerSwitcher() {
  const state = usePrototype();
  const viewer = personById(state, state.viewerId);
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="hidden sm:inline-flex">
        Prototype data
      </Badge>
      <Select
        value={state.viewerId}
        onValueChange={(id) => actions.setViewer(id)}
      >
        <SelectTrigger aria-label="Viewing as" className="h-9 min-w-44">
          <span className="flex items-center gap-2">
            <PersonAvatar person={viewer} size="sm" />
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {state.people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              Viewing as {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Reset prototype data"
        title="Reset prototype data"
        onClick={() => actions.reset()}
      >
        <RotateCcw aria-hidden="true" />
      </Button>
    </div>
  );
}

export function AppShell() {
  const state = usePrototype();
  const inboxCount = inboxFor(state, state.viewerId).length;
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <header className="border-b bg-card/80">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" aria-label="Chorus home">
            <Brand />
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <AiStatusPill />
            <ViewerSwitcher />
            <AccountControls />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] gap-6 px-5 py-6 sm:px-8 md:grid-cols-[190px_minmax(0,1fr)] md:gap-10 md:py-10">
        <aside className="min-w-0">
          <p className="mb-4 hidden text-[10px] font-semibold tracking-[0.2em] text-muted-foreground md:block">
            YOUR WORKSPACE
          </p>
          <nav
            aria-label="Workspace"
            className="flex gap-1 overflow-x-auto md:flex-col"
          >
            {links.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                activeProps={{
                  className: "bg-secondary text-foreground",
                  "aria-current": "page",
                }}
                inactiveProps={{
                  className: "text-muted-foreground hover:bg-secondary/60",
                }}
                className="relative inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                {to === "/approvals" && inboxCount > 0 && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground">
                    {inboxCount}
                    <span className="sr-only"> waiting for your decision</span>
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <div className="mt-10 hidden rounded-xl border border-dashed p-4 md:block">
            <Badge variant="outline" className="mb-2">
              UI prototype
            </Badge>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Screens use synthetic data stored in this browser. Nothing here
              enforces consent or encryption yet.
            </p>
          </div>
        </aside>
        <main id="main-content" className="min-w-0" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
