import Anthropic from "@anthropic-ai/sdk"
process.loadEnvFile(".env.local")
const client = new Anthropic()
const SID = process.argv[2]

const s = await client.beta.sessions.retrieve(SID)
console.log("session status:", s.status)

let mcpError = null
let counts = {}
let lastMsg = null
let sawMcpTool = false
for await (const e of client.beta.sessions.events.list(SID)) {
  counts[e.type] = (counts[e.type] ?? 0) + 1
  if (e.type === "session.error") mcpError = JSON.stringify(e.error)
  if (e.type.includes("mcp_tool_use")) sawMcpTool = true
  if (e.type === "agent.message") {
    const t = (e.content ?? []).filter(b => b.type === "text").map(b => b.text).join("")
    if (t.trim()) lastMsg = t
  }
}
console.log("MCP connection error:", mcpError ?? "NONE — connected OK")
console.log("used an MCP tool:", sawMcpTool)
console.log("events:", JSON.stringify(counts))
if (lastMsg) console.log("\nlatest agent message:\n" + lastMsg.slice(0, 700))
