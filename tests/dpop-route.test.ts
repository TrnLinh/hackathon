import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const issuer = "http://localhost:8080/realms/chorus";

function request(iss = issuer, client = "chorus", method = "GET") {
  const issuerHex = Buffer.from(iss).toString("hex");
  const clientHex = Buffer.from(client).toString("hex");
  return new Request(
    `http://localhost:3000/tide_dpop/iss/${issuerHex}/aud/${clientHex}/tide_dpop_auth.html`,
    { method },
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TIDECLOAK_URL", "http://localhost:8080");
  vi.stubEnv("NEXT_PUBLIC_TIDECLOAK_REALM", "chorus");
  vi.stubEnv("NEXT_PUBLIC_TIDECLOAK_CLIENT_ID", "chorus");
});

afterEach(() => vi.unstubAllEnvs());

describe("Tide DPoP session verification route", () => {
  it("serves the SDK verification page with its embedding and script protections", async () => {
    const { GET } = await import("../src/app/tide_dpop/[...path]/route");
    const response = GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toContain(
      "sha256-",
    );
    expect(response.headers.get("allow-csp-from")).toBe("*");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("<script>");
  });

  it.each([
    ["https://another.example/realms/chorus", "chorus"],
    [issuer, "another-client"],
  ])("rejects a different issuer or client: %s, %s", async (iss, client) => {
    const { GET } = await import("../src/app/tide_dpop/[...path]/route");
    expect(GET(request(iss, client)).status).toBe(403);
  });

  it("keeps the callback unavailable when Tide is unconfigured", async () => {
    vi.stubEnv("NEXT_PUBLIC_TIDECLOAK_URL", "");
    vi.stubEnv("NEXT_PUBLIC_TIDECLOAK_REALM", "");
    vi.stubEnv("NEXT_PUBLIC_TIDECLOAK_CLIENT_ID", "");
    const { GET } = await import("../src/app/tide_dpop/[...path]/route");
    expect(GET(request()).status).toBe(404);
  });

  it("answers HEAD without returning the verification document", async () => {
    const { HEAD } = await import("../src/app/tide_dpop/[...path]/route");
    const response = HEAD(request(issuer, "chorus", "HEAD"));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("");
  });
});
