/**
 * One-time setup for build execution.
 *
 * Creates the Managed Agents agent and environment that every build run
 * references, then prints their ids for .env.local. Run this once, not on every
 * deploy — re-running creates duplicates.
 *
 *   npx tsx scripts/setup-build-agent.ts
 */
import Anthropic from "@anthropic-ai/sdk"

import {
  BUILD_AGENT_CONFIG,
  BUILD_ENVIRONMENT_CONFIG,
} from "../src/lib/build/agent-config"

process.loadEnvFile(".env.local")

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.")
    process.exit(1)
  }

  const client = new Anthropic()

  // Re-running with an existing agent id updates it in place, creating a new
  // version, rather than leaving an orphaned duplicate behind.
  const existingAgentId = process.env.ANTHROPIC_BUILD_AGENT_ID
  if (existingAgentId) {
    const agent = await client.beta.agents.update(
      existingAgentId,
      BUILD_AGENT_CONFIG
    )
    console.log(`Agent updated: ${agent.id} (now version ${agent.version})`)
    console.log("Environment left as-is.")
    return
  }

  const environment = await client.beta.environments.create(
    BUILD_ENVIRONMENT_CONFIG
  )
  console.log(`Environment created: ${environment.id}`)

  const agent = await client.beta.agents.create(BUILD_AGENT_CONFIG)
  console.log(`Agent created: ${agent.id} (version ${agent.version})`)

  console.log("\nAdd these to .env.local:\n")
  console.log(`ANTHROPIC_BUILD_AGENT_ID=${agent.id}`)
  console.log(`ANTHROPIC_BUILD_ENVIRONMENT_ID=${environment.id}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
