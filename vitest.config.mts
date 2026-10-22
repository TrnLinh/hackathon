import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    // Tide ships extensionless ESM imports that need Vite's browser resolver.
    server: {
      deps: { inline: [/@tidecloak\/js/, /heimdall-tide/, /@tideorg\/js/] },
    },
  },
});
