# Chorus

Chorus turns shared photos, voice notes, videos, and stories into a downloadable photozine using templates or optional AI-assisted design, with everyone involved having a say in their use and the final edition.

The planned product has two creation modes sharing one DesignPlan/editor/PDF engine. Template creation works with AI disabled and no inference credentials/service; a backend runtime switch gates all AI calls. Accepted AI drafts remain manually editable and valid approved PDFs stay downloadable when AI is off. See product/SRD v0.3 and CH-22 for the requirements; this documentation does not implement those features or select an AI model/provider.

This repository contains the project foundation and a TideCloak authentication integration with a protected Convex identity query. One real identity has completed sign-in, reload, logout, and forced-renewal checks against the local realm and Convex. Additional identities and multi-administrator governance verification remain deferred before CH-01 can close. See the [implementation backlog](docs/backlog.md) for product-feature status and remaining release gates.

CH-02 adds a development-only synthetic policy workbench at `/app/policy-proof`, exact source/processor/edition commitments, and SDK probes for encryption, contributor request handoff, release and signing. A live single-account self-encryption round trip and offline verification of the realm's admin-policy signature now pass. These do not establish shared consent or an edition receipt. The deployed Chorus contract, authoritative withdrawal mechanism, shared protected-operation evidence and offline receipt verification remain pending. See the [current single-account evidence and remaining gates](docs/ch01-ch02-single-account-status.md) and the [integration decision](docs/adr/0001-tide-policy-proof.md). CH-02 remains open.

CH-03 adds the internal immutable consent model, multimedia/design lineage, canonical edition manifests, and default-off server AI configuration records. Evidence and edition claims remain unverified; no product release, dispatch, signing, or download API is added. See the [model contract and migration boundary](docs/immutable-consent-model.md).

## Stack

- Next.js App Router with TypeScript.
- TanStack Router for the client workspace at /app.
- Convex for the backend, schema, and generated API types.
- shadcn/ui with Radix primitives and Tailwind CSS.

## Run locally

