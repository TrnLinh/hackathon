"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useProofSdk } from "@/features/auth/auth-provider";
import { RequireSignIn } from "@/features/auth/require-sign-in";
import { bindingTag, digest, parseBinding } from "./binding";
import { SingleAccountPanel } from "./single-account-panel";

const initialBinding = JSON.stringify(
  {
    kind: "source",
    collectionId: "synthetic-collection",
    resourceId: "synthetic-memory",
    versionId: "v1",
    contentDigest:
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    permissionRevision: "r1",
    requiredApprovers: [
      "replace-with-alice-subject",
      "replace-with-bob-subject",
    ],
    recipient: "replace-with-editor-subject",
    audience: [
      "replace-with-alice-subject",
      "replace-with-bob-subject",
      "replace-with-editor-subject",
    ],
    use: { kind: "manual", purpose: "compose-synthetic-fixture" },
  },
  null,
  2,
);

const operations = [
  ["commitment", "Calculate binding commitment (local)"],
  ["encrypt", "Encrypt synthetic bytes (abc)"],
  ["decrypt", "Attempt direct decryption"],
  [
    "raw-decrypt",
    "Raw SDK decryption (bypass local policy guards for negative tests)",
  ],
  ["draft-release", "Draft and initialize source release"],
  ["approve", "Add this contributor’s Tide approval"],
  ["commit-release", "Commit source release"],
  ["draft-edition", "Initialize exact edition signing request"],
  ["sign-edition", "Attempt distributed edition signing"],
] as const;

async function fileBytes(form: FormData, name: string) {
  const file = form.get(name);
  if (!(file instanceof File) || !file.size || file.size > 1024 * 1024)
    throw new Error("Select a nonempty binary file of at most 1 MiB.");
  return new Uint8Array(await file.arrayBuffer());
}

function download(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Workbench() {
  const getSdk = useProofSdk();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [message, setMessage] = useState(
    "No protected operation has run. Live acceptance remains pending.",
  );
  const [commitment, setCommitment] = useState("");
  const [artifact, setArtifact] = useState<{
    bytes: Uint8Array;
    filename: string;
  } | null>(null);

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setArtifact(null);
    setCommitment("");
    setMessage("Operation in progress…");
    try {
      const form = new FormData(event.currentTarget);
      const rawBinding = String(form.get("binding"));
      if (rawBinding.length > 65536) throw new Error("Binding exceeds 64 KiB.");
      const binding = parseBinding(JSON.parse(rawBinding));
      const tag = await bindingTag(binding);
      setCommitment(tag);
      const operation = String(form.get("operation"));
      if (operation === "commitment") {
        setMessage(
          "Local commitment calculated. This does not authorize access or verify a Tide policy.",
        );
        return;
      }
      const { TidePolicyProof } = await import("./tide");
      const sdk = getSdk();
      const proof = new TidePolicyProof(sdk, {
        contractId: String(form.get("contract")),
        keyId: String(form.get("key")),
      });
      const policy = await fileBytes(form, "policy");
      let output: Uint8Array;
      if (operation === "draft-edition" || operation === "sign-edition") {
        if (binding.kind !== "edition")
          throw new Error("Use an edition binding for signing.");
        output =
          operation === "draft-edition"
            ? await proof.draftEdition(binding, policy)
            : await proof.signEdition(
                binding,
                await fileBytes(form, "payload"),
                policy,
              );
      } else if (operation === "approve") {
        output = await proof.approve(
          binding,
          await fileBytes(form, "payload"),
          policy,
        );
      } else {
        if (binding.kind !== "source")
          throw new Error("Use a source binding for encryption or release.");
        if (operation === "encrypt")
          output = await proof.encrypt(
            binding,
            new TextEncoder().encode("abc"),
            policy,
          );
        else {
          const payload = await fileBytes(form, "payload");
          if (operation === "raw-decrypt") {
            const result = await sdk.decrypt(
              [{ encrypted: payload, tags: [tag] }],
              policy,
            );
            if (result.length !== 1 || !(result[0] instanceof Uint8Array))
              throw new Error("Unexpected Tide output.");
            output = result[0];
          } else if (operation === "decrypt")
            output = await proof.decrypt(binding, payload, policy);
          else if (operation === "draft-release")
            output = await proof.draftRelease(binding, payload, policy);
          else if (operation === "commit-release")
            output = await proof.commitRelease(binding, payload, policy);
          else throw new Error("Unknown operation.");
        }
      }
      // Do not surface a result from a session that logged out while awaiting Tide.
      if (getSdk() !== sdk)
        throw new Error("Session changed during the operation.");
      const outputDigest = await digest(output);
      setMessage(
        `Tide returned ${output.length} bytes; SHA-256 ${outputDigest}. This observation alone does not complete any acceptance test.`,
      );
      if (
        operation !== "decrypt" &&
        operation !== "raw-decrypt" &&
        operation !== "commit-release"
      )
        setArtifact({
          bytes: output,
          filename: `chorus-private-${operation}.bin`,
        });
    } catch {
      // SDK exceptions may contain tokens, request bytes or source content.
      setMessage(
        "Operation did not complete. Check the binding, pinned contract/key, signed policy, request expiry, identity and Tide service. A local failure, timeout or outage is not proof of a policy denial. Keep raw diagnostics private.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const fieldClass =
    "mt-1 block w-full rounded-md border bg-background p-2 text-sm";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Tide policy proof</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Development workbench · synthetic fixtures only · CH-02 release gate
          remains open.
        </p>
      </div>
      <p className="text-sm leading-relaxed">
        Use a reviewed, deployed Chorus contract and real signed policies. This
        workbench does not provision policies, implement withdrawal, or verify a
        final receipt. Request files can contain session-bound approval
        credentials: keep them private and out of Git, chat and shared evidence.
        Verify the request in Tide’s approval window before approving it.
      </p>
      <SingleAccountPanel />
      <form onSubmit={run} className="space-y-4">
        <label className="block text-sm">
          Operation
          <select name="operation" className={fieldClass} disabled={busy}>
            {operations.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Exact authorization binding (JSON)
          <textarea
            name="binding"
            defaultValue={initialBinding}
            rows={17}
            className={`${fieldClass} font-mono`}
            required
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          Reviewed contract ID
          <input
            name="contract"
            className={fieldClass}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          Trusted vendor key ID
          <input
            name="key"
            className={fieldClass}
            disabled={busy}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm">
          Signed policy (.bin)
          <input
            type="file"
            name="policy"
            className={fieldClass}
            disabled={busy}
          />
        </label>
        <label className="block text-sm">
          Ciphertext or initialized/approved request (.bin)
          <input
            type="file"
            name="payload"
            className={fieldClass}
            disabled={busy}
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Waiting for Tide…" : "Run selected operation"}
        </Button>
      </form>
      {commitment && (
        <p className="break-all font-mono text-xs">{commitment}</p>
      )}
      <p role="status" className="break-words text-sm">
        {message}
      </p>
      {artifact && (
        <Button
          variant="outline"
          onClick={() => download(artifact.bytes, artifact.filename)}
        >
          Save private binary for the next step
        </Button>
      )}
    </div>
  );
}

export function PolicyProofPage() {
  if (process.env.NODE_ENV !== "development")
    return (
      <p>The synthetic policy workbench is available only in development.</p>
    );
  return (
    <RequireSignIn>
      <Workbench />
    </RequireSignIn>
  );
}
