import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, Download, Lock } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { actions } from "@/features/prototype/store";
import {
  formatBytes,
  formatWhen,
  personById,
  shortDigest,
} from "@/features/prototype/selectors";
import type {
  Candidate,
  Collection,
  PrototypeState,
} from "@/features/prototype/types";
import { buildPlaceholderPdf, pdfFileName, saveFile, sha256Hex } from "./files";
import { downloadReceipt } from "./issue-step";

export function DownloadStep({
  state,
  collection,
  candidate,
}: {
  state: PrototypeState;
  collection: Collection;
  candidate?: Candidate;
}) {
  const [savedDigest, setSavedDigest] = useState<string | null>(null);

  if (!candidate || candidate.status !== "issued")
    return (
      <EmptyState
        icon={<Lock className="size-5" aria-hidden="true" />}
        title="No issued edition yet"
      >
        The download opens once every required person has approved and the
        edition has been issued.
      </EmptyState>
    );

  const isMember = candidate.downloadMemberIds.includes(state.viewerId);
  const blockedReason = candidate.invalidatedReason
    ? candidate.invalidatedReason
    : !isMember
      ? "You are not one of the named download members for this edition."
      : null;

  async function downloadPdf() {
    const bytes = buildPlaceholderPdf(collection, candidate!);
    saveFile(
      bytes as BlobPart,
      pdfFileName(collection, candidate!),
      "application/pdf",
    );
    setSavedDigest(await sha256Hex(bytes));
    actions.recordDownload(candidate!.id);
  }

  return (
    <div className="space-y-5">
      {blockedReason ? (
        <Alert variant="destructive">
          <Ban aria-hidden="true" />
          <AlertTitle>New app downloads are blocked</AlertTitle>
          <AlertDescription>
            {blockedReason} Copies that were already downloaded still open and
            cannot be recalled.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <p className="text-xs text-muted-foreground">Official edition</p>
            <h2 className="font-serif text-2xl">{collection.title}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {candidate.editionId} · {formatBytes(candidate.sizeBytes)} · A5 ×
              6 pages · issued{" "}
              {candidate.receipt && formatWhen(candidate.receipt.issuedAt)}
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2
              className="size-4 text-[var(--status-available)]"
              aria-hidden="true"
            />
            Matches the approved candidate: stored bytes{" "}
            <code className="font-mono text-xs">
              {shortDigest(candidate.pdfDigest)}
            </code>{" "}
            (check simulated in the prototype)
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void downloadPdf()}>
              <Download aria-hidden="true" /> Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadReceipt(collection, candidate)}
            >
              Download receipt (.json)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            File name:{" "}
            <span className="font-mono">
              {pdfFileName(collection, candidate)}
            </span>
          </p>
          {savedDigest && (
            <p role="status" className="text-xs text-muted-foreground">
              Saved. This placeholder file’s SHA-256 is{" "}
              <code className="font-mono">{shortDigest(savedDigest)}</code>; the
              receipt records it so you can{" "}
              <Link to="/verify" className="underline underline-offset-2">
                verify it offline
              </Link>
              .
            </p>
          )}
          <TrustNote>
            The PDF works without Chorus or an account, so you can save it,
            print it, or send it to anyone. Once saved, copies can be forwarded
            and cannot be recalled, even if someone later withdraws. In this
            prototype the file is a one-page placeholder, not the rendered
            photozine.
          </TrustNote>
        </div>
      )}
      <PriorCandidates
        state={state}
        collection={collection}
        current={candidate}
      />
    </div>
  );
}

export function PriorCandidates({
  state,
  collection,
  current,
}: {
  state: PrototypeState;
  collection: Collection;
  current?: Candidate;
}) {
  const prior = state.candidates
    .filter((c) => c.collectionId === collection.id && c.id !== current?.id)
    .sort((a, b) => b.frozenAt.localeCompare(a.frozenAt));
  if (!prior.length) return null;
  return (
    <section aria-labelledby="prior-candidates" className="space-y-2">
      <h3 id="prior-candidates" className="text-sm font-semibold">
        Earlier candidates
      </h3>
      <ul className="divide-y rounded-lg border text-sm">
        {prior.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2"
          >
            <span>
              <span className="font-mono text-xs">{c.editionId}</span>{" "}
              <span className="text-xs text-muted-foreground">
                revision {c.planRevision} · frozen {formatWhen(c.frozenAt)} by{" "}
                {personById(state, c.frozenBy).name}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {c.status === "invalidated"
                ? `Invalidated: ${c.invalidatedReason ?? "no reason recorded"}`
                : c.status === "issued"
                  ? "Issued"
                  : "In review"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
