import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  ChevronDown,
  Cpu,
  Ellipsis,
  FileCheck2,
  Home,
  Inbox,
  RotateCcw,
  Settings2,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { PersonAvatar } from "@/components/chorus/people";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuthConfiguration } from "@/components/providers";
import { AccountControls } from "@/features/auth/auth-status";
import { useConvexWaitingCount } from "@/features/approvals/convex-inbox";
import { useAiConfig } from "@/features/data/ai-config";
import { BackendOnly, QueryBoundary } from "@/features/data/backend";
import { EnsureCurrentUser, useViewer } from "@/features/data/current-user";
import { actions, usePrototype } from "@/features/prototype/store";
import { inboxFor, personById } from "@/features/prototype/selectors";
import { cn } from "@/lib/utils";

/** Four places a person actually goes. Everything else lives under More. */
const tabs = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/collections", label: "Our zines", icon: BookOpen, exact: false },
  { to: "/approvals", label: "Inbox", icon: Inbox, exact: false },
] as const;

const moreLinks = [
  { to: "/processors", label: "AI helpers", icon: Cpu },
  { to: "/verify", label: "Check a proof", icon: FileCheck2 },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

function CountDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tabular absolute -top-0.5 left-[calc(50%+0.25rem)] grid min-w-[1.15rem] place-items-center rounded-full bg-lime px-1 text-[11px] leading-[1.15rem] font-bold text-lime-ink ring-2 ring-foreground md:static md:ml-auto md:ring-0">
      {count}
      <span className="sr-only"> waiting for your decision</span>
    </span>
  );
}

/**
 * Keeps the prototype store in step with the server's AI availability (CH-22),
 * so screens still on mock data agree with the server. Renders nothing.
 * Without a readable server configuration, AI is off everywhere.
 */
function OfflineAiSync() {
  const mock = usePrototype().aiConfig;
  useEffect(() => {
    actions.syncAiConfig({ enabled: false, revision: 0, changedAt: null });
  }, [mock.enabled, mock.revision]);
  return null;
}

function ServerAiSync() {
  const config = useAiConfig();
  const mock = usePrototype().aiConfig;
  // Re-sync whenever either side changes, e.g. after a prototype data reset.
  useEffect(() => {
    if (config) actions.syncAiConfig(config);
  }, [config, mock.enabled, mock.revision]);
  return null;
}

/** Signed in: your backend requests only (the demo viewer is someone else). */
function ConvexCountDot({ mockCount }: { mockCount: number }) {
  const waiting = useConvexWaitingCount();
  const viewer = useViewer();
  return <CountDot count={viewer ? (waiting ?? 0) : mockCount} />;
}

function InboxDot({
  mockCount,
  authConfigured,
}: {
  mockCount: number;
  authConfigured: boolean;
}) {
  if (!authConfigured) return <CountDot count={mockCount} />;
  return (
    <BackendOnly fallback={<CountDot count={mockCount} />}>
      <QueryBoundary fallback={<CountDot count={mockCount} />}>
        <ConvexCountDot mockCount={mockCount} />
      </QueryBoundary>
    </BackendOnly>
  );
}

