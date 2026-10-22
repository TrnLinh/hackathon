[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

Chorus turns a group's shared photos, voice notes, videos and stories into a six-page printable photozine, and nothing appears in it until everyone involved has approved.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

Chorus is a collaborative keepsake maker for weddings and farewells. Friends contribute memories, design a zine from a template or optional AI, and download one PDF. What's distinctive is that consent is per person, per version and per use: everyone shown or quoted approves their memory, separately approves any AI processing, then approves the exact final file.

### 2. Trust constraint insight

Group keepsakes rely on one organiser holding everyone's private moments, on a platform that can quietly reuse them for AI. People over-share or opt out. When each memory is released only with the consent of the people in it, and a withdrawal stops future use, friends can contribute intimate material such as a voice note or a candid video without giving up control.

### 3. Value & impact

Contributors keep their say; organisers stop chasing approvals in group chats. For example, Priya's voice note about leaving home can be quoted in the zine while she declines AI transcription. She confirms the excerpt, and the final PDF cannot be issued without her approval.

### 4. Why TideCloak matters

TideCloak is our identity and trust layer. People sign in through Tide (PKCE and DPoP), and the Convex backend independently verifies every token before serving a collection. Tide's decentralised keys and quorum governance are how consent becomes enforced rather than a database flag: sources are released by policy, and no single administrator, including us, can decrypt them or change permissions alone.

### 5. Prototype & storytelling

Working today: real Tide sign-in, reload, logout and session renewal verified by Convex; collections, join links and memory uploads; a template composer; and a deterministic PDF renderer. The `/app/policy-proof` workbench runs a live Tide encrypt-and-decrypt round trip and verifies a realm policy signature offline. Look for the "Viewing as" switcher, which shows each friend's approval inbox, and a declined memory dropping out while the zine continues. Multi-person release and signed receipts are still simulated.

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
