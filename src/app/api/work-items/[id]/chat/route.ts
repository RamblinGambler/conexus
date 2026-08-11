import Anthropic from "@anthropic-ai/sdk"
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod"
import { asc, eq } from "drizzle-orm"

import { db } from "@/db"
import { chatMessages } from "@/db/schema"
import {
  TOOL_DESCRIPTIONS,
  TOOL_SCHEMAS,
  buildContext,
  buildToolImpls,
  type Caller,
} from "@/lib/ai/orchestrator"
import { getCurrentUser } from "@/lib/session"
import { getWorkspaceMode } from "@/lib/workspace"
import { runStubChat } from "@/lib/ai/stub-chat"

const MODEL = "claude-opus-5"
const MAX_TOKENS = 8000

type Emit = (event: Record<string, unknown>) => void

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/work-items/[id]/chat">
) {
  const { id } = await ctx.params

  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "Not signed in" }, { status: 401 })
  }

  const body = (await request.json()) as { message?: unknown }
  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message) {
    return Response.json({ error: "Message is required" }, { status: 400 })
  }

  const caller: Caller = { id: user.id, role: user.role, name: user.name }
  const mode = await getWorkspaceMode()
  const context = await buildContext(id, caller)
  if (!context) {
    return Response.json({ error: "Work item not found" }, { status: 404 })
  }

  await db.insert(chatMessages).values({
    workItemId: id,
    role: "user",
    content: message,
    userId: user.id,
  })

  const history = await db.query.chatMessages.findMany({
    where: eq(chatMessages.workItemId, id),
    orderBy: [asc(chatMessages.createdAt)],
    limit: 40,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let reply = ""
      const emit: Emit = (event) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }

      try {
        const impls = buildToolImpls(id, caller, message, mode)

        if (!process.env.ANTHROPIC_API_KEY) {
          if (process.env.NODE_ENV === "production") {
            throw new Error("ANTHROPIC_API_KEY is not set")
          }
          reply = await runStubChat(message, context.item, impls, emit)
        } else {
          reply = await runLiveChat(context.system, history, impls, emit)
        }
      } catch (error) {
        emit({
          type: "error",
          message: error instanceof Error ? error.message : "Chat failed",
        })
      }

      if (reply.trim()) {
        await db.insert(chatMessages).values({
          workItemId: id,
          role: "assistant",
          content: reply.trim(),
        })
      }

      emit({ type: "done" })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

async function runLiveChat(
  system: string,
  history: { role: "user" | "assistant"; content: string }[],
  impls: ReturnType<typeof buildToolImpls>,
  emit: Emit
) {
  const client = new Anthropic()

  /** Reports every tool result to the client as it happens. */
  const report = async (summary: string) => {
    emit({ type: "tool", summary })
    return summary
  }

  const tools = [
    betaZodTool({
      name: "set_status",
      description: TOOL_DESCRIPTIONS.set_status,
      inputSchema: TOOL_SCHEMAS.set_status,
      run: async (input) => report(await impls.set_status(input)),
    }),
    betaZodTool({
      name: "set_priority",
      description: TOOL_DESCRIPTIONS.set_priority,
      inputSchema: TOOL_SCHEMAS.set_priority,
      run: async (input) => report(await impls.set_priority(input)),
    }),
    betaZodTool({
      name: "set_owner",
      description: TOOL_DESCRIPTIONS.set_owner,
      inputSchema: TOOL_SCHEMAS.set_owner,
      run: async (input) => report(await impls.set_owner(input)),
    }),
    betaZodTool({
      name: "update_roadmap",
      description: TOOL_DESCRIPTIONS.update_roadmap,
      inputSchema: TOOL_SCHEMAS.update_roadmap,
      run: async (input) => report(await impls.update_roadmap(input)),
    }),
    betaZodTool({
      name: "update_prd",
      description: TOOL_DESCRIPTIONS.update_prd,
      inputSchema: TOOL_SCHEMAS.update_prd,
      run: async (input) => report(await impls.update_prd(input)),
    }),
    betaZodTool({
      name: "update_spec",
      description: TOOL_DESCRIPTIONS.update_spec,
      inputSchema: TOOL_SCHEMAS.update_spec,
      run: async (input) => report(await impls.update_spec(input)),
    }),
  ]

  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    system,
    tools,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  })

  let reply = ""
  for await (const messageStream of runner) {
    for await (const event of messageStream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        reply += event.delta.text
        emit({ type: "text", delta: event.delta.text })
      }
    }
  }

  return reply
}