/** Demo-only person switcher. Real identity comes from TideCloak (CH-01). */
function PersonMenu() {
  const state = usePrototype();
  const viewer = personById(state, state.viewerId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Viewing as ${viewer.name}. Change person`}
        className="press flex h-11 items-center gap-2 rounded-full bg-card py-1 pr-3 pl-1 text-sm font-medium shadow-soft ring-1 ring-border outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
      >
        <PersonAvatar person={viewer} size="md" className="ring-0" />
        <span className="hidden max-w-28 truncate sm:inline">
          {viewer.name.split(" ")[0]}
        </span>
        <ChevronDown
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
        <DropdownMenuLabel className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">
          Demo: view Chorus as
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={state.viewerId}
          onValueChange={(id) => actions.setViewer(id)}
        >
          {state.people.map((p) => (
            <DropdownMenuRadioItem
              key={p.id}
              value={p.id}
              className="min-h-11 gap-2.5 rounded-xl"
            >
              <PersonAvatar person={p} size="sm" className="ring-0" />
              <span className="flex flex-col leading-tight">
                <span>{p.name}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <button
          type="button"
          onClick={() => actions.reset()}
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Reset demo data
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const state = usePrototype();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="md:inset-x-auto md:right-6 md:bottom-6 md:w-[24rem] md:rounded-3xl">
        <SheetHeader>
          <SheetTitle>More</SheetTitle>
          <SheetDescription>Tools and settings for this demo.</SheetDescription>
        </SheetHeader>
        <nav aria-label="More" className="grid gap-1">
          {moreLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => onOpenChange(false)}
              className="press flex min-h-14 items-center gap-3 rounded-2xl px-3 text-base font-medium hover:bg-muted"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {label}
              {to === "/processors" && (
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {state.aiConfig.enabled ? "On" : "Off"}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="rounded-2xl bg-muted/70 p-3">
          <AccountControls />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Demo data lives in this browser. Consent and encryption are simulated
          here.
        </p>
      </SheetContent>
    </Sheet>
  );
}

const itemBase =
  "press relative flex items-center rounded-full text-sm font-semibold transition-colors";

export function AppShell() {
  const state = usePrototype();
  const { configured: authConfigured } = useAuthConfiguration();
  const inboxCount = inboxFor(state, state.viewerId).length;
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-card p-3 shadow-lift focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header className="pt-safe sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-[var(--nav-top)] max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/"
            aria-label="Chorus home"
            className="inline-flex min-h-11 items-center rounded-xl"
          >
            <Brand />
          </Link>
          <BackendOnly fallback={<OfflineAiSync />}>
            <QueryBoundary fallback={<OfflineAiSync />}>
              <ServerAiSync />
            </QueryBoundary>
          </BackendOnly>
          {authConfigured && (
            <QueryBoundary fallback={null}>
              <EnsureCurrentUser />
            </QueryBoundary>
          )}
          <PersonMenu />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1240px] gap-8 px-4 sm:px-6">
        {/* Desktop rail */}
        <aside className="sticky top-[var(--nav-top)] hidden w-52 shrink-0 self-start py-6 md:block">
          <nav aria-label="Main" className="grid gap-1">
            {tabs.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                activeProps={{
                  className: "bg-foreground text-background shadow-soft",
                  "aria-current": "page",
                }}
                inactiveProps={{
                  className:
                    "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                }}
                className={cn(itemBase, "min-h-12 gap-3 px-3.5")}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
                {to === "/approvals" && (
                  <InboxDot
                    mockCount={inboxCount}
                    authConfigured={authConfigured}
                  />
                )}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                itemBase,
                "min-h-12 gap-3 px-3.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
              )}
            >
              <Ellipsis className="size-5" aria-hidden="true" />
              More
            </button>
          </nav>
        </aside>

        <main
          id="main-content"
          tabIndex={-1}
          className="pb-nav min-w-0 flex-1 py-5 outline-none sm:py-8 md:pb-16"
        >
          <div
            key={pathname}
            className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
          >
            <Outlet />
          </div>
        </main>
      </div>

      {/* Phone tab bar: a floating pill so the page content stays the star. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md md:hidden"
      >
        <ul className="grid grid-cols-4 gap-1 rounded-full bg-foreground p-1.5 shadow-lift ring-1 ring-white/10">
          {tabs.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact }}
                activeProps={{
                  className: "bg-lime text-lime-ink",
                  "aria-current": "page",
                }}
                inactiveProps={{ className: "text-background/70" }}
                className="press relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-semibold transition-colors"
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
                {to === "/approvals" && (
                  <InboxDot
                    mockCount={inboxCount}
                    authConfigured={authConfigured}
                  />
                )}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="press flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full text-xs font-semibold text-background/70 transition-colors"
            >
              <Ellipsis className="size-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}
