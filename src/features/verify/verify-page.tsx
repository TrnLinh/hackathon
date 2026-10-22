import { useId, useState } from "react";
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { PageHeader, TrustNote } from "@/components/chorus/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { shortDigest } from "@/features/prototype/selectors";
import { sha256Hex } from "@/features/edition/files";

// CH-12 offline verification. Everything runs in this browser; no file or
// receipt is uploaded.

type ParsedReceipt = {
  receiptId?: string;
  editionId?: string;
  pdfSha256: string;
  prototypePlaceholderSha256?: string;
  approverCount?: number;
  signature?: string;
};

type Outcome =
  | { kind: "match"; detail: string }
  | { kind: "mismatch"; detail: string }
  | { kind: "malformed"; detail: string }
  | { kind: "incomplete"; detail: string };

const HEX64 = /^[0-9a-f]{64}$/;

function parseReceipt(text: string): ParsedReceipt | null {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const pdf = String(json.pdfSha256 ?? "").toLowerCase();
    if (json.type !== "chorus-consent-receipt" || !HEX64.test(pdf)) return null;
    const placeholder = String(
      json.prototypePlaceholderSha256 ?? "",
    ).toLowerCase();
    return {
      receiptId:
        typeof json.receiptId === "string" ? json.receiptId : undefined,
      editionId:
        typeof json.editionId === "string" ? json.editionId : undefined,
      pdfSha256: pdf,
      prototypePlaceholderSha256: HEX64.test(placeholder)
        ? placeholder
        : undefined,
      approverCount:
        typeof json.approverCount === "number" ? json.approverCount : undefined,
      signature:
        typeof json.signature === "string" ? json.signature : undefined,
    };
  } catch {
    return null;
  }
}

export function VerifyPage() {
  const ids = { pdf: useId(), receipt: useId(), digest: useId() };
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setOutcome(null);
    try {
      const receipt = receiptFile
        ? parseReceipt(await receiptFile.text())
        : null;
      if (!receipt) {
        setOutcome({
          kind: "malformed",
          detail:
            "The receipt is not a Chorus consent receipt or is missing a valid PDF digest. Nothing was checked.",
        });
        return;
      }
      const label = receipt.editionId
        ? `edition ${receipt.editionId}`
        : "this receipt";
      if (pdfFile) {
        const digest = await sha256Hex(await pdfFile.arrayBuffer());
        if (digest === receipt.pdfSha256)
          setOutcome({
            kind: "match",
            detail: `The PDF’s SHA-256 (${shortDigest(digest)}) equals the approved digest in ${label}.`,
          });
        else if (digest === receipt.prototypePlaceholderSha256)
          setOutcome({
            kind: "match",
            detail: `The file matches the prototype placeholder recorded in ${label} (${shortDigest(digest)}). Real editions are checked against the approved PDF digest.`,
          });
        else
          setOutcome({
            kind: "mismatch",
            detail: `The PDF’s SHA-256 (${shortDigest(digest)}) differs from ${label} (${shortDigest(receipt.pdfSha256)}). The file was changed, or the receipt belongs to another edition.`,
          });
        return;
      }
      const typed = pasted.trim().toLowerCase();
      if (!HEX64.test(typed)) {
        setOutcome({
          kind: "incomplete",
          detail:
            "Choose a PDF, or paste a 64-character hexadecimal SHA-256 digest.",
        });
        return;
      }
      setOutcome(
        typed === receipt.pdfSha256
          ? {
              kind: "match",
              detail: `The pasted digest equals the approved digest in ${label}.`,
            }
          : {
              kind: "mismatch",
              detail: `The pasted digest differs from ${label} (${shortDigest(receipt.pdfSha256)}).`,
            },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Offline check"
        title="Verify a receipt"
        description="Confirm that a photozine PDF is the exact file its contributors approved. Files stay in this browser; nothing is uploaded."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Check a file</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void verify();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor={ids.receipt}>Consent receipt (.json)</Label>
                <Input
                  id={ids.receipt}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={ids.pdf}>Photozine PDF</Label>
                <Input
                  id={ids.pdf}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={ids.digest}>
                  Or paste a PDF digest (SHA-256)
                </Label>
                <Input
                  id={ids.digest}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="64 hexadecimal characters"
                  className="font-mono text-xs"
                  disabled={!!pdfFile}
                  aria-describedby={`${ids.digest}-hint`}
                />
                <p
                  id={`${ids.digest}-hint`}
                  className="text-xs text-muted-foreground"
                >
                  Used only when no PDF is chosen. Prototype downloads are
                  placeholders, so you can also paste the digest shown on the
                  edition page.
                </p>
              </div>
              <Button type="submit" disabled={busy || !receiptFile}>
                {busy ? "Checking…" : "Verify"}
              </Button>
            </form>
            <div aria-live="polite" className="mt-5">
              {outcome && <OutcomeView outcome={outcome} />}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <section aria-labelledby="verify-steps" className="space-y-3">
            <h2
              id="verify-steps"
              className="text-lg font-semibold tracking-tight"
            >
              How offline verification works
            </h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              <li>
                Compute the SHA-256 digest of the PDF bytes exactly as received.
              </li>
              <li>
                Compare it with the receipt’s PDF digest. Any change to the file
                changes the digest.
              </li>
              <li>
                Check the receipt signature against the trusted verification
                configuration: the published Chorus policy key and realm
                identifier, obtained from a source you already trust.
              </li>
              <li>
                Confirm the edition identifier printed on the cover matches the
                receipt.
              </li>
            </ol>
            <div className="rounded-lg border bg-card p-3 text-xs">
              <p className="font-medium">Trusted verification configuration</p>
              <dl className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-y-1 text-muted-foreground">
                <dt>Policy key</dt>
                <dd className="font-mono">Not published yet (CH-02)</dd>
                <dt>Realm</dt>
                <dd className="font-mono">Pending Tide enrollment</dd>
                <dt>Algorithm</dt>
                <dd className="font-mono">To be fixed by CH-02</dd>
              </dl>
            </div>
          </section>
          <TrustNote>
            This prototype checks digests only. Its receipt signatures are
            synthetic and are not verified. A valid receipt shows that a file
            was authorized; it cannot stop anyone with a copy from editing or
            forwarding it. An edited copy simply stops matching.
          </TrustNote>
        </div>
      </div>
    </div>
  );
}

function OutcomeView({ outcome }: { outcome: Outcome }) {
  const meta = {
    match: {
      icon: CheckCircle2,
      title: "Matches",
      tone: "text-[var(--status-available)]",
    },
    mismatch: {
      icon: XCircle,
      title: "Does not match",
      tone: "text-[var(--status-excluded)]",
    },
    malformed: {
      icon: CircleHelp,
      title: "Malformed receipt",
      tone: "text-[var(--status-awaiting)]",
    },
    incomplete: {
      icon: CircleHelp,
      title: "Nothing to compare",
      tone: "text-muted-foreground",
    },
  }[outcome.kind];
  const Icon = meta.icon;
  return (
    <div
      role="status"
      className="flex gap-3 rounded-lg border bg-background p-4"
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", meta.tone)}
        aria-hidden="true"
      />
      <div>
        <p className={cn("font-semibold", meta.tone)}>{meta.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{outcome.detail}</p>
      </div>
    </div>
  );
}
