import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

/**
 * The suite covers pure logic only — encryption, the role gate, pull-request
 * URL extraction, and the AI output schemas. Nothing here reaches the network,
 * the Anthropic API, or a database, so no environment setup is needed.
 *
 * The `@` alias mirrors `paths` in tsconfig.json. Resolved manually rather than
 * through vite-tsconfig-paths to avoid the extra dependency for one alias.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
})
