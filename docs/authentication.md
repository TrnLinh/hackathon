# CH-01 authentication setup and verification

CH-01 integrates browser sign-in with Convex identity. It does not implement source consent, encryption, collection membership, or edition signing. Those remain separate backlog issues.

## Implemented boundary

The browser uses `@tidecloak/js` 0.14.41 directly, with authorization-code flow, PKCE S256, a same-origin callback, and in-memory tokens. It initializes only in the browser. The low-level SDK avoids the IAMService wrapper's JavaScript token cookie. DPoP is enabled for the SDK's access-token operations; Convex receives the OIDC ID token, not a DPoP access token. This does not claim sender-constrained Convex sessions.

`ConvexProviderWithAuth` obtains current ID tokens from the session adapter. Forced token requests force SDK renewal. Renewal failure, expired or mismatched claims, or a change of subject blocks application access. Logout hides protected content immediately, invalidates pending token requests, and initiates Tide's end-session redirect. The SDK clears credentials after constructing that redirect. Browser checks only maintain UI consistency: Convex independently verifies the token signature, issuer, audience, and expiry.

The sign-in callback uses Next.js client navigation to preserve the root provider and its in-memory tokens. When third-party cookies are blocked, the SDK falls back to a top-level session-check redirect so browser reload can recover the provider session. Successful sign-in and session checks that find no active session return to `/app` without reloading the document. `public/silent-check-sso.html` is copied verbatim by the pinned SDK during installation; its checked-in copy matches that output and is excluded from formatting.

`identity.current` accepts no user ID arguments. It returns only the authenticated subject, issuer, and issuer-qualified token identifier from `ctx.auth.getUserIdentity()`. Future collection permissions must use verified identities plus resource-specific authorization. A verified identity alone does not authorize reading a collection.

The public overview, backend status, and setup page remain available without identity configuration. Collections require both a browser session and Convex's confirmation. With no configured issuer the backend accepts no identity providers. Convex requires both environment variables to exist when evaluating `auth.config.ts`; set both to empty strings to deliberately disable identity, or set both to the real realm values.

## Versions and environment

| Component       | Selected version                                                                                         | Verification status                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Browser SDK     | `@tidecloak/js` 0.14.41                                                                                  | Build, typechecking, session boundary tests; live Tide login pending                                                   |
| Tide dev server | 0.14.41, multi-platform digest `sha256:3f52d0bc3e4e3ae5153e172960003bbe94705cd40af6561fd4c7c4434aaa2708` | Startup verified on Apple Silicon with Colima, using both fresh and previously failed volumes; Tide enrollment pending |
| Convex client   | Exact dependency graph in `package-lock.json`                                                            | Native backend OIDC tests with synthetic EdDSA tokens                                                                  |

The server and SDK are independently versioned. The matching version numbers do not prove compatibility; record the live enrollment and renewal results below before calling this a working Tide deployment.

Use `.env.example` as the list of application settings. Public values are bundled by Next.js at build time. Restart development, or rebuild production, after changing them. Credentials, bootstrap passwords, adapter exports, tokens, and local data must stay outside Git.

## Provision a development realm

Use an existing licensed TideCloak realm if available. For an isolated local realm on a machine with Docker Compose, create ignored `.env.tidecloak.local`, set its file permissions to owner-only, and put a unique `TIDECLOAK_BOOTSTRAP_PASSWORD` in it. Optionally set `TIDECLOAK_BOOTSTRAP_USERNAME`. Then run:

```bash
docker compose --env-file .env.tidecloak.local -f compose.tidecloak.yaml up -d
```

On an Apple Silicon Mac using Homebrew, a local Docker engine can be provided by Colima:

```bash
brew install colima docker docker-compose
colima start chorus --cpu 2 --memory 4 --disk 20 --vm-type vz
docker compose version
```

If Docker cannot find the Compose plugin, follow `brew info docker-compose` to add Homebrew's plugin directory to `cliPluginsExtraDirs` in your Docker configuration. Preserve existing configuration and credentials. The `chorus` VM is started manually; `colima stop chorus` releases its resources when finished.

