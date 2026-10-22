import { useState } from "react";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/chorus/page-header";
import { ActionBar, Disclosure } from "@/components/chorus/primitives";
import { Button } from "@/components/ui/button";
import { actions } from "@/features/prototype/store";
import {
  candidateProgress,
  formatWhen,
  personById,
} from "@/features/prototype/selectors";
import type {
  Candidate,
  Collection,
  PrototypeState,
} from "@/features/prototype/types";
import { DigestRow } from "./common";
import { buildReceipt, receiptFileName, saveFile } from "./files";

export async function downloadReceipt(
  collection: Collection,
  candidate: Candidate,
) {
  const receipt = await buildReceipt(collection, candidate);
  saveFile(
    JSON.stringify(receipt, null, 2),
    receiptFileName(candidate),
    "application/json",
  );
}

export function IssueStep({
  state,
  collection,
  candidate,
}: {
  state: PrototypeState;
  collection: Collection;
  candidate?: Candidate;
}) {
  const [signing, setSigning] = useState(false);

  if (!candidate || candidate.status === "invalidated")
    return (
      <EmptyState
        icon={<Lock className="size-5" aria-hidden="true" />}
        title="Nothing to make official"
      >
        Lock a version and collect every approval first.
      </EmptyState>
    );

  if (candidate.status === "issued" && candidate.receipt)
    return <ReceiptCard collection={collection} candidate={candidate} />;

  const progress = candidateProgress(candidate);
  const ready = progress.approved === progress.total && progress.total > 0;
  const isCreator = collection.creatorId === state.viewerId;

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border sm:p-6">
        <span className="grid size-11 place-items-center rounded-full bg-lime text-lime-ink">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-3xl font-semibold tracking-tighter">
          Make it official
        </h2>
        <p className="text-base text-muted-foreground" role="status">
          {ready
            ? `All ${progress.total} approvals are in.`
            : `${progress.approved} of ${progress.total} approved so far.`}
        </p>
        {signing && (
          <p role="status" className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Creating the proof of approval
          </p>
        )}
        {!isCreator && (
          <p className="text-base text-muted-foreground">
            {personById(state, collection.creatorId).name} makes it official.
          </p>
        )}
      </section>

      {isCreator && (
        <ActionBar>
          <Button
            variant="highlight"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!ready || signing}
            onClick={() => {
              setSigning(true);
              window.setTimeout(() => {
                actions.issueEdition(candidate.id);
                setSigning(false);
              }, 1200);
            }}
          >
            Make it official
          </Button>
        </ActionBar>
      )}

      <Disclosure summary="Details">
        <p>
          The proof ties the exact PDF to every approval. This prototype
          simulates it, and the signature is synthetic.
        </p>
      </Disclosure>
    </div>
  );
}

export function ReceiptCard({
  collection,
  candidate,
}: {
  collection: Collection;
  candidate: Candidate;
}) {
  const receipt = candidate.receipt!;
  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border sm:p-6">
      <h2 className="text-xl font-semibold tracking-tight">
        Proof of approval
      </h2>
      <Button
        variant="outline"
        size="lg"
        onClick={() => void downloadReceipt(collection, candidate)}
      >
        Download proof
      </Button>
      <Disclosure summary="Details">
        <dl className="divide-y">
          <Row label="Proof">
            <code className="font-mono">{receipt.id}</code>
          </Row>
          <Row label="Edition">
            <code className="font-mono">{candidate.editionId}</code>
          </Row>
          <Row label="Made official">{formatWhen(receipt.issuedAt)}</Row>
          <DigestRow label="PDF fingerprint" digest={receipt.pdfDigest} />
          <DigestRow
            label="Manifest fingerprint"
            digest={receipt.manifestDigest}
          />
          <Row label="Approvals">
            {receipt.approverCount} of {receipt.approverCount}
          </Row>
          <Row label="Permission version">{receipt.permissionRevision}</Row>
          <Row label="Signature">
            <code className="font-mono break-all">{receipt.signature}</code>
          </Row>
        </dl>
        <p>
          The proof holds fingerprints and counts only, no names or content.
        </p>
      </Disclosure>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}
