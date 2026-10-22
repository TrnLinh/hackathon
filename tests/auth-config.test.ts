import { describe, expect, it } from "vitest";
import { tideAuthConfig } from "../convex/lib/auth_config";

describe("Tide OIDC configuration", () => {
  it("disables authentication when no realm is configured", () => {
    expect(tideAuthConfig({})).toEqual({ providers: [] });
  });

  it("pins the exact issuer and audience for Convex OIDC verification", () => {
    expect(
      tideAuthConfig({
        TIDECLOAK_ISSUER: "https://identity.example/realms/chorus",
        TIDECLOAK_CLIENT_ID: "chorus",
      }),
    ).toEqual({
      providers: [
        {
          domain: "https://identity.example/realms/chorus",
          applicationID: "chorus",
        },
      ],
    });
  });

  it.each([
    { TIDECLOAK_ISSUER: "https://identity.example/realms/chorus" },
    { TIDECLOAK_CLIENT_ID: "chorus" },
    {
      TIDECLOAK_ISSUER: "http://identity.example/realms/chorus",
      TIDECLOAK_CLIENT_ID: "chorus",
    },
    {
      TIDECLOAK_ISSUER: "https://user:password@identity.example/realms/chorus",
      TIDECLOAK_CLIENT_ID: "chorus",
    },
    {
      TIDECLOAK_ISSUER: "https://identity.example/realms/chorus/",
      TIDECLOAK_CLIENT_ID: "chorus",
    },
    {
      TIDECLOAK_ISSUER: "https://identity.example/realms/chorus?token=secret",
      TIDECLOAK_CLIENT_ID: "chorus",
    },
  ])("rejects incomplete or unsafe configuration", (env) => {
    expect(() => tideAuthConfig(env)).toThrow();
  });
});