The `tidecloak-data-init` service runs once before the server. The pinned image runs TideCloak as UID `1000`, but its H2 mount path does not exist in the image, so Docker initially creates the named volume as `root:root`. The initializer sets ownership on that volume to `1000:0` and ensures the owner can traverse and write the directory. It has no network and a read-only container filesystem; only the database volume is writable. The main server remains non-root. An initializer status of `Exited (0)` is expected.

This also repairs a volume from the earlier failed startup without deleting it. Do not remove a database volume to resolve this ownership error. Once the container is ready, the following request must succeed before realm initialization:

```bash
curl --fail http://localhost:8080/realms/master/.well-known/openid-configuration
```

The identity server listens only on loopback port 8080 and retains its own volume. Its bootstrap administrator is an operational account; it is not proof of a governed contributor or a `tide-realm-admin` identity. Follow the official [Tide setup](https://docs.tide.org/get-started/Tidecloak%20Quickstart) and [Tide identity provider setup](https://docs.tide.org/Admin/idp) to create realm `chorus`, activate the development license, and complete the first administrator's enclave enrollment. These human enrollment and license actions cannot be replaced by creating local Keycloak users.

Create a public browser client `chorus` with client authentication disabled, standard authorization-code flow enabled, implicit flow disabled, and direct access grants disabled. Require PKCE S256. For a canonical development origin of `http://localhost:3000`, configure these exact entries:

| Setting                        | Value                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Valid redirect URIs            | `http://localhost:3000/auth/redirect`, `http://localhost:3000/silent-check-sso.html` |
| Valid post-logout redirect URI | `http://localhost:3000/app`                                                          |
| Web origin                     | `http://localhost:3000`                                                              |
| ID-token audience              | `chorus`                                                                             |

Enable the client's DPoP support for the SDK's DPoP access-token flow. Export the client adapter privately. Copy only its public URL, realm, resource/client ID, vendor ID, home ORK URL, and the `client-origin-auth-http://localhost:3000` value into the corresponding `NEXT_PUBLIC_TIDECLOAK_*` fields. Do not copy a confidential client secret or administrative token. The browser callback always returns to `/app`; it accepts no arbitrary return URL.

Check the `chorus` client's audience mapper explicitly: `included.client.audience=chorus` and `id.token.claim=true`. The imported template had this audience enabled only on access tokens. Convex receives an ID token, so the access-token setting alone does not satisfy the application's audience requirement. Keep the access-token audience enabled as well.

For hosted use, configure the exact HTTPS equivalents. Do not mix `localhost` and `127.0.0.1` browser origins without registering both separately. The backend must be able to reach the issuer's discovery document and its advertised JWKS URI. For local Tide on loopback, use a native Convex backend: a Docker container's `localhost` points to that container, not your Mac. For the Docker Convex setup, use a shared resolvable HTTPS Tide URL reachable by both the browser and backend.

## Connect the application and backend

For a native local Convex deployment, start `npm run dev:all` and select local development. On a supported machine, accountless local setup can also be started with:

```bash
CONVEX_AGENT_MODE=anonymous npm run dev:all
```

Use `.env.local` for the public browser settings. For example, use `NEXT_PUBLIC_TIDECLOAK_URL=http://localhost:8080`, realm `chorus`, and client ID `chorus`, plus the public Tide-specific fields from the actual adapter. The Convex CLI writes its own deployment settings; preserve them.

In another terminal, configure the backend separately. Set both values in one update so an existing configuration never enters a partially configured state:

```bash
npx convex env set --force <<'ENV'
TIDECLOAK_ISSUER=http://localhost:8080/realms/chorus
TIDECLOAK_CLIENT_ID=chorus
ENV
```

Use the discovery document's exact issuer without a trailing slash. HTTPS is required outside loopback. To deliberately run the public shell without identity, set both backend variables to empty strings in the same update. Setting only one is an error. The issuer and audience values must match between frontend and backend; a browser environment file alone does not configure Convex.

The integration uses Convex's OIDC provider configuration, which accepts EdDSA ID tokens in the local backend test. Its separate custom-JWT configuration supports a narrower algorithm set. Do not switch to an application-held signing key to work around an integration failure.

## Enroll contributors and verify governance

1. Enroll three contributor identities through Tide, using separate browser profiles for the demonstration. Record their stable subjects privately. Display names and ordinary database roles are not identity proof.
2. Enroll at least three distinct administrators and grant the actual `tide-realm-admin` authority through the supported governed workflow. Contributor and administrator roles can overlap, but each action must use its appropriate authority.
3. Verify the live configured threshold. Tide's documented rule is `max(1, floor(0.7 × N))`: three administrators require two approvals, while two administrators still require only one. Treat this as documentation until measured against this realm.
4. Propose a reversible test role/permission change as one administrator. Record the pending result, attempt to commit below quorum, and verify the permission remains ineffective. Add a second distinct approval and record the governed change taking effect. Remove the temporary permission through the governed workflow afterwards.
5. Keep contributor consent separate from administrator votes. The `master` realm and host operations are outside the claimed QEA boundary. CH-02 must test the actual protected source-release operation independently.

Never publish enrollment links containing action tokens, raw JWTs, private adapter exports, bootstrap passwords, or administrator credentials as evidence.

## Verification

Run the ordinary checks:

```bash
npm test
npm run check
npm run format:check
npm run build
```

Unit/in-process tests cover unauthenticated identity access, three verified subjects, refusal of client-supplied subject arguments, configuration validation, forced renewal, invalid claims, subject substitution, refresh failure, and logout racing a pending refresh. The Convex test harness supplies identities; those tests alone do not test JWT signatures.

For actual backend JWT verification, use a disposable native deployment with no private data in a separate temporary project directory. Copy the current `convex/` functions and their `src/lib/consent/` imports into that directory, with access to the same installed dependencies. Keep its `.convex/` and `.env.local` separate from the main application. Configure its issuer as `http://127.0.0.1:3330/realms/chorus` and audience as `chorus`, then run the following only in that disposable project:

```bash
npx convex env set --force <<'ENV'
TIDECLOAK_ISSUER=http://127.0.0.1:3330/realms/chorus
TIDECLOAK_CLIENT_ID=chorus
ENV
CHORUS_AUTH_TEST_URL=http://127.0.0.1:3420 node --test scripts/auth-backend.test.mjs
```

Start the disposable native backend on port 3420 first, for example with `CONVEX_AGENT_MODE=anonymous npx convex dev --local-cloud-port 3420 --local-site-port 3421`, and copy `scripts/auth-backend.test.mjs` into its matching `scripts/` directory. These CLI port flags are internal to the pinned CLI and may change. The test serves synthetic OIDC discovery/JWKS on port 3330 and signs temporary EdDSA tokens in memory. It exercises three subjects, unauthenticated calls, expiry, wrong issuer, wrong audience, forged signatures, and `clearAuth()` against the real backend. It prints no credentials. Stop the disposable deployment afterwards; never point the main deployment at the synthetic issuer.

Before closing CH-01, record live Tide evidence:

| Required evidence                                                                                                | Current status                                              |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| All three actual Tide contributors sign in; `identity.current` returns distinct stable subjects                  | Pending live realm                                          |
| Forced renewal and browser reload preserve each real subject                                                     | Pending live realm                                          |
| Logout removes collection UI and protected backend access; refresh stays signed out after successful end-session | Pending live realm                                          |
| Actual realm rejects invalid tokens through protected backend requests                                           | Synthetic OIDC checks pass; live realm verification pending |
| Three administrators and a measured multi-approval sensitive-change threshold                                    | Pending live realm                                          |
| Server/SDK pairing and public verification configuration recorded                                                | Versions pinned; live compatibility pending                 |

AT-01's cross-collection access assertion requires live tests of the membership/collection endpoints; it cannot be completed by the identity query alone. An issued ID token can remain valid until expiry if copied before logout. Browser logout clears this app's access and ends the provider session; it does not promise immediate revocation of a stolen bearer token at Convex.

## Evidence recorded on 22 October 2026

- `npm test`: 4 backlog-publication tests and 23 authentication/configuration tests passed.
- `npm run test:auth:backend`: 4 real native Convex OIDC checks passed, including a repeat run with newly generated test keys.
- `npm run check`, `npm run format:check`, and `npm run build`: passed.
- Browser inspection: public overview and setup load; the live Convex connection reports Connected; unconfigured identity blocks Collections; direct refresh works; a configured but unreachable identity service displays an actionable error and keeps Collections closed; browser back navigation still works.
- Independent standards and spec reviews found no confirmed implementation defect. The spec review retained the live Tide enrollment and governance evidence gap described above. CH-01 stays open.
- Dependency audit: 9 high-severity advisories remain in the existing development-tooling dependency graph. No new advisory remains from the added test tooling after pinning Vitest 4.1.12. This is not an assertion that the full dependency graph is vulnerability-free.

At the initial implementation check, Docker was unavailable and the pinned Tide container had not been started. The synthetic test issuer must be removed or replaced after running backend checks.

### Local startup follow-up

Colima and Docker were subsequently installed on the Apple Silicon development machine. The first container launch failed with H2 `AccessDeniedException` because the database volume was owned by root and was not writable by UID `1000`. After adding the volume initializer:

- A separate fresh-volume deployment reached HTTP 200 on master-realm OIDC discovery.
- The original failed volume was repaired in place and the server reached the same HTTP 200 check.
- A container running as UID `1000` could write the database directory in both cases.
- The one-shot initializer exited with code `0`; the main server remained running as UID `1000`.
- The isolated test deployment and its disposable volume were removed; the original development volume was retained.

### Realm setup follow-up

On 22 October 2026, the startup fix was present on `main` through PR #24. The existing local `chorus` realm returned HTTP 200 for OIDC discovery. Its public browser client had the exact callback, silent-SSO and logout URLs above, PKCE S256, DPoP enabled, standard flow enabled, and implicit/direct-grant flows disabled. The ID-token audience mapper was corrected and its saved configuration was read back successfully. This is configuration evidence; an issued Tide ID token has not yet been inspected.

The native Convex deployment on port 3320 was configured with issuer `http://localhost:8080/realms/chorus` and audience `chorus`. The browser's Tide settings remain unconfigured until a valid adapter is available; do not invent vendor or enclave values to enable sign-in prematurely.

The realm has a subscription and pending vendor key, but no active vendor key, certificate, or enrolled users. A targeted `POST /admin/realms/chorus/vendorResources/CreateTideVendorKey` with `licensingTier=free` again returned HTTP 500 with code `TIDE-IDPEXT-VENDOR-KEYGEN_FAILED`. Container logs identify the underlying failure as `Midgard.FinalizeWallet` receiving HTTP 403 Forbidden. `isPendingLicenseActive=true` does not establish that wallet finalization or key activation succeeded.

The original realm, subscription, and database volume were preserved. Do not rerun the fresh-realm initializer against this partial realm: it repeats identity-provider creation and can fail on the existing provider; its existing-realm override also approves pending governance requests. Tide must advise how to recover the existing pending wallet. Once recovered, resume enrollment and configuration from the documented initializer stages with inspection between steps, then run the live evidence table above. Creating ordinary local users does not resolve this activation failure.

Container startup does not establish Tide sign-in, license activation, contributor enrollment, or administrator quorum. Those live checks remain required before closing CH-01; keep private enrollment links, license contacts, adapter exports, and credentials outside the PR.

### PR review fixes verified on 22 October 2026

- With a synthetic issuer reporting third-party cookies unavailable and a disposable Docker Convex backend, browser sign-in returned to the workspace through client navigation. The backend verified subject `alice`; reloading recovered the same subject through the top-level session-check fallback.
- Logout blocked Collections, a subsequent reload stayed signed out, and signing in again succeeded. A session check with no provider session returned to the public overview.
- The SDK-owned silent SSO page now matches the package's install output and is excluded from formatting. These synthetic checks do not complete the live Tide enrollment or governance evidence above.

### Fresh realm recovery and DPoP callback follow-up

Later on 22 October 2026, a separate Compose project, `chorus-identity-fresh`,
provisioned a fresh `chorus` realm. The original `chorus-identity` database was
preserved. The earlier wallet-finalization failure above describes that original
realm, rather than the current fresh deployment.

The first administrator completed Tide enrollment. The saved user has both
`tideUserKey` and `vuid` and the `tide-realm-admin` role. The initializer completed
its settings-signing and administrator setup and exported a real client adapter.
The ignored browser environment now contains its public values; the native
Convex backend retains issuer `http://localhost:8080/realms/chorus` and audience
`chorus`.

The enrolled administrator's live Tide enclave approved the queued audience
mapper change. A subsequent admin API read confirmed `id.token.claim=true` and
`access.token.claim=true` for the `chorus` audience, with no pending change
requests. The observed approval threshold was one. This verifies an actual
governed change, but does not establish the required multi-administrator quorum.

The first Chorus login attempt exposed a missing DPoP verification callback:
`/tide_dpop/iss/<issuer-hex>/aud/<client-hex>/tide_dpop_auth.html` returned 404.
The application now serves the installed SDK's bundled document and security
headers through `@tidecloak/js/dpop-route`, constrained to the configured realm
and client. The route stays unavailable when identity is unconfigured. Five
regression cases cover the document/headers, issuer mismatch, client mismatch,
unconfigured identity, and HEAD responses. A request to the running app returned
200 for the configured callback and 403 for another client. The first attempt's
session expired during the callback repair. A fresh authorization flow then
completed against the real Tide realm: the browser returned to Chorus, the
protected Collections page opened, and Project setup displayed the enrolled
administrator's subject from `identity.current` with the exact configured
issuer. A full browser reload restored that same backend-verified subject.
Logout returned the app to Signed out; reopening Collections in a full document
navigation required sign-in. No raw tokens were recorded.

After this repair, `npm test` passed 9 backlog-publication tests and 58 Vitest
tests. `npm run check`, the changed files' formatting check, and `npm run build`
passed. The production build includes the dynamic `/tide_dpop/[...path]` route.

### Existing-account verification and explicit deferrals

The user deferred registration and enrollment of `chorus-demo-2` and
`chorus-demo-3`. Their local realm records exist, but neither identity is linked
or a governance administrator. No enrollment invitation or proposed credential
is published here. The original acceptance criteria remain unchanged.

The development-only Project setup control **Verify session renewal** forces the
SDK to renew, sends the returned ID token to a separate Convex HTTP client, and
requires the backend to report the same subject and issuer. The raw token never
enters rendered output or storage. The live check returned **Session renewed;
Convex confirmed the same identity**. Regression tests also cover a mismatched
subject/issuer, a backend failure, and logout racing the verification.

A separate empty native Convex deployment on ports 3420/3421 ran all four
`auth-backend.test.mjs` cases successfully: valid signed EdDSA controls for three
synthetic subjects; unauthenticated rejection; expired, wrong-issuer,
wrong-audience and forged-token rejection; and removal of protected access after
clearing auth. This is actual backend JWT validation with a synthetic issuer,
not enrollment of three Tide people. The main `.env.local` was unchanged and its
backend retained the real Tide issuer on port 3320. The disposable backend was
stopped and its copied source/data were removed, retaining only private test
evidence.

CH-01 remains open for the deferred real contributors and administrators,
cross-identity checks, and a measured multi-administrator threshold. Its tested
single-account path now includes real sign-in, stable backend identity, reload,
logout, and forced renewal. Cross-collection isolation also requires the later
collection/membership tests with distinct real identities. See the [current evidence matrix](ch01-ch02-single-account-status.md).

## Sources

- [Convex custom OIDC integration](https://docs.convex.dev/auth/advanced/custom-auth).
- [Tide browser SDK guide](https://docs.tide.org/Languages/JavaScript/tidecloak-js-intro).
- [Tide quorum governance](https://docs.tide.org/Core-Concepts/iga-workflow).
- [Tide dev image 0.14.41 metadata](https://hub.docker.com/r/tideorg/tidecloak-dev/tags?name=0.14.41).
- [CH-01 issue](https://github.com/TrnLinh/hackathon/issues/2).
