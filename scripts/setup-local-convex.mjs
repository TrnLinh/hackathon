import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envPath = ".env.local";
const current = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const localUrl = "http://127.0.0.1:3210";

// Preserve an existing cloud or different self-hosted configuration.
const hasCloud = /^CONVEX_DEPLOYMENT=.+/m.test(current);
const existingUrl = current
  .match(/^CONVEX_SELF_HOSTED_URL=(.*)$/m)?.[1]
  ?.trim();
const publicUrl = current.match(/^NEXT_PUBLIC_CONVEX_URL=(.*)$/m)?.[1]?.trim();
if (
  hasCloud ||
  (existingUrl && existingUrl !== localUrl) ||
  (publicUrl && publicUrl !== localUrl)
) {
  console.error(
    "An existing Convex deployment is configured in .env.local. Keep it, or move that configuration aside before selecting Docker development.",
  );
  process.exit(1);
}

const start = spawnSync("docker", ["compose", "up", "-d", "--wait"], {
  stdio: "inherit",
});
if (start.status !== 0) {
  console.error(
    "Could not start the local Convex backend. Check that Docker and Docker Compose are running.",
  );
  process.exit(1);
}

// Capture the generated credential privately; never print it to the terminal.
const generated = spawnSync(
  "docker",
  ["compose", "exec", "-T", "backend", "./generate_admin_key.sh"],
  { encoding: "utf8" },
);
if (generated.status !== 0 || !generated.stdout.trim()) {
  console.error("Could not generate the local Convex admin credential.");
  process.exit(1);
}

const key = generated.stdout.trim();
if (key.includes("\n") || key.includes("\r")) {
  console.error("The backend returned an unexpected credential format.");
  process.exit(1);
}

const values = {
  CONVEX_SELF_HOSTED_URL: localUrl,
  CONVEX_SELF_HOSTED_ADMIN_KEY: key,
  NEXT_PUBLIC_CONVEX_URL: localUrl,
};
let updated = current;
for (const [name, value] of Object.entries(values)) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  updated = pattern.test(updated)
    ? updated.replace(pattern, () => line)
    : `${updated.trimEnd()}\n${line}\n`;
}
writeFileSync(envPath, `${updated.trim()}\n`, { mode: 0o600 });
chmodSync(envPath, 0o600);
console.log(
  "Local Convex is ready. Credentials were saved to ignored .env.local. Run npm run dev:all.",
);
