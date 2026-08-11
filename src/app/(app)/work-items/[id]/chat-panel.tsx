"use client"

import { Send, Wrench } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ChatTurn = {
  id: string
  role: "user" | "assistant"
  content: string
  author: string
}

export function ChatPanel({
  workItemId,
  initialMessages,
}: {
  workItemId: string
  initialMessages: ChatTurn[]
}) {
  const router = useRouter()
  const [turns, setTurns] = useState<ChatTurn[]>(initialMessages)
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState("")
  const [toolNotes, setToolNotes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  /** Keep the newest message in view as the reply streams in. */
  function scrollToLatest() {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }

  async function send() {
    const message = input.trim()
    if (!message || busy) return

    setInput("")
    setBusy(true)
    setToolNotes([])
    setTurns((t) => [
      ...t,
      { id: `local-${Date.now()}`, role: "user", content: message, author: "You" },
    ])
    requestAnimationFrame(scrollToLatest)

    let reply = ""
    let changed = false

    try {
      const response = await fetch(`/api/work-items/${workItemId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? "Chat failed")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      // NDJSON: one JSON event per line, so split on newlines and keep the tail.
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line)
          if (event.type === "text") {
            reply += event.delta
            setStreaming(reply)
            scrollToLatest()
          } else if (event.type === "tool") {
            changed = true
            setToolNotes((n) => [...n, event.summary])
          } else if (event.type === "error") {
            reply = reply || `Something went wrong: ${event.message}`
          }
        }
      }
    } catch (error) {
      reply = `Something went wrong: ${error instanceof Error ? error.message : "unknown"}`
    }

    setStreaming("")
    setBusy(false)
    setTurns((t) => [
      ...t,
      {
        id: `local-reply-${Date.now()}`,
        role: "assistant",
        content: reply,
        author: "Orchestration Agent",
      },
    ])
    requestAnimationFrame(scrollToLatest)

    // Pull fresh server state so edited fields and history reflect the change.
    if (changed) router.refresh()
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Ask the orchestration agent</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div
          ref={threadRef}
          data-testid="chat-thread"
          className="flex max-h-104 flex-1 flex-col gap-2 overflow-y-auto"
        >
          {turns.length === 0 && !streaming ? (
            <p className="text-sm text-muted-foreground">
              Ask about this work item, or tell the agent to change it — try
              &ldquo;set priority to high&rdquo;.
            </p>
          ) : null}

          {turns.map((turn) => (
            <div
              key={turn.id}
              data-testid={`chat-${turn.role}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                turn.role === "assistant"
                  ? "bg-muted"
                  : "ml-6 border bg-background"
              )}
            >
              <span className="mb-0.5 block text-xs text-muted-foreground">
                {turn.author}
              </span>
              <span className="whitespace-pre-wrap">{turn.content}</span>
            </div>
          ))}

          {toolNotes.map((note) => (
            <p
              key={note}
              data-testid="chat-tool-note"
              className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground"
            >
              <Wrench className="size-3 shrink-0" />
              {note}
            </p>
          ))}

          {streaming ? (
            <div
              data-testid="chat-streaming"
              className="rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <span className="mb-0.5 block text-xs text-muted-foreground">
                Orchestration Agent
              </span>
              <span className="whitespace-pre-wrap">{streaming}</span>
            </div>
          ) : null}

          {busy && !streaming ? (
            <p className="px-1 text-sm text-muted-foreground">Thinking...</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Textarea
            id="chat-input"
            rows={2}
            placeholder="Ask a question, or ask for a change"
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="self-end"
            onClick={send}
            disabled={busy || !input.trim()}
          >
            <Send className="size-4" />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
