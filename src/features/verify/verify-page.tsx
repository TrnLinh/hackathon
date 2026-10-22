import { useId, useState } from "react";
import {
  CheckCircle2,
  CircleHelp,
  FileCheck2,
  Upload,
  XCircle,
} from "lucide-react";
import { Disclosure } from "@/components/chorus/primitives";
import { PageHeader, TrustNote } from "@/components/chorus/page-header";
import { Button } from "@/components/ui/button";
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
            "This is not a Chorus proof file, or it has no valid PDF fingerprint. Nothing was checked.",
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
    <div className="mx-auto w-full max-w-2xl space-y-5 animate-in fade-in-0 slide-in-from-bottom-2">
      <PageHeader
        title="Check a proof"
        description="See if a PDF is the exact file everyone approved. Files stay on your device."
      />

      <form
        className="space-y-5 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
      >
        <FilePick
          id={ids.pdf}
          step={1}
          label="The PDF"
          accept="application/pdf,.pdf"
          file={pdfFile}
          onFile={setPdfFile}
        />
        <FilePick
          id={ids.receipt}
          step={2}
          label="The proof file"
          accept="application/json,.json"
          file={receiptFile}
          onFile={setReceiptFile}
        />
        <Button
          type="submit"
          variant="highlight"
          size="lg"
          className="w-full"
          disabled={busy || !receiptFile}
        >
          {busy ? "Checking" : "Check a proof"}
        </Button>
        <div aria-live="polite">
          {outcome && <OutcomeView outcome={outcome} />}
        </div>
      </form>

      <Disclosure summary="Details">
        <div className="space-y-1.5">
          <Label htmlFor={ids.digest}>Or paste a PDF fingerprint</Label>
          <Input
            id={ids.digest}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="64 characters"
            className="font-mono"
            disabled={!!pdfFile}
          />
          <p>Used only when no PDF is chosen.</p>
        </div>
        <p>
          We compare the PDF fingerprint (SHA-256) with the one in the proof.
          Any change to the file changes it. Signatures are synthetic here and
          are not checked.
        </p>
      </Disclosure>
      <TrustNote>
        A matching proof shows the file was approved. It cannot stop copies.
      </TrustNote>
    </div>
  );
}

function FilePick({
  id,
  step,
  label,
  accept,
  file,
  onFile,
}: {
  id: string;
  step: number;
  label: string;
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFile(e.dataTransfer.files?.[0] ?? null);
      }}
      className={cn(
        "press flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl bg-muted/60 p-4 ring-1 ring-border transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted",
        over && "bg-accent ring-primary",
        file && "bg-accent/60",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft">
        {file ? (
          <FileCheck2 className="size-5" aria-hidden="true" />
        ) : (
          <Upload className="size-5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-medium">
          <span className="tabular">{step}.</span> {label}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {file ? file.name : "Tap to choose or drop it here"}
        </span>
      </span>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function OutcomeView({ outcome }: { outcome: Outcome }) {
  const meta = {
    match: {
      icon: CheckCircle2,
      title: "It matches",
      line: "This is the file everyone approved.",
      tone: "text-primary",
      bg: "bg-accent",
    },
    mismatch: {
      icon: XCircle,
      title: "It does not match",
      line: "This file was changed, or the proof is for another edition.",
      tone: "text-destructive",
      bg: "bg-destructive/10",
    },
    malformed: {
      icon: CircleHelp,
      title: "That is not a proof file",
      line: "Choose the proof file you downloaded.",
      tone: "text-foreground",
      bg: "bg-muted",
    },
    incomplete: {
      icon: CircleHelp,
      title: "Add the PDF first",
      line: "Choose the PDF to compare.",
      tone: "text-foreground",
      bg: "bg-muted",
    },
  }[outcome.kind];
  const Icon = meta.icon;
  return (
    <div
      role="status"
      className={cn(
        "space-y-2 rounded-2xl p-4 animate-in fade-in-0 slide-in-from-bottom-2",
        meta.bg,
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("size-7 shrink-0", meta.tone)} aria-hidden="true" />
        <div>
          <p className={cn("text-xl font-semibold", meta.tone)}>{meta.title}</p>
          <p className="text-base text-muted-foreground">{meta.line}</p>
        </div>
      </div>
      <Disclosure summary="Details" className="bg-card/70 open:bg-card/70">
        <p>{outcome.detail}</p>
      </Disclosure>
    </div>
  );
}
