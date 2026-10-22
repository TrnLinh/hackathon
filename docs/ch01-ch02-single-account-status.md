# CH-01 and CH-02: single-account verification

Checked 22 October 2026. Scope: the existing enrolled Tide identity only.
Accounts 2 and 3 are explicitly deferred by the user. Their local realm users
exist but remain unlinked and have no governance administrator role. The
original ticket acceptance criteria are unchanged; neither issue is closed.

## Verified outcomes

| Check                             | Result and boundary                                                                                                                                                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Realm provisioning and enrollment | Fresh `chorus` realm, real enrolled administrator, signed adapter exported. Original failed database preserved.                                                                                                         |
| Client configuration              | Exact callback/logout origins, PKCE S256, DPoP and ID-token audience `chorus` applied. No pending governance changes.                                                                                                   |
| Real login and backend identity   | Chorus signed in; Convex `identity.current` returned the expected subject and issuer.                                                                                                                                   |
| Reload and logout                 | Reload restored the same verified subject; logout blocked Collections and a full navigation required sign-in.                                                                                                           |
| Forced renewal                    | The SDK renewed; a separate Convex HTTP client accepted the returned ID token and confirmed the same identity.                                                                                                          |
| JWT validation                    | Four passing cases against an empty disposable native backend, including valid EdDSA controls, missing/expired/wrong-issuer/wrong-audience/forged tokens, and clearing auth. Issuer and subjects were synthetic.        |
| Self encryption/decryption        | Real Tide round trip of synthetic `abc`, tag `message`, existing self roles, 160 ciphertext bytes, exact recovered digest. No shared policy or new permissions.                                                         |
| Offline policy signature          | Real admin-policy signature verified using the locally pinned realm VVK; corrupted signature rejected. Synthetic tests also cover body/key/identifier substitution and malformed bytes. This is not a receipt verifier. |

No raw JWTs, dokens, requests, enrollment links, passwords, or private source
content are recorded here. The main backend keeps its real Tide issuer. The
disposable test backend was stopped and removed after the run.

Final validation for this pass: 72 Vitest cases and 9 backlog-publication cases
passed; one private-artifact case is skipped in the default suite and passed
separately with the captured real policy (5/5 signature cases in that run). All
four disposable native JWT cases passed. Lint, frontend/backend TypeScript,
repository formatting, production build, and diff whitespace checks passed. A
fresh read-only code/security review found no actionable findings. Changes are
saved locally; no pull request was created or issue closed by this pass.

Integration check: the change set was applied to `origin/main` at `97c33b7`
(including CH-10). All 249 application tests and 9 publication tests passed;
the optional private-policy case passed separately with all 5 signature cases.
Lint, both TypeScript checks, repository formatting and the production build
passed on that integrated tree. Main's login return-path behavior was retained.

## Reproduce the available checks

1. Start the existing configured app and native Convex backend, then sign in with
   the enrolled account. Open `/app/settings`, confirm the verified subject, and
   click **Verify session renewal**. Success explicitly says Convex confirmed the
   same identity. This control is absent in production.
2. Open `/app/policy-proof` in development and click **Run self-encryption check**.
   The SDK uses only its existing `message` self roles. An error is not evidence
   of a shared-policy denial.
3. Run `npm test` and `npm run check`. The regular policy-signature suite uses
   generated test keys. Its real-policy case is deliberately skipped unless
   both private file paths below are supplied.
4. To recheck the captured real policy privately:

   ```bash
   CHORUS_LIVE_POLICY_PATH="$PWD/.policy-proof/actual-admin-policy.private.bin" \
   CHORUS_LIVE_POLICY_TRUST_PATH="$PWD/.policy-proof/realm-policy-trust.private.json" \
   npx vitest run tests/policy-signature.test.ts
   ```

   These ignored local artifacts must match this deployment. The trust file
   contains `{ keyId, keys }` from the provisioning adapter's realm VVK, not the
   OIDC issuer's JWKS. Verification establishes integrity under those pins; it
   does not establish that an expired/revoked policy is usable.

5. Run the native JWT checks only in a separate empty deployment, as described
   in [authentication verification](authentication.md#verification). Never
   replace the main deployment's issuer with the synthetic issuer.

## Deferred CH-01 acceptance

- Three real contributors with distinct backend-verified subjects and stable
  per-person sessions, plus cross-identity rejection checks.
- Three distinct enrolled governance administrators and a measured sensitive
  change that remains ineffective below multi-approval quorum.
- Real cross-collection access isolation against the collection/membership endpoints.

The current single administrator's observed one-approval workflow is useful
operational evidence, but it does not prove resistance to unilateral changes.

## Remaining CH-02 implementation and external gates

- A reviewed Chorus contract or explicitly reviewed alternative, with agreed
  target network, deployed source/hash, signed policies and trust configuration.
  Current vendor guidance reserves custom deployment to Tide's team on
  experimental/test networks.
- Exact named contributor, reviewer, editor and processor binding at the
  protected operation, including successful controls around stale/tampered
  evidence, duplicate actors, wrong version, recipient and purpose denials.
- An ORK-enforced authoritative permission revision and inspectable ordering of
  withdrawal against release, dispatch and signing. No supported primitive was
  established by current source research; a database flag or policy expiry does
  not supply this guarantee.
- Edition-model signed-message semantics, exact PDF/manifest/final-approver
  binding, and an independent offline receipt verifier. The policy-signature
  verifier must not be reused as proof of this unrelated message format.
- Distinct actors and multi-administrator tests when the deferred identities
  are available. A fourth unrelated identity may be needed for denial cases.

The built-in `RelationshipAttestation:1` workflow can support narrower probes,
but it is not an exact Chorus consent contract. Applying its policy requires
additional fixed operation roles and actual network availability; neither is
silently substituted or assumed. Details and primary sources are in the
[single-account capability research](research/ch02-single-account-capabilities.md)
and [ADR 0001](adr/0001-tide-policy-proof.md).
