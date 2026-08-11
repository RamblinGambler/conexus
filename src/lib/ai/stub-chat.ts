import type { buildToolImpls } from "@/lib/ai/orchestrator"
import { priorityLabel, statusLabel } from "@/lib/work-items"
import { STATUS_VALUES, PRIORITY_VALUES } from "@/lib/work-items"

const STUB = "[stub — set ANTHROPIC_API_KEY for real answers]"

type Impls = ReturnType<typeof buildToolImpls>
type Emit = (event: Record<string, unknown>) => void

type Item = {
  title: string
  status: (typeof STATUS_VALUES)[number]
  priority: (typeof PRIORITY_VALUES)[number]
}

/**
 * A deliberately literal stand-in for the orchestration agent, used when no API
 * key is configured.
 *
 * It exists so the whole mechanism — tool execution, role gating, change
 * logging, history, streaming — stays verifiable without a key. It matches a
 * few fixed phrasings and calls exactly the same tools the real agent would.
 * It does not understand language; that is the model's job.
 */
export async function runStubChat(
  message: string,
  item: Item,
  impls: Impls,
  emit: Emit
) {
  const text = message.toLowerCase()

  const say = async (reply: string) => {
    // Chunked so the client's streaming assembly is exercised too.
    for (const word of reply.split(" ")) {
      emit({ type: "text", delta: `${word} ` })
      await new Promise((r) => setTimeout(r, 8))
    }
    return reply
  }

  const priority = PRIORITY_VALUES.find(
    (p) => text.includes(`priority to ${p}`) || text.includes(`${p} priority`)
  )
  if (priority) {
    const summary = await impls.set_priority({ priority })
    emit({ type: "tool", summary })
    return say(`${summary} ${STUB}`)
  }

  const status = STATUS_VALUES.find((s) => {
    const label = statusLabel(s).toLowerCase()
    return (
      text.includes(`move it to ${label}`) ||
      text.includes(`move to ${label}`) ||
      text.includes(`status to ${label}`)
    )
  })
  if (status) {
    const summary = await impls.set_status({ status })
    emit({ type: "tool", summary })
    return say(`${summary} ${STUB}`)
  }

  const assign = /assign (?:it )?to ([^\s]+@[^\s]+)/.exec(text)
  if (assign) {
    const summary = await impls.set_owner({ email: assign[1] })
    emit({ type: "tool", summary })
    return say(`${summary} ${STUB}`)
  }

  if (/problem statement|update the prd|rewrite the prd/.test(text)) {
    const summary = await impls.update_prd({
      problemStatement: `${STUB} Updated via chat.`,
    })
    emit({ type: "tool", summary })
    return say(`${summary} ${STUB}`)
  }

  if (/technical approach|update the spec|rewrite the spec/.test(text)) {
    const summary = await impls.update_spec({
      technicalApproach: `${STUB} Updated via chat.`,
    })
    emit({ type: "tool", summary })
    return say(`${summary} ${STUB}`)
  }

  return say(
    `"${item.title}" is currently ${statusLabel(item.status)} with ${priorityLabel(item.priority)} priority. ${STUB}`
  )
}
