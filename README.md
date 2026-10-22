# Chorus

Chorus turns shared photos, voice notes, videos, and stories into a downloadable photozine using templates or optional AI-assisted design, with everyone involved having a say in their use and the final edition.

The planned product has two creation modes sharing one DesignPlan/editor/PDF engine. Template creation works with AI disabled and no inference credentials/service; a backend runtime switch gates all AI calls. Accepted AI drafts remain manually editable and valid approved PDFs stay downloadable when AI is off. See product/SRD v0.3 and CH-22 for the requirements; this documentation does not implement those features or select an AI model/provider.

This repository contains the project foundation and a TideCloak authentication integration with a protected Convex identity query. Live Tide realm enrollment and governance verification remain required before CH-01 can close. Collection creation, photo uploads, encryption, contributor approvals, and PDF export are not implemented yet.

CH-02 adds a development-only synthetic policy workbench at `/app/policy-proof`, exact source/processor/edition commitments, and SDK probes for encryption, contributor request handoff, release and signing. These are integration scaffolding, not completed product encryption or consent. The deployed Chorus contract, authoritative withdrawal mechanism, live protected-operation evidence and offline receipt verification remain pending. See the [integration decision and deferred live procedure](docs/adr/0001-tide-policy-proof.md). Realm enrollment and live checks were explicitly deferred; CH-02 remains open.

CH-03 adds the internal immutable consent model, multimedia/design lineage, canonical edition manifests, and default-off server AI configuration records. Evidence and edition claims remain unverified; no product release, dispatch, signing, or download API is added. See the [model contract and migration boundary](docs/immutable-consent-model.md).

## Stack

- Next.js App Router with TypeScript.
- TanStack Router for the client workspace at /app.
- Convex for the backend, schema, and generated API types.
- shadcn/ui with Radix primitives and Tailwind CSS.

## Quick start with Docker

Use Node.js 22 or newer, npm, Docker, and Docker Compose.

```bash
npm ci
npm run setup:local
npm run dev:all
```

Open [Chorus](http://localhost:3000/app). The Project Setup page calls a live Convex query and shows its connection status.

The setup script starts the official Convex backend on loopback ports 3210 and 3211, creates its admin credential, and saves it privately in ignored .env.local. It preserves unrelated environment settings and refuses to replace an existing cloud or different self-hosted deployment. The Docker volume retains local data when the container stops.

Stop the development command with Ctrl+C, then stop the backend when finished:

```bash
docker compose down
```

Run setup:local again to start the backend next time. Avoid deleting the Docker volume unless you intend to erase its data. The container is provided for local development.

## Other Convex options

On a machine supported by Convex's native backend, run npm ci followed by npm run dev:all and follow the CLI setup prompts. You can select anonymous local development or authenticate and choose a cloud project. The CLI creates .env.local with the deployment configuration.

For a cloud deployment, follow the [Convex Next.js quickstart](https://docs.convex.dev/quickstart/nextjs). If you previously chose Docker, preserve that environment file elsewhere before configuring a cloud deployment. Do not configure a cloud deployment and a self-hosted deployment simultaneously.

For an existing deployment, set NEXT_PUBLIC_CONVEX_URL and the appropriate server-only Convex CLI configuration in .env.local. Never put an admin or deploy key in a NEXT_PUBLIC_ variable. Restart Next.js after changing the client URL.

The UI shell also runs without a backend:

```bash
npm ci
npm run dev
```

Without NEXT_PUBLIC_CONVEX_URL, the setup page displays Not configured. No fake backend data is used. Convex's generated API files are checked in, so the starter can build without logging into Convex.

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

The collection, approval, composer, edition, processor, and receipt screens are a UI prototype. They read synthetic data from src/features/prototype, persisted in browser localStorage, and use a "Viewing as" switcher instead of verified sign-in. The composer defaults to template mode, which builds a six-page plan with no AI. A simulated server-side AI switch (CH-22), which only the operator persona can change, starts off; create-with-AI appears only when it is on. Consent, encryption, AI, PDF, and signature behavior is simulated and is not a verified protection. Replace the prototype store with protected Convex and Tide operations, and restore the sign-in gate, as each backend ticket lands.

Define workspace routes in src/router/index.tsx using TanStack's programmatic route API. Use TanStack Link inside the workspace; its destinations are relative to the router base, such as /collections. Use Next.js routes for future server endpoints or pages outside the workspace. Do not add a second Next.js page for a path already owned by the workspace router.

The public `/auth/redirect` callback belongs to Next.js and completes Tide sign-in. See the [CH-01 authentication setup and verification guide](docs/authentication.md) for realm enrollment, environment configuration, governance checks, and the remaining live evidence. Sign-in is optional for the public overview and setup pages; protected backend functions always require a verified identity.

The history adapter in src/router/history.ts keeps TanStack's history decorations separate from Next.js history writes. This avoids synchronous router updates during Next.js insertion effects while preserving browser back and forward. Keep workspace URL changes inside TanStack navigation APIs.

The client workspace is intentionally rendered in the browser. It does not receive Next.js server rendering for each TanStack route. Direct navigation and refresh work through the Next.js catch-all page.

## Project structure

```text
convex/
  _generated/          Generated API and database types
  schema.ts            Initial collections, memberships, and memories schema
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

The initial schema reserves fields for ciphertext and workflow metadata. It does not encrypt data on its own. There are no public queries or mutations for private collections or memories. Add TideCloak identity, membership authorization, verified source release policies, and resource-specific checks before exposing those operations.

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
