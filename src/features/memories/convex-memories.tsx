import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Images, Lock, Pencil, Plus } from "lucide-react";
import { kindMeta } from "@/components/chorus/memory-thumb";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { PersonStack } from "@/components/chorus/people";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LIMITS } from "@/lib/limits";
import { cn } from "@/lib/utils";
import { formatTime } from "@/features/data/backend";
import { toPerson, useCollection } from "@/features/data/collections";
import { useViewer } from "@/features/data/current-user";
import {
  useMediaUrl,
  useMemories,
  useMemory,
  useMemoryActions,
  type MemoryVersionView,
} from "@/features/data/memories";
import { formatBytes, formatDuration } from "@/features/prototype/selectors";
import { BudgetMeter } from "@/features/collections/budget-meter";
import { CountedField, PeoplePicker, codePoints } from "./fields";

// CH-05 screens for collections on Convex. Every memory here is a private
// draft visible only to its uploader until CH-06 adds submission and review.

/** Protected preview: the server returns a URL only to permitted viewers. */
export function MediaPreview({
  version,
  large = false,
}: {
  version: MemoryVersionView;
  large?: boolean;
}) {
  const url = useMediaUrl(version.media ? version.versionId : null);
  const Icon = kindMeta[version.kind].icon;
  const frame = cn(
    "w-full overflow-hidden rounded-lg bg-muted",
    large ? "max-h-[28rem]" : "aspect-[4/3]",
  );
  if (!version.media || !url)
    return (
      <div className={cn(frame, "grid place-items-center")}>
        <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
        {version.media && url === undefined && (
          <span className="sr-only">Loading preview</span>
        )}
      </div>
    );
  if (version.kind === "photo")
    return (
      // Protected, short-lived storage URL; next/image would proxy and cache it.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={version.title}
        className={cn(frame, "object-contain")}
      />
    );
  if (version.kind === "voice")
    return (
      <audio controls preload="metadata" src={url} className="w-full">
        <track kind="captions" />
      </audio>
    );
  return (
    <video controls preload="metadata" src={url} className={frame}>
      <track kind="captions" />
    </video>
  );
}

function DraftBadges() {
  return (
    <span className="flex flex-wrap gap-1.5">
      <Badge variant="secondary">
        <Lock aria-hidden="true" /> Private draft
      </Badge>
      <Badge variant="outline">Not encrypted (dev)</Badge>
    </span>
  );
}

