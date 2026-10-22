import { Link, Outlet } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Home, Settings2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { Badge } from "@/components/ui/badge";

const links = [
  { to: "/", label: "Overview", icon: Home, exact: true },
  { to: "/collections", label: "Collections", icon: BookOpen, exact: false },
  { to: "/settings", label: "Project setup", icon: Settings2, exact: false },
] as const;

export function AppShell() {
  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <header className="border-b bg-card/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Link to="/" aria-label="Chorus home">
            <Brand />
          </Link>
          <a
            href="https://github.com/TrnLinh/hackathon"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Project repository{" "}
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-7 sm:px-8 md:grid-cols-[185px_minmax(0,1fr)] md:gap-12 md:py-10">
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
                activeProps={{ className: "bg-secondary text-foreground" }}
                inactiveProps={{
                  className: "text-muted-foreground hover:bg-secondary/60",
                }}
                className="inline-flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 hidden rounded-xl border border-dashed p-4 md:block">
            <Badge variant="outline" className="mb-2">
              Project starter
            </Badge>
            <p className="text-xs leading-relaxed text-muted-foreground">
              A home for memories that belong to more than one person.
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
