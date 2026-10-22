import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock3, DoorOpen, LinkIcon, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/chorus/page-header";
import { Button } from "@/components/ui/button";
import {
  useCollectionActions,
  useJoinPreview,
} from "@/features/data/collections";

// CH-04: a join code lets a signed-in person ask to join. Until admitted they
// see who invited them, never the collection's private details.

export function JoinPage({ code }: { code: string }) {
  const preview = useJoinPreview(code);
  const { requestJoin } = useCollectionActions();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (preview === undefined)
    return (
      <p
        role="status"
        className="mx-auto max-w-md py-10 text-center text-base text-muted-foreground"
      >
        Checking the link…
      </p>
    );

  if (preview === null)
    return (
      <div className="mx-auto max-w-md py-6">
        <EmptyState
          icon={<LinkIcon className="size-5" aria-hidden="true" />}
          title="This link does not work"
          action={
            <Button asChild variant="outline">
              <Link to="/collections">Your collections</Link>
            </Button>
          }
        >
          Ask the person who shared it for a new one.
        </EmptyState>
      </div>
    );

  const creator = preview.creatorName ?? "Someone";
  const first = creator.split(" ")[0];
  const members = `${preview.memberCount} ${
    preview.memberCount === 1 ? "person" : "people"
  } in so far`;

  async function ask() {
    setSending(true);
    const result = await requestJoin(code);
    setSending(false);
    setError(result.ok ? null : result.reason);
  }

  return (
    <div className="mx-auto max-w-md py-4 pop sm:py-8">
      <div className="rounded-[2rem] bg-card p-6 text-center shadow-lift ring-1 ring-border sm:p-8">
        <div className="flex justify-center">
          <span className="grid size-16 place-items-center rounded-full bg-lime text-lime-ink">
            <DoorOpen className="size-7" aria-hidden="true" />
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tighter text-balance md:text-5xl">
          {first} invited you
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {members}. You will see the collection once you are in.
        </p>

        <div className="mt-6 space-y-3">
          {preview.viewerStatus === "active" ? (
            <div className="space-y-3">
              <p
                role="status"
                className="inline-flex items-center gap-2 text-base"
              >
                <UsersRound
                  className="size-5 text-foreground"
                  aria-hidden="true"
                />
                You are in
              </p>
              <Button asChild size="lg" className="w-full">
                <Link
                  to="/collections/$collectionId"
                  params={{ collectionId: preview.collectionId }}
                >
                  Open collection
                </Link>
              </Button>
            </div>
          ) : preview.viewerStatus === "requested" ? (
            <p
              role="status"
              className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-base"
            >
              <Clock3
                className="size-5 text-[var(--status-awaiting)]"
                aria-hidden="true"
              />
              Waiting for {first} to let you in
            </p>
          ) : (
            <>
              {preview.viewerStatus !== "none" && (
                <p role="status" className="text-sm text-muted-foreground">
                  {preview.viewerStatus === "declined"
                    ? `${first} said no last time.`
                    : `${first} took you out of this collection.`}{" "}
                  You can ask again.
                </p>
              )}
              <Button
                size="lg"
                variant="highlight"
                className="w-full"
                disabled={sending}
                onClick={() => void ask()}
              >
                {sending ? "Sending…" : "Ask to join"}
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