export function ConvexMemoriesBoard({
  collectionId,
}: {
  collectionId: string;
}) {
  const collection = useCollection(collectionId);
  const member = collection?.access === "member" ? collection : null;
  const memories = useMemories(member?.collectionId ?? null);
  if (!memories)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading memories…
      </p>
    );
  const bytes = memories.reduce(
    (n, m) => n + (m.head.media?.byteLength ?? 0),
    0,
  );
  const atLimit = memories.length >= LIMITS.activeMemories;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <BudgetMeter
          label="Your memories"
          used={memories.length}
          limit={LIMITS.activeMemories}
        />
        <BudgetMeter
          label="Upload budget"
          used={bytes}
          limit={LIMITS.collectionBytes}
          format={formatBytes}
        />
        {atLimit ? (
          <Button disabled title="This collection has twelve active memories">
            <Plus aria-hidden="true" /> Add memory
          </Button>
        ) : (
          <Button asChild>
            <Link
              to="/collections/$collectionId/memories/new"
              params={{ collectionId }}
            >
              <Plus aria-hidden="true" /> Add memory
            </Link>
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        The meters count only memories you can see. The server enforces the
        collection-wide limits.
      </p>

      {memories.length === 0 ? (
        <EmptyState
          icon={<Images className="size-5" aria-hidden="true" />}
          title="No memories yet"
        >
          Add a photo, voice note, video or story. It stays a private draft that
          only you can see.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {memories.map((m) => (
            <li key={m.memoryId}>
              <article className="relative flex h-full flex-col gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40">
                <MediaPreview version={m.head} />
                <div className="min-w-0 space-y-1">
                  <h3 className="font-medium">
                    <Link
                      to="/collections/$collectionId/memories/$memoryId"
                      params={{ collectionId, memoryId: m.memoryId }}
                      className="after:absolute after:inset-0 hover:underline"
                    >
                      {m.head.title}
                    </Link>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {kindMeta[m.head.kind].label} · version {m.versionCount} ·{" "}
                    {formatTime(m.head.createdAt)}
                  </p>
                </div>
                <div className="mt-auto">
                  <DraftBadges />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      <TrustNote>
        Drafts are visible only to you. Asking the people in a memory for
        permission isn’t connected to the backend yet.
      </TrustNote>
    </div>
  );
}

function ReviseForm({
  memory,
  people,
  viewerId,
  onDone,
}: {
  memory: NonNullable<ReturnType<typeof useMemory>>;
  people: ReturnType<typeof toPerson>[];
  viewerId: string;
  onDone: () => void;
}) {
  const { reviseMemory } = useMemoryActions();
  const [title, setTitle] = useState(memory.head.title);
  const [caption, setCaption] = useState(memory.head.caption);
  const [story, setStory] = useState(memory.head.story);
  const [selected, setSelected] = useState<string[]>(
    memory.head.requiredApproverIds.filter((id) => id !== viewerId),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid =
    !title.trim() ||
    codePoints(title) > LIMITS.titleChars ||
    codePoints(caption) > LIMITS.captionChars ||
    codePoints(story) > LIMITS.storyChars ||
    (memory.head.kind === "text" && !story.trim());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (invalid || saving) return;
    setSaving(true);
    const input = {
      kind: memory.head.kind,
      title: title.trim(),
      caption: caption.trim(),
      story: story.trim(),
      peopleIds: selected,
    };
    const result = await reviseMemory(
      {
        memoryId: memory.memoryId,
        collectionId: memory.collectionId,
        head: memory.head,
      },
      input,
      `${memory.head.versionId}:${JSON.stringify(input)}`,
    );
    setSaving(false);
    if (result.ok) onDone();
    else setError(result.reason);
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="space-y-4 rounded-xl border bg-card p-4"
      noValidate
    >
      <h2 className="text-base font-semibold">Edit as a new version</h2>
      <CountedField
        id="revise-title"
        label="Title"
        value={title}
        onChange={setTitle}
        limit={LIMITS.titleChars}
        required
      />
      {memory.head.kind !== "text" && (
        <CountedField
          id="revise-caption"
          label="Caption"
          value={caption}
          onChange={setCaption}
          limit={LIMITS.captionChars}
        />
      )}
      <CountedField
        id="revise-story"
        label="Story"
        value={story}
        onChange={setStory}
        limit={LIMITS.storyChars}
        multiline
      />
      <PeoplePicker
        people={people}
        uploaderId={viewerId}
        selected={selected}
        onChange={setSelected}
      />
      <p className="text-xs text-muted-foreground">
        Earlier versions stay in the history. The media is kept as it is.
      </p>
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={invalid || saving}>
          {saving ? "Saving…" : "Save new version"}
        </Button>
      </div>
    </form>
  );
}

export function ConvexMemoryDetail({
  collectionId,
  memoryId,
}: {
  collectionId: string;
  memoryId: string;
}) {
  const memory = useMemory(memoryId);
  const collection = useCollection(collectionId);
  const viewer = useViewer();
  const [editing, setEditing] = useState(false);
  if (memory === undefined || collection === undefined || !viewer)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Opening the memory…
      </p>
    );
  if (
    !memory ||
    collection.access !== "member" ||
    memory.collectionId !== collection.collectionId
  )
    return (
      <EmptyState
        icon={<Images className="size-5" aria-hidden="true" />}
        title="Memory not found"
        action={
          <Button asChild variant="outline">
            <Link to="/collections/$collectionId" params={{ collectionId }}>
              Back to memories
            </Link>
          </Button>
        }
      >
        It may be someone else’s private draft, or it no longer exists.
      </EmptyState>
    );
  const members = collection.members.map(toPerson);
  const people = memory.head.requiredApproverIds.map(
    (id) =>
      members.find((p) => p.id === id) ?? toPerson({ userId: id, name: null }),
  );
  const head = memory.head;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <MediaPreview version={head} large />
        <div className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-serif text-2xl">{head.title}</h2>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden="true" /> Edit
              </Button>
            )}
          </div>
          {head.caption && <p className="text-sm">{head.caption}</p>}
          {head.story && (
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {head.story}
            </p>
          )}
          <DraftBadges />
        </div>
        {editing && (
          <ReviseForm
            key={head.versionId}
            memory={memory}
            people={members}
            viewerId={viewer.userId}
            onDone={() => setEditing(false)}
          />
        )}
      </div>
      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
          <h2 className="font-semibold">People in this memory</h2>
          <PersonStack people={people} size="md" max={8} />
          <p className="text-xs text-muted-foreground">
            {people.map((p) => p.name).join(", ")}. Each of them will approve
            its use once submission is connected.
          </p>
          {head.media && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{head.media.mimeType}</dd>
              <dt className="text-muted-foreground">Size</dt>
              <dd>{formatBytes(head.media.byteLength)}</dd>
              {head.media.width && (
                <>
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd>
                    {head.media.width}×{head.media.height}
                  </dd>
                </>
              )}
              {head.media.durationMs && (
                <>
                  <dt className="text-muted-foreground">Length</dt>
                  <dd>{formatDuration(head.media.durationMs / 1000)}</dd>
                </>
              )}
            </dl>
          )}
        </div>
        <section
          aria-labelledby="versions-heading"
          className="space-y-2 rounded-xl border bg-card p-4"
        >
          <h2 id="versions-heading" className="text-sm font-semibold">
            Versions ({memory.versionCount})
          </h2>
          <ol className="space-y-1.5 text-xs">
            {memory.versions.map((version, i) => (
              <li
                key={version.versionId}
                className="flex justify-between gap-2"
              >
                <span>
                  Version {memory.versionCount - i}
                  {i === 0 && " (current)"} · {version.title}
                </span>
                <span className="text-muted-foreground">
                  {formatTime(version.createdAt)}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Versions are immutable. Approvals never carry over to a new version.
          </p>
        </section>
        <TrustNote>
          Encryption isn’t connected yet: this draft and its file are stored
          unencrypted for development, visible only to you in the app.
        </TrustNote>
      </aside>
    </div>
  );
}
