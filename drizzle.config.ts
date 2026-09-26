import { existsSync } from "node:fs"

import { defineConfig } from "drizzle-kit"

// Local development keeps DATABASE_URL in .env.local. CI and any deployment
// supply it through the environment, where that file does not exist — and
// loadEnvFile throws rather than ignoring a missing file.
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
