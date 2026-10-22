import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");

describe("authenticated identity", () => {
  it("rejects an unauthenticated caller", async () => {
    const backend = convexTest(schema, modules);
    await expect(backend.query(api.identity.current, {})).rejects.toThrow(
      "UNAUTHENTICATED",
    );
  });

  it("returns the backend-verified subject for each contributor", async () => {
    const backend = convexTest(schema, modules);
    for (const subject of ["alice", "bob", "carol"]) {
      const contributor = backend.withIdentity({
        subject,
        issuer: "https://identity.example/realms/chorus",
        tokenIdentifier: `https://identity.example/realms/chorus|${subject}`,
      });
      await expect(
        contributor.query(api.identity.current, {}),
      ).resolves.toEqual({
        subject,
        issuer: "https://identity.example/realms/chorus",
        tokenIdentifier: `https://identity.example/realms/chorus|${subject}`,
      });
      await expect(
        contributor.query(api.identity.current, {
          subject: "someone-else",
        } as never),
      ).rejects.toThrow();
    }
  });
});
