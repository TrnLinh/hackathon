[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

Chorus turns a group's photos, voice notes, videos and stories into a six-page printable photozine, and nothing appears until everyone involved approves.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

For weddings and farewells, friends contribute memories, design a zine from a template or optional AI, and download one PDF. Consent is per person, per version and per use: everyone shown or quoted approves their memory, any AI processing, and the exact final file.

### 2. Trust constraint insight

Group keepsakes usually mean one organiser holding everyone's private moments on platforms that may reuse them for AI, so people over-share or opt out. If each memory needs consent from the people in it, and withdrawal stops future use, friends can share a voice note or candid video without losing control.

### 3. Value & impact

Contributors keep their say; organisers stop chasing approvals in group chats. Priya's voice note about leaving home can be quoted while she declines AI transcription. She confirms the excerpt, and no final PDF ships without her approval.

### 4. Why TideCloak matters

TideCloak is our identity and trust layer. Users sign in via Tide (PKCE, DPoP), and Convex verifies every token before serving a collection. Tide's decentralised keys and quorum governance make consent enforced, not a database flag: sources release by policy, and no single administrator, including us, can decrypt them or change permissions alone.

### 5. Prototype & storytelling

Working today: real Tide sign-in, logout and session renewal; collections, join links and uploads; a template composer; and a deterministic PDF renderer. `/app/policy-proof` runs a live Tide encrypt-decrypt round trip and verifies a realm policy signature offline. The "Viewing as" switcher shows each friend's approval inbox; declined memories drop out while the zine continues. Multi-person release and signed receipts remain simulated.

## Setup

Requirements: Node.js 22+, Docker (Docker Desktop or Colima), and internet access for Tide.

```bash
git clone https://github.com/TrnLinh/hackathon.git
cd hackathon
npm ci
```

**UI-only preview** (no Docker, Convex or Tide; synthetic data in the browser):

```bash
npm run dev
```

Open [http://localhost:3000/app](http://localhost:3000/app).

**Full stack with real Tide sign-in:**

1. Create `.env.tidecloak.local` with `TIDECLOAK_BOOTSTRAP_USERNAME` and `TIDECLOAK_BOOTSTRAP_PASSWORD`, then start TideCloak:

   ```bash
   docker compose -p chorus-identity-fresh \
     --env-file .env.tidecloak.local -f compose.tidecloak.yaml up -d
   ```

2. Provision realm `chorus` and public client `chorus`, enroll your Tide account, and copy the adapter's public values into `.env.local` (see `.env.example` and [docs/authentication.md](docs/authentication.md#provision-a-development-realm)).
3. Start the local Convex backend and point it at Tide:

   ```bash
   CONVEX_AGENT_MODE=anonymous npx convex dev \
     --local-cloud-port 3320 --local-site-port 3321
   # in a second terminal:
   npx convex env set --force <<'ENV'
   TIDECLOAK_ISSUER=http://localhost:8080/realms/chorus
   TIDECLOAK_CLIENT_ID=chorus
   ENV
   npm run dev -- --port 3000
   ```

4. Open [http://localhost:3000/app/settings](http://localhost:3000/app/settings), sign in, and confirm Convex shows your verified subject.

Full instructions and troubleshooting are in [README.md](README.md#run-locally).
