import { describe, expect, it } from "vitest";
import { safeReturnPath } from "./return-path";

describe("post sign-in return path", () => {
  it("keeps workspace paths", () => {
    for (const path of ["/app", "/app/join/ABCD-EFGH", "/app/collections?x=1"])
      expect(safeReturnPath(path)).toBe(path);
  });

  it("falls back to /app for anything else", () => {
    for (const path of [
      null,
      "",
      "https://evil.example/app",
      "//evil.example/app",
      "/\\evil.example",
      "/application",
      "/auth/redirect",
      "/app/ x",
      "/app" + "/x".repeat(300),
    ])
      expect(safeReturnPath(path)).toBe("/app");
  });
});
