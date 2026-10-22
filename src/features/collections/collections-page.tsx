import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, Lock, Plus } from "lucide-react";
import { EmptyState } from "@/components/chorus/page-header";
import { ArtworkFill, MemoryThumb } from "@/components/chorus/memory-thumb";
import { PersonStack } from "@/components/chorus/people";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  toPerson,
  useCollectionActions,
  useMyCollections,
} from "@/features/data/collections";
import { usePrototype } from "@/features/prototype/store";
import { DevEnvelopeBadge } from "./collection-layout";
import {
  LIMITS,
  collectionMemories,
  memoryStatus,
  personById,
} from "@/features/prototype/selectors";

function NewZineSheet({ size = "default" }: { size?: "default" | "lg" }) {
  const navigate = useNavigate();
  const { createCollection } = useCollectionActions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [touched, setTouched] = useState(false);
  const length = Array.from(title.trim()).length;
  const titleError =
    length === 0
      ? "Give it a title."
      : length > LIMITS.titleChars
        ? `Keep it under ${LIMITS.titleChars} characters.`
        : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (titleError || saving) return;
    setSaving(true);
    setError(null);
    const result = await createCollection({
      title: title.trim(),
      occasion: occasion.trim() || "A shared occasion",
    });
    setSaving(false);
    if (!result.ok) return setError(result.reason);
    setOpen(false);
    void navigate({
      to: "/collections/$collectionId",
      params: { collectionId: result.collectionId },
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTitle("");
          setOccasion("");
          setTouched(false);
          setError(null);
        }
      }}
    >
      <SheetTrigger asChild>
        <Button size={size} variant="highlight">
          <Plus aria-hidden="true" /> New zine
        </Button>
      </SheetTrigger>
      <SheetContent>
        <form
          onSubmit={(e) => void submit(e)}
          className="space-y-5 p-5 pb-8"
          noValidate
        >
          <SheetHeader className="p-0">
            <SheetTitle>New zine</SheetTitle>
            <SheetDescription>
              Name it, then invite your people.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-2">
            <Label htmlFor="zine-title">Title</Label>
            <Input
              id="zine-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Our first year away"
              aria-invalid={touched && !!titleError}
              aria-describedby={
                touched && titleError ? "zine-title-error" : undefined
              }
              className="h-11"
              autoFocus
            />
            {touched && titleError && (
              <p id="zine-title-error" className="text-sm text-destructive">
                {titleError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="zine-occasion">Occasion</Label>
            <Input
              id="zine-occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="Graduation, trip, reunion"
              className="h-11"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving ? "Creating" : "Create zine"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function CollectionsPage() {
  const collections = useMyCollections();
  const active = (collections ?? []).filter((c) => c.status === "active");
  const waiting = (collections ?? []).filter((c) => c.status === "requested");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Our zines
        </h1>
        {active.length > 0 && <NewZineSheet />}
      </div>

      {collections === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading your zines
        </p>
      ) : active.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" aria-hidden="true" />}
          title="Start your first zine"
          action={<NewZineSheet size="lg" />}
        >
          Or open a join link from a friend.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {active.map((collection, i) => (
            <li
              key={collection.collectionId}
              className="rise min-w-0"
              style={{ "--i": i } as React.CSSProperties}
            >
              <Link
                to="/collections/$collectionId"
                params={{ collectionId: collection.collectionId }}
                className="press flex h-full flex-col gap-4 rounded-[2rem] bg-card p-5 shadow-soft ring-1 ring-border outline-none transition-shadow duration-200 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display line-clamp-2 min-w-0 text-2xl leading-tight font-bold tracking-tight">
                    {collection.metadata.title}
                  </h2>
                  <PersonStack
                    people={collection.members.map(toPerson)}
                    max={3}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {collection.metadata.occasion}
                  {" · "}
                  {collection.role === "creator"
                    ? "You made this"
                    : "Contributor"}
                </p>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      {collection.members.length}{" "}
                      {collection.members.length === 1 ? "person" : "people"}
                    </span>
                    {collection.pendingCount > 0 && (
                      <span className="rounded-full bg-lime px-2.5 py-0.5 text-sm font-semibold text-lime-ink">
                        {collection.pendingCount} waiting to join
                      </span>
                    )}
                  </p>
                  <DevEnvelopeBadge />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {waiting.length > 0 && (
        <ul className="space-y-2">
          {waiting.map((c) =>
            c.status === "requested" ? (
              <li
                key={c.collectionId}
                className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm shadow-soft ring-1 ring-border"
              >
                <Lock
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="font-medium">
                  {c.creator.name ?? "Someone"}’s zine
                </span>
                <span className="text-muted-foreground">
                  Waiting to be let in
                </span>
              </li>
            ) : null,
          )}
        </ul>
      )}

      <PrototypeZines />
    </div>
  );
}

/** Seed zines that still exercise the screens not yet on Convex. */
function PrototypeZines() {
  const state = usePrototype();
  const mine = state.collections.filter((c) =>
    c.memberIds.includes(state.viewerId),
  );
  const pending = state.collections.filter((c) =>
    c.pendingIds.includes(state.viewerId),
  );
  if (mine.length === 0 && pending.length === 0) return null;

  return (
    <section aria-labelledby="demo-zines" className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="demo-zines" className="text-2xl font-bold tracking-tight">
            Demo zines
          </h2>
          <Badge variant="outline">Mock data</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Practice zines kept in this browser, for screens that are not
          connected yet. Switch the demo viewer at the top of the page.
        </p>
      </div>

      {mine.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map((collection) => {
            const memories = collectionMemories(state, collection.id).filter(
              (m) => m.submitted || m.uploaderId === state.viewerId,
            );
            const waiting = memories.filter(
              (m) => memoryStatus(m) === "awaiting",
            ).length;
            const covers = memories
              .filter((m) => memoryStatus(m) !== "excluded")
              .slice(0, 3);
            const progress =
              memories.length === 0
                ? "No memories yet"
                : `${memories.length} ${memories.length === 1 ? "memory" : "memories"}, ${
                    waiting > 0 ? `${waiting} waiting` : "all ready"
                  }`;
            return (
              <li key={collection.id} className="min-w-0">
                <Link
                  to="/collections/$collectionId"
                  params={{ collectionId: collection.id }}
                  className="press block overflow-hidden rounded-[2rem] bg-card shadow-soft ring-1 ring-border outline-none transition-shadow duration-200 hover:shadow-lift focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <div className="relative aspect-4/3 overflow-hidden bg-muted">
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-0.5">
                      {covers.length === 0 ? (
                        <div className="col-span-3 row-span-2 grid place-items-center text-muted-foreground">
                          <BookOpen className="size-8" aria-hidden="true" />
                        </div>
                      ) : (
                        covers.map((m, j) => (
                          <div
                            key={m.id}
                            className={cn(
                              "relative overflow-hidden",
                              j === 0
                                ? covers.length === 1
                                  ? "col-span-3 row-span-2"
                                  : "col-span-2 row-span-2"
                                : covers.length === 2
                                  ? "row-span-2"
                                  : "",
                            )}
                          >
                            {m.art &&
                            (m.kind === "photo" || m.kind === "video") ? (
                              <ArtworkFill
                                art={m.art}
                                showScene={false}
                                className="absolute inset-0"
                              />
                            ) : (
                              <MemoryThumb memory={m} className="size-full" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/30 to-transparent p-4 pt-16">
                      <h3 className="font-display line-clamp-2 text-2xl leading-tight font-bold tracking-tight text-white">
                        {collection.title}
                      </h3>
                    </div>
                    <span className="absolute top-3 left-3 rounded-full bg-lime px-3 py-1 text-sm font-semibold text-lime-ink">
                      {progress}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <p className="min-w-0 truncate text-sm text-muted-foreground">
                      {collection.occasion}
                    </p>
                    <PersonStack
                      people={collection.memberIds.map((id) =>
                        personById(state, id),
                      )}
                      max={3}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm shadow-soft ring-1 ring-border"
            >
              <Lock
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="font-medium">{c.title}</span>
              <span className="text-muted-foreground">
                Waiting to be let in
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