Use the **native Convex + Docker TideCloak** setup below for real local sign-in
and the single-account cryptographic demo. The [UI-only preview](#ui-only-preview)
and [Docker Convex alternative](#docker-convex-alternative) are separate options.

### Prerequisites

- Node.js 22 or newer and npm. `.nvmrc` selects Node 22; run `nvm use` if you use nvm.
- Docker with Docker Compose, running through Docker Desktop or Colima.
- A platform supported by Convex's native local backend. The local Tide flow was verified on Apple Silicon macOS.
- Internet access for Tide enrollment, sign-in, and cryptographic network operations.

Run commands from the repository directory containing `package.json`:

```bash
git clone https://github.com/TrnLinh/hackathon.git
cd hackathon
npm ci
```

For an existing checkout, run `npm ci` there and keep its existing private
configuration. `.env.local`, `.env.tidecloak.local`, `.convex/`, and
`.policy-proof/` are ignored by Git and are not included in a fresh clone or
another worktree. Configure each checkout separately and run only one local
stack on the ports below at a time.

| Service                      | Local address           |
| ---------------------------- | ----------------------- |
| Chorus / Next.js             | `http://localhost:3000` |
| Native Convex API            | `http://127.0.0.1:3320` |
| Native Convex site endpoints | `http://127.0.0.1:3321` |
| TideCloak                    | `http://localhost:8080` |

### 1. Start TideCloak

Start your Docker engine first. If you already use the Colima profile created
for this project, start it with `colima start chorus`.

For a new installation, create `.env.tidecloak.local` in your editor with the
following entries, replacing the password placeholder with your own password.
Keep the existing file when restarting an already provisioned realm.

```dotenv
TIDECLOAK_BOOTSTRAP_USERNAME=admin
TIDECLOAK_BOOTSTRAP_PASSWORD=<your-local-bootstrap-password>
```

Then run:

```bash
chmod 600 .env.tidecloak.local
docker compose -p chorus-identity-fresh \
  --env-file .env.tidecloak.local -f compose.tidecloak.yaml up -d
```

This guide uses Compose project `chorus-identity-fresh`, matching the verified
local realm. Reuse that project name to retain the same database on restart.
If your existing realm uses another Compose project name, use that name
consistently instead. The one-shot data initializer exiting with status 0 is
expected.

Wait for the server to respond:

```bash
curl --fail http://localhost:8080/realms/master/.well-known/openid-configuration
```

### 2. Provision the realm and browser client

Skip provisioning if you already have the enrolled `chorus` realm and its
exported client adapter. Otherwise follow the realm/client steps in the
[authentication guide](docs/authentication.md#provision-a-development-realm).
The container is already running after step 1. Complete Tide's license setup
and first-account enrollment; a local Keycloak user alone is not a linked Tide
identity. Run any template initializer in a separate directory so it does not
overwrite this repository.

Use realm `chorus`, a public browser client named `chorus`, and these exact
browser settings:

| Setting              | Value                                                                                |
| -------------------- | ------------------------------------------------------------------------------------ |
| Redirect URIs        | `http://localhost:3000/auth/redirect`, `http://localhost:3000/silent-check-sso.html` |
| Post-logout redirect | `http://localhost:3000/app`                                                          |
| Web origin           | `http://localhost:3000`                                                              |
| Login flow           | Authorization code, PKCE S256; implicit/direct grants off                            |
| DPoP                 | Enabled                                                                              |
| Audience mapper      | `chorus` included in both ID tokens and access tokens                                |

Keep the client adapter private. Add these public settings to `.env.local`,
using the actual values from that adapter:

```dotenv
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3320
NEXT_PUBLIC_TIDECLOAK_URL=http://localhost:8080
NEXT_PUBLIC_TIDECLOAK_REALM=chorus
NEXT_PUBLIC_TIDECLOAK_CLIENT_ID=chorus
NEXT_PUBLIC_TIDECLOAK_VENDOR_ID=<adapter-vendorId>
NEXT_PUBLIC_TIDECLOAK_HOME_ORK_URL=<adapter-homeOrkUrl>
NEXT_PUBLIC_TIDECLOAK_CLIENT_ORIGIN_AUTH=<adapter-client-origin-auth-http://localhost:3000>
```

The final value is the adapter field named
`client-origin-auth-http://localhost:3000`; it is not just the application URL.
Use `.env.example` as a field reference, preserving any Convex settings already
written to `.env.local`. Never add administrative credentials, client secrets,
or tokens to `NEXT_PUBLIC_` variables.

### 3. Start native Convex

In terminal 1, start the local backend and function watcher:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev \
  --local-cloud-port 3320 --local-site-port 3321
```

This uses accountless local development. The CLI creates its local deployment
configuration and updates `.env.local`; keep that terminal running. The port
flags are supported by the pinned Convex CLI and may change after an upgrade.

In terminal 2, configure the **backend's** Tide issuer and audience together:

```bash
npx convex env set --force <<'ENV'
TIDECLOAK_ISSUER=http://localhost:8080/realms/chorus
TIDECLOAK_CLIENT_ID=chorus
ENV
```

These values belong to the Convex deployment. Setting them only in the Next.js
environment file does not configure backend authentication. If the first
function sync reports missing variables, leave the backend running while setting
them, then restart the watcher if it has not resumed.

Use native Convex for this loopback Tide issuer: both processes can reach the
Mac's `localhost:8080`. A Docker container's `localhost` refers to that container.

### 4. Start Chorus and verify the connection

In terminal 2, after configuring the backend:

```bash
npm run dev -- --port 3000
```

Open [Project setup](http://localhost:3000/app/settings). Confirm:

1. **Convex backend** reports **Connected**.
2. Sign in with your enrolled Tide identity; **Verified subject** and the issuer
   appear after Convex accepts it.
3. In development, click **Verify session renewal** and confirm that Convex
   accepts the renewed token for the same identity.
4. Optionally open the [policy workbench](http://localhost:3000/app/policy-proof)
   and run **Run self-encryption check**. It uses synthetic `abc` bytes and the
   existing `message` self permissions. Shared consent, withdrawal, and edition
   signing remain separate release gates.

One enrolled identity is enough for this development path. The additional
accounts and multi-administrator tests remain deferred as recorded in the
[single-account status](docs/ch01-ch02-single-account-status.md).

Keep Next.js on port 3000. If another checkout is using that port, stop its dev
command before starting this one; an automatic fallback to 3001 would use an
origin that is not covered by the client settings above. Restart Next.js after
changing `.env.local`; rebuild production after changing public settings.

### Restart and stop

Once the native deployment and private environment files are configured, the
usual startup is:

```bash
docker compose -p chorus-identity-fresh \
  --env-file .env.tidecloak.local -f compose.tidecloak.yaml up -d
npm run dev:all
```

`dev:all` runs the configured Convex watcher and Next.js together. Stop it with
Ctrl+C. If you used separate terminals, stop both development commands with
Ctrl+C. Stop TideCloak with:

```bash
docker compose -p chorus-identity-fresh \
  --env-file .env.tidecloak.local -f compose.tidecloak.yaml down
```

The Compose command retains its named database volume. Keep `.convex/` with the
checkout that created the native local deployment so its data and credentials
remain available on restart.

### UI-only preview

In a fresh checkout without a configured `.env.local`, the public UI shell runs
without Docker, Convex, or Tide:

```bash
npm ci
npm run dev
```

The overview and Project setup load, and the backend reports **Not configured**.
Authenticated collection/member flows require the full setup above. Synthetic
prototype screens do not establish real consent or encryption. If the checkout
already has a configured backend, keep that configuration and start its services
instead of overwriting its environment file.

### Docker Convex alternative

For a fresh local backend without loopback Tide authentication:

```bash
npm ci
npm run setup:local
npx convex env set --force <<'ENV'
TIDECLOAK_ISSUER=
TIDECLOAK_CLIENT_ID=
ENV
npm run dev:all
```

The setup script starts Docker Convex on loopback ports 3210/3211, generates its
admin credential privately, and writes the connection settings to `.env.local`.
The empty backend auth values intentionally disable identity for this mode.
Run `docker compose down` to stop that backend; its named volume retains data.
Run `npm run setup:local` to start it again.

The script refuses to replace an existing native, cloud, or different
self-hosted configuration. To combine Docker Convex with Tide authentication,
use an exact HTTPS Tide issuer reachable from both the browser and container;
the Mac's loopback issuer from the primary guide will not work inside Docker.
For a cloud backend, see the [Convex Next.js quickstart](https://docs.convex.dev/quickstart/nextjs)
and configure that deployment's issuer/audience separately.

### Local troubleshooting

| Symptom                                                 | Check                                                                                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Port 3000 or 8080 is busy                               | Stop the other local stack. Keep the registered browser origin on port 3000.                                                                                                                      |
| Browser says `Network request failed` during enrollment | On the active Tide enclave site, check the browser's **Apps on device** / local-network permission for access to the local TideCloak server.                                                      |
| `Cookie not found` or a session error                   | Restart from Chorus sign-in or a valid enrollment invitation in the same browser profile. Use `localhost` consistently for the frontend and Tide URLs; do not reuse a saved session callback URL. |
| Approval window does not open                           | Check whether the browser blocked the Tide console's approval popup.                                                                                                                              |
| Browser signs in but Convex rejects it                  | Check the backend issuer/audience, the issued ID-token audience, and the backend's reachability to discovery/JWKS.                                                                                |
| Missing DPoP verification page                          | This branch includes `/tide_dpop/[...path]`; restart the dev server after updating the checkout.                                                                                                  |

## Routing

Next.js serves the root layout and the optional catch-all page at src/app/app/[[...path]]/page.tsx. The root URL redirects to /app. A client-only entry mounts TanStack Router with basepath /app.

| URL                                     | Page                                                    |
| --------------------------------------- | ------------------------------------------------------- |
| /app                                    | Overview and demo journey                               |
| /app/collections                        | Collections and creation (CH-04)                        |
| /app/collections/:id                    | Memories board with consent states (CH-05, CH-07)       |
| /app/collections/:id/members            | Members, join link, and admission (CH-04)               |
| /app/collections/:id/memories/new       | Multimedia memory editor (CH-05)                        |
| /app/collections/:id/memories/:memoryId | Versions, decisions, and derivative review (CH-19)      |
| /app/collections/:id/compose            | Template and optional AI composer (CH-09, CH-18, CH-20) |
| /app/collections/:id/edition            | Freeze, final approval, receipt, download (CH-10–13)    |
| /app/collections/:id/history            | Consent and processing history (CH-14)                  |
| /app/join/:code                         | Join request flow (CH-04)                               |
| /app/approvals                          | Approval inbox and past decisions (CH-07, CH-08)        |
| /app/approvals/:memoryId                | Source review, AI permissions, withdrawal (CH-06–08)    |
| /app/processors                         | AI switch, inference disclosures, health (CH-21, CH-22) |
| /app/verify                             | Offline receipt verification (CH-12)                    |
| /app/settings                           | Project setup and live backend connection               |
| /app/policy-proof                       | Synthetic Tide policy workbench (development only)      |

Collection, membership, and join flows require verified sign-in and use Convex. The workspace also includes synthetic prototype collections and screens backed by src/features/prototype and browser localStorage. The "Viewing as" switcher changes the prototype persona; it does not change the authenticated Tide identity. Edition and history routes currently require a prototype collection. Treat simulated consent, processing, and receipt states as UI demonstrations; see the backlog and individual feature documents for backend implementation and verification status.

Define workspace routes in src/router/index.tsx using TanStack's programmatic route API. Use TanStack Link inside the workspace; its destinations are relative to the router base, such as /collections. Use Next.js routes for future server endpoints or pages outside the workspace. Do not add a second Next.js page for a path already owned by the workspace router.

The public `/auth/redirect` callback belongs to Next.js and completes Tide sign-in. See the [CH-01 authentication setup and verification guide](docs/authentication.md) for realm enrollment, environment configuration, governance checks, and the remaining live evidence. Sign-in is optional for the public overview and setup pages; protected backend functions always require a verified identity.

The history adapter in src/router/history.ts keeps TanStack's history decorations separate from Next.js history writes. This avoids synchronous router updates during Next.js insertion effects while preserving browser back and forward. Keep workspace URL changes inside TanStack navigation APIs.

The client workspace is intentionally rendered in the browser. It does not receive Next.js server rendering for each TanStack route. Direct navigation and refresh work through the Next.js catch-all page.

## Project structure

```text
convex/
  _generated/          Generated API and database types
  schema.ts            Collections, memberships, memories, and consent records
  system.ts            Public connection query with no user data
  identity.ts          Protected backend-verified identity query
  auth.config.ts       Exact Tide OIDC issuer and audience configuration
scripts/
  setup-local-convex.mjs
src/
  app/                 Next.js layout, root redirect, and workspace entry
  components/          Providers, app shell, and shadcn/ui components
  features/            Overview, collections, and setup pages
  router/              Typed TanStack route tree
  lib/                 Shared utilities
```

The schema stores workflow metadata and reserves fields for ciphertext; it does not encrypt data on its own. Protected collection and memory operations enforce backend identity and resource access checks. Tide policy enforcement, withdrawal, and edition receipt verification have separate release gates documented in the backlog.

## Commands

| Command                   | Purpose                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| npm run dev               | Start Next.js only                                                 |
| npm run setup:local       | Start the Docker backend and configure local credentials           |
| npm run dev:backend       | Sync and watch Convex functions                                    |
| npm run dev:all           | Start Convex development and Next.js together                      |
| npm run check             | Run ESLint and TypeScript checks for frontend and backend          |
| npm run format:check      | Check source formatting                                            |
| npm run format            | Format source and documentation                                    |
| npm run build             | Create the production Next.js build                                |
| npm test                  | Run backlog, identity, configuration, and session tests            |
| npm run test:auth:backend | Exercise real local Convex OIDC validation with a synthetic issuer |
| npm start                 | Serve that production build                                        |

Add more shadcn/ui components with:

```bash
npx shadcn add dialog
```

After changing backend functions or schema, run the Convex development command and commit the refreshed convex/_generated files.

## Verification

Before committing:

```bash
npm run check
npm run format:check
npm run build
```

For the browser smoke check, open /app, navigate to Collections and Project Setup, refresh those URLs directly, and use browser back and forward. With a backend running, confirm that Project Setup displays Connected. Without configuration, confirm that the workspace still loads and reports Not configured.

## Implementation backlog

See the [implementation issues](docs/backlog.md) for priorities, dependencies, parallel groups, and acceptance criteria. The issue manifest in docs/backlog/issues.json is published by the Publish Chorus backlog workflow. Explicit once-only scope revisions retain prior issue descriptions/notes, unchanged completed criteria, comments, assignments, and closed states; other issue text stays unchanged. Regenerate the readable backlog with npm run backlog:docs; run publication tests with npm test.

## Product documents

- [Product specification](docs/chorus-product-spec.md): user experience, consent, photozine output, and MVP scope.
- [Software requirements](docs/chorus-srd.md): functional requirements, data boundaries, and acceptance tests.

The next feature milestone is one encrypted memory with real contributor-controlled release. The detailed policy behavior must be validated with Tide before claiming that ordinary database flags enforce consent.

## References

- [Next.js single-page applications](https://nextjs.org/docs/app/guides/single-page-applications).
- [TanStack code-based routing](https://tanstack.com/router/latest/docs/routing/code-based-routing).
- [Convex self-hosted development](https://github.com/convex/convex-backend/tree/main/self-hosted).
- [shadcn/ui installation](https://ui.shadcn.com/docs/installation/next).
