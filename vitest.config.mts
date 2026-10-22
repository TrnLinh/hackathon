import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors the tsconfig `@/*` path so app modules can be tested directly.
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("src/", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    // Tide ships extensionless ESM imports that need Vite's browser resolver.
    server: {
      deps: { inline: [/@tidecloak\/js/, /heimdall-tide/, /@tideorg\/js/] },
    },
  },
});
