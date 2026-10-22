import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Lock, Plus } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  TrustNote,
} from "@/components/chorus/page-header";
import { PersonStack } from "@/components/chorus/people";
import { MemoryStatusBadge } from "@/components/chorus/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actions, usePrototype } from "@/features/prototype/store";
import {
  LIMITS,
  collectionMemories,
  memoryStatus,
  personById,
} from "@/features/prototype/selectors";
import type { MemoryStatus } from "@/features/prototype/types";

const summaryOrder: MemoryStatus[] = [
  "available",
  "manual-only",
  "awaiting",
  "excluded",
];

function NewCollectionDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [touched, setTouched] = useState(false);
  const length = Array.from(title.trim()).length;
  const titleError =
    length === 0
      ? "Give the collection a title."
      : length > LIMITS.titleChars
        ? `Shorten the title to ${LIMITS.titleChars} characters or fewer.`
        : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (titleError) return;
    const collectionId = actions.createCollection({
      title: title.trim(),
      occasion: occasion.trim() || "A shared occasion",
    });
    setOpen(false);
    void navigate({
      to: "/collections/$collectionId",
      params: { collectionId },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTitle("");
          setOccasion("");
          setTouched(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" /> New collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <DialogHeader>
            <DialogTitle>Start a collection</DialogTitle>
            <DialogDescription>
              You will be its creator. Contributors still decide how each of
              their memories is used.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="collection-title">Title</Label>
              <span
                className={`text-xs tabular-nums ${length > LIMITS.titleChars ? "text-destructive" : "text-muted-foreground"}`}
                aria-live="polite"
              >
                {length}/{LIMITS.titleChars}
              </span>
            </div>
            <Input
              id="collection-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Our First Year Away From Home"
              aria-invalid={touched && !!titleError}
              aria-describedby={
                touched && titleError ? "collection-title-error" : undefined
              }
              autoFocus
            />
            {touched && titleError && (
              <p
                id="collection-title-error"
                className="text-xs text-destructive"
              >
                {titleError}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-occasion">Occasion</Label>
            <Input
              id="collection-occasion"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
              placeholder="Graduation, farewell, reunion…"
            />
          </div>
          <TrustNote>
            In the prototype, the title is stored in this browser. The real
            build encrypts private collection metadata for members only.
          </TrustNote>
          <DialogFooter>
            <Button type="submit">Create collection</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CollectionsPage() {
  const state = usePrototype();
  const mine = state.collections.filter((c) =>
    c.memberIds.includes(state.viewerId),
  );
  const pending = state.collections.filter((c) =>
    c.pendingIds.includes(state.viewerId),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="The moments you keep"
        title="Your collections"
        description="A place for shared photos, voice notes, videos, and everyone’s perspective."
        actions={<NewCollectionDialog />}
      />

      {mine.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" aria-hidden="true" />}
          title="A new chapter starts here"
          action={<NewCollectionDialog />}
        >
          Start a collection, or open a join link from a friend. You can switch
          the demo viewer at the top of the page.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {mine.map((collection) => {
            const memories = collectionMemories(state, collection.id).filter(
              (m) => m.submitted || m.uploaderId === state.viewerId,
            );
            const counts = new Map<MemoryStatus, number>();
            for (const m of memories) {
              const s = memoryStatus(m);
              counts.set(s, (counts.get(s) ?? 0) + 1);
            }
            const isCreator = collection.creatorId === state.viewerId;
            return (
              <li key={collection.id}>
                <Card className="relative h-full shadow-none transition-colors hover:border-primary/40">
                  <CardContent className="flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-serif text-xl leading-snug">
                          <Link
                            to="/collections/$collectionId"
                            params={{ collectionId: collection.id }}
                            className="rounded-sm after:absolute after:inset-0 hover:underline focus-visible:outline-2"
                          >
                            {collection.title}
                          </Link>
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {collection.occasion} ·{" "}
                          {isCreator ? "You created this" : "Contributor"}
                        </p>
                      </div>
                      <PersonStack
                        people={collection.memberIds.map((id) =>
                          personById(state, id),
                        )}
                      />
                    </div>
                    <p className="text-sm">
                      {memories.length}{" "}
                      {memories.length === 1 ? "memory" : "memories"}
                      {collection.pendingIds.length > 0 && isCreator && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {collection.pendingIds.length} waiting to join
                        </span>
                      )}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {summaryOrder
                        .filter((s) => counts.get(s))
                        .map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1"
                          >
                            <MemoryStatusBadge status={s} />
                            <span className="text-xs text-muted-foreground tabular-nums">
                              ×{counts.get(s)}
                            </span>
                          </span>
                        ))}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Open collection{" "}
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="pending-joins" className="space-y-3">
          <h2
            id="pending-joins"
            className="text-lg font-semibold tracking-tight"
          >
            Waiting for admission
          </h2>
          <ul className="space-y-2">
            {pending.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm"
              >
                <Lock
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="font-medium">{c.title}</span>
                <span className="text-muted-foreground">
                  — the creator has not admitted you yet.
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
