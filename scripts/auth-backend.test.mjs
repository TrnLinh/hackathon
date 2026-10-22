// Real Convex token validation with a synthetic OIDC issuer. Never use real credentials.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { ConvexHttpClient } from "convex/browser";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { api } from "../convex/_generated/api.js";

const backend = process.env.CHORUS_AUTH_TEST_URL ?? "http://127.0.0.1:3320";
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(new URL(backend).hostname),
  "Use a disposable local Convex backend for synthetic authentication tests.",
);
const issuer = "http://127.0.0.1:3330/realms/chorus";
const keys = await generateKeyPair("EdDSA", { extractable: true });
const publicKey = {
  ...(await exportJWK(keys.publicKey)),
  alg: "EdDSA",
  use: "sig",
  kid: "chorus-test-key",
};
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/realms/chorus/.well-known/openid-configuration") {
    res.end(
      JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
        token_endpoint: `${issuer}/protocol/openid-connect/token`,
        jwks_uri: `${issuer}/protocol/openid-connect/certs`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["EdDSA"],
      }),
    );
  } else if (req.url === "/realms/chorus/protocol/openid-connect/certs") {
    res.end(JSON.stringify({ keys: [publicKey] }));
  } else {
    res.writeHead(404).end("{}");
  }
});

before(async () => {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(3330, "127.0.0.1", resolve);
  });
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function token({
  subject = "alice",
  audience = "chorus",
  iss = issuer,
  expired = false,
  key = keys.privateKey,
} = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "EdDSA", kid: "chorus-test-key", typ: "JWT" })
    .setSubject(subject)
    .setIssuer(iss)
    .setAudience(audience)
    .setIssuedAt(expired ? now - 7200 : now)
    .setExpirationTime(expired ? now - 3600 : now + 300)
    .sign(key);
}

function caller(jwt) {
  const client = new ConvexHttpClient(backend, { logger: false });
  if (jwt) client.setAuth(jwt);
  return client;
}

test("three signed EdDSA identities survive real Convex OIDC verification", async () => {
  for (const subject of ["alice", "bob", "carol"]) {
    const identity = await caller(await token({ subject })).query(
      api.identity.current,
      {},
    );
    assert.equal(identity.subject, subject);
    assert.equal(identity.issuer, issuer);
  }
});

test("unauthenticated protected requests are rejected", async () => {
  await assert.rejects(caller().query(api.identity.current, {}));
});

test("expired, wrong-issuer, wrong-audience and forged tokens are rejected", async () => {
  const forged = await generateKeyPair("EdDSA");
  for (const jwt of [
    await token({ expired: true }),
    await token({ iss: "https://untrusted.example/realms/chorus" }),
    await token({ audience: "another-app" }),
    await token({ key: forged.privateKey }),
  ]) {
    await assert.rejects(caller(jwt).query(api.identity.current, {}));
  }
});

test("clearing authentication removes protected access", async () => {
  const client = caller(await token());
  assert.equal((await client.query(api.identity.current, {})).subject, "alice");
  client.clearAuth();
  await assert.rejects(client.query(api.identity.current, {}));
});
