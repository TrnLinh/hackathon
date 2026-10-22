import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, Download, Lock } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { ActionBar, Disclosure } from "@/components/chorus/primitives";
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
import { DigestRow, PlanPages, ProvenanceRows } from "./common";
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
        title="Not official yet"
      >
        Downloads open once everyone has approved and it is made official.
      </EmptyState>
    );

  const plan = state.plans.find((p) => p.id === candidate.planId);
  const isMember = candidate.downloadMemberIds.includes(state.viewerId);
  const blockedReason = candidate.invalidatedReason
    ? candidate.invalidatedReason
    : !isMember
      ? "You are not one of the people who can download this edition."
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
          <AlertTitle>New downloads are blocked</AlertTitle>
          <AlertDescription>
            {blockedReason} Copies already saved still open and cannot be
            recalled.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <section className="space-y-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border sm:p-6">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1.5 text-sm font-semibold text-lime-ink">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Official
              </p>
              <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-tighter sm:text-4xl">
                It is official. Your zine is ready.
              </h2>
              <p className="mt-1 text-base text-muted-foreground">
                {collection.title}
              </p>
              <p className="tabular mt-1 text-base text-muted-foreground">
                6 pages, {formatBytes(candidate.sizeBytes)}
              </p>
            </div>
            {plan && (
              <PlanPages
                plan={plan}
                state={state}
                editionId={candidate.editionId}
              />
            )}
            {savedDigest && (
              <p role="status" className="text-base text-muted-foreground">
                Saved. You can{" "}
                <Link
                  to="/verify"
                  className="font-medium text-primary underline underline-offset-4"
                >
                  check the proof
                </Link>{" "}
                any time.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Once saved, copies can be shared and cannot be recalled.
            </p>
          </section>

          <ActionBar>
            <Button
              variant="highlight"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => void downloadPdf()}
            >
              <Download aria-hidden="true" /> Download PDF
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => void downloadReceipt(collection, candidate)}
            >
              Download proof
            </Button>
          </ActionBar>
        </>
      )}

      <Disclosure summary="Details">
        <dl className="divide-y">
          <div className="flex flex-wrap justify-between gap-2 py-2">
            <dt>Edition</dt>
            <dd className="font-mono text-foreground">{candidate.editionId}</dd>
          </div>
          {candidate.receipt && (
            <div className="flex flex-wrap justify-between gap-2 py-2">
              <dt>Made official</dt>
              <dd className="text-foreground">
                {formatWhen(candidate.receipt.issuedAt)}
              </dd>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2 py-2">
            <dt>File name</dt>
            <dd className="font-mono break-all text-foreground">
              {pdfFileName(collection, candidate)}
            </dd>
          </div>
          <DigestRow label="PDF fingerprint" digest={candidate.pdfDigest} />
          <DigestRow
            label="Manifest fingerprint"
            digest={candidate.manifestDigest}
          />
          {plan && <ProvenanceRows plan={plan} />}
          <div className="py-2">
            <dt>Approved by</dt>
            <dd className="text-foreground">
              {Object.keys(candidate.approvals)
                .map((id) => personById(state, id).name)
                .join(", ")}
            </dd>
          </div>
        </dl>
        {savedDigest && (
          <p>
            Saved file fingerprint{" "}
            <code className="font-mono">{shortDigest(savedDigest)}</code>
          </p>
        )}
        <p>
          In this prototype the file is a one-page placeholder, and the match
          check is simulated.
        </p>
      </Disclosure>
      <TrustNote>The PDF works without Chorus or an account.</TrustNote>
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
    <Disclosure summary={`Earlier drafts (${prior.length})`}>
      <ul className="divide-y">
        {prior.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-baseline justify-between gap-2 py-2"
          >
            <span>
              <span className="font-mono text-foreground">{c.editionId}</span>{" "}
              version {c.planRevision}, locked {formatWhen(c.frozenAt)} by{" "}
              {personById(state, c.frozenBy).name}
            </span>
            <span>
              {c.status === "invalidated"
                ? `No longer valid: ${c.invalidatedReason ?? "no reason recorded"}`
                : c.status === "issued"
                  ? "Official"
                  : "Waiting for approvals"}
            </span>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
