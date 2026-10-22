import { describe, expect, it } from "vitest";
import { browserAuthConfig } from "./config";

describe("browser authentication configuration", () => {
  it("leaves the public shell usable without identity settings", () => {
    expect(browserAuthConfig({})).toBeNull();
  });
  it("uses the same realm issuer and client as the backend", () => {
    expect(
      browserAuthConfig({
        NEXT_PUBLIC_TIDECLOAK_URL: "https://identity.example/",
        NEXT_PUBLIC_TIDECLOAK_REALM: "chorus",
        NEXT_PUBLIC_TIDECLOAK_CLIENT_ID: "chorus",
      }),
    ).toMatchObject({
      issuer: "https://identity.example/realms/chorus",
      clientId: "chorus",
    });
  });
  it("rejects partial configuration and realm path injection", () => {
    expect(() =>
      browserAuthConfig({
        NEXT_PUBLIC_TIDECLOAK_URL: "https://identity.example",
      }),
    ).toThrow();
    expect(() =>
      browserAuthConfig({
        NEXT_PUBLIC_TIDECLOAK_URL: "https://identity.example",
        NEXT_PUBLIC_TIDECLOAK_REALM: "chorus/../other",
        NEXT_PUBLIC_TIDECLOAK_CLIENT_ID: "chorus",
      }),
    ).toThrow();
  });
});
