import { useState } from "react";
import { FileSignature, Loader2, Lock, ReceiptText } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        title="No candidate to issue"
      >
        Freeze a candidate and collect every final approval first.
      </EmptyState>
    );

  if (candidate.status === "issued" && candidate.receipt)
    return <ReceiptCard collection={collection} candidate={candidate} />;

  const progress = candidateProgress(candidate);
  const ready = progress.approved === progress.total && progress.total > 0;
  const isCreator = collection.creatorId === state.viewerId;

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <FileSignature className="size-4" aria-hidden="true" /> Issue the
        official edition
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Issuance asks the consent policy to sign a receipt binding the exact PDF
        and manifest digests to every required final approval and the current
        permission revision. Direct requests or edited database flags cannot
        mint a valid receipt.
      </p>
      <p role="status" className="text-sm">
        {ready
          ? `All ${progress.total} required approvals are in.`
          : `${progress.approved} of ${progress.total} approvals so far. Issuance stays locked until everyone approves${progress.declined ? "; a decline blocks it" : ""}.`}
      </p>
      {signing && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Requesting the policy signature…
        </p>
      )}
      {isCreator ? (
        <Button
          disabled={!ready || signing}
          onClick={() => {
            setSigning(true);
            window.setTimeout(() => {
              actions.issueEdition(candidate.id);
              setSigning(false);
            }, 1200);
          }}
        >
          Issue edition
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          {personById(state, collection.creatorId).name} issues the edition once
          everyone has approved.
        </p>
      )}
      <TrustNote>
        Prototype: issuance is simulated and the signature is synthetic. It is
        not a Tide signature and proves nothing.
      </TrustNote>
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
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4" aria-hidden="true" /> Consent receipt
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="divide-y text-sm">
          <Row label="Receipt">
            <code className="font-mono text-xs">{receipt.id}</code>
          </Row>
          <Row label="Edition">
            <code className="font-mono text-xs">{candidate.editionId}</code>
          </Row>
          <Row label="Issued">{formatWhen(receipt.issuedAt)}</Row>
          <DigestRow label="PDF digest (SHA-256)" digest={receipt.pdfDigest} />
          <DigestRow
            label="Manifest digest (SHA-256)"
            digest={receipt.manifestDigest}
          />
          <Row label="Required approvals">
            {receipt.approverCount} of {receipt.approverCount}
          </Row>
          <Row label="Permission revision">{receipt.permissionRevision}</Row>
          <Row label="Signature">
            <code className="font-mono text-xs break-all">
              {receipt.signature}
            </code>
          </Row>
        </dl>
        <Button
          variant="outline"
          onClick={() => void downloadReceipt(collection, candidate)}
        >
          Download receipt (.json)
        </Button>
        <TrustNote>
          The receipt contains digests, counts, and the signature only: no
          memory content, no reasons for declining, and no contributor names. In
          this prototype the signature is synthetic, not a Tide signature.
        </TrustNote>
      </CardContent>
    </Card>
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
