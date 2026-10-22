"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useProofSdk } from "@/features/auth/auth-provider";

export function SingleAccountPanel() {
  const getSdk = useProofSdk();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("This probe has not run.");

  async function run() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setResult("Waiting for the live Tide self-encryption round trip…");
    try {
      const sdk = getSdk();
      const { probeSelfEncryption } = await import("./self-proof");
      const proof = await probeSelfEncryption(sdk);
      if (getSdk() !== sdk) throw new Error("Session changed");
      setResult(
        `Self-encryption round trip passed: ${proof.ciphertextBytes} ciphertext bytes; recovered abc SHA-256 ${proof.plaintextDigest}. This does not prove shared release, contributor consent, or withdrawal.`,
      );
    } catch {
      setResult(
        "Self-encryption did not complete. Check the signed-in identity, message self permissions, request enclave, and Tide service. No shared-policy acceptance result is claimed.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-md border p-4">
      <h2 className="font-semibold">Single-account primitive check</h2>
      <p className="text-sm text-muted-foreground">
        Encrypts and decrypts synthetic abc bytes for the current identity using
        its existing message self permissions. No shared policy is supplied.
      </p>
      <Button disabled={busy} onClick={run}>
        {busy ? "Waiting for Tide…" : "Run self-encryption check"}
      </Button>
      <p role="status" className="break-words text-sm">
        {result}
      </p>
    </section>
  );
}
