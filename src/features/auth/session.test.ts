import { describe, expect, it } from "vitest";
import { TideSession, type TideClient } from "./session";

const issuer = "https://identity.example/realms/chorus";

function tideClient(): TideClient {
  return {
    authenticated: true,
    idToken: "alice-id-token",
    idTokenParsed: {
      sub: "alice",
      iss: issuer,
      aud: "chorus",
      exp: 4_000_000_000,
    },
    async init() {
      return this.authenticated;
    },
    async login() {},
    async logout() {},
    async updateToken() {
      return false;
    },
    clearToken() {
      this.authenticated = false;
      this.idToken = undefined;
    },
  };
}

describe("Tide session token boundary", () => {
  it("sends the ID token to Convex and honors a forced renewal", async () => {
    const client = tideClient();
    client.updateToken = async (minValidity) => {
      if (minValidity === -1) client.idToken = "renewed-alice-id-token";
      return minValidity === -1;
    };
    const session = new TideSession(client, {
      issuer,
      clientId: "chorus",
      origin: "https://chorus.example",
    });
    await session.initialize();
    expect(await session.fetchAccessToken({ forceRefreshToken: false })).toBe(
      "alice-id-token",
    );
    expect(await session.fetchAccessToken({ forceRefreshToken: true })).toBe(
      "renewed-alice-id-token",
    );
    expect(session.getSnapshot().subject).toBe("alice");
  });

  it("honors forced renewal even while a cached-token check is pending", async () => {
    const client = tideClient();
    let finishCachedCheck!: (value: boolean) => void;
    client.updateToken = (minValidity) => {
      if (minValidity === -1) {
        client.idToken = "forced-renewal-token";
        return Promise.resolve(true);
      }
      return new Promise((resolve) => {
        finishCachedCheck = resolve;
      });
    };
    const session = new TideSession(client, {
      issuer,
      clientId: "chorus",
      origin: "https://chorus.example",
    });
    await session.initialize();
    const cached = session.fetchAccessToken({ forceRefreshToken: false });
    const forced = session.fetchAccessToken({ forceRefreshToken: true });
    finishCachedCheck(false);
    await cached;
    expect(await forced).toBe("forced-renewal-token");
  });

  it("fails closed if token renewal changes the authenticated subject", async () => {
    const client = tideClient();
    client.updateToken = async () => {
      client.idToken = "bob-id-token";
      client.idTokenParsed = { ...client.idTokenParsed, sub: "bob" };
      return true;
    };
    const session = new TideSession(client, {
      issuer,
      clientId: "chorus",
      origin: "https://chorus.example",
    });
    await session.initialize();
    expect(
      await session.fetchAccessToken({ forceRefreshToken: true }),
    ).toBeNull();
    client.onAuthSuccess?.();
    expect(session.getSnapshot().phase).toBe("error");
    expect(
      await session.fetchAccessToken({ forceRefreshToken: false }),
    ).toBeNull();
  });

  it("logout immediately blocks access and a late renewal cannot restore it", async () => {
    const client = tideClient();
    let finishRenewal!: (value: boolean) => void;
    let finishLogout!: () => void;
    client.updateToken = () =>
      new Promise((resolve) => {
        finishRenewal = resolve;
      });
    client.logout = () =>
      new Promise((resolve) => {
        finishLogout = resolve;
      });
    const session = new TideSession(client, {
      issuer,
      clientId: "chorus",
      origin: "https://chorus.example",
    });
    await session.initialize();
    const pendingToken = session.fetchAccessToken({ forceRefreshToken: true });
    const pendingLogout = session.logout();
    expect(session.getSnapshot().phase).toBe("anonymous");
    expect(
      await session.fetchAccessToken({ forceRefreshToken: false }),
    ).toBeNull();
    finishRenewal(true);
    expect(await pendingToken).toBeNull();
    client.onAuthSuccess?.();
    expect(session.getSnapshot().phase).toBe("anonymous");
    finishLogout();
    await pendingLogout;
    expect(client.idToken).toBeUndefined();
  });

  it("does not return stale credentials after a failed renewal", async () => {
    const client = tideClient();
    client.updateToken = async () => {
      throw new Error("synthetic-secret-token");
    };
    const session = new TideSession(client, {
      issuer,
      clientId: "chorus",
      origin: "https://chorus.example",
    });
    await session.initialize();
    expect(
      await session.fetchAccessToken({ forceRefreshToken: true }),
    ).toBeNull();
    expect(session.getSnapshot().phase).toBe("error");
    expect(JSON.stringify(session.getSnapshot())).not.toContain(
      "synthetic-secret-token",
    );
  });

  it.each([
    { iss: "https://untrusted.example/realms/chorus" },
    { aud: "another-app" },
    { exp: 1 },
    { sub: "" },
  ])("fails closed for invalid ID token claims: %j", async (claims) => {
    const client = tideClient();
    client.idTokenParsed = { ...client.idTokenParsed, ...claims };
    const session = new TideSession(client, {
      issuer,
      clientId: "chorus",
      origin: "https://chorus.example",
    });
    await session.initialize();
    expect(session.getSnapshot().phase).toBe("error");
    expect(
      await session.fetchAccessToken({ forceRefreshToken: false }),
    ).toBeNull();
  });

  it("resumes the same subject when the SDK restores a session after reload", async () => {
    const options = {
      issuer,
      clientId: "chorus",
      origin: "https://chorus.example",
    };
    const first = new TideSession(tideClient(), options);
    const reloaded = new TideSession(tideClient(), options);
    await first.initialize();
    await reloaded.initialize();
    expect(first.getSnapshot().subject).toBe("alice");
    expect(reloaded.getSnapshot().subject).toBe("alice");
  });
});
