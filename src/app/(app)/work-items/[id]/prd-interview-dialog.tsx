"use client"

import { Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  continueInterview,
  synthesizePrd,
} from "@/app/(app)/work-items/[id]/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { InterviewMessage, PrdDraft } from "@/lib/ai/schemas"

/**
 * The transcript lives in component state for the duration of the interview.
 * Persisted conversations arrive with the orchestration chat in milestone 4.
 */
export function PrdInterviewDialog({
  workItemId,
  onDraft,
}: {
  workItemId: string
  onDraft: (draft: PrdDraft) => void
}) {
  const [open, setOpen] = useState(false)
  const [transcript, setTranscript] = useState<InterviewMessage[]>([])
  const [answer, setAnswer] = useState("")
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)

  const started = transcript.length > 0

  function reset() {
    setTranscript([])
    setAnswer("")
    setComplete(false)
  }

  async function ask(nextTranscript: InterviewMessage[]) {
    setBusy(true)
    const result = await continueInterview(workItemId, nextTranscript)
    setBusy(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }

    setTranscript([
      ...nextTranscript,
      { role: "assistant", content: result.turn.message },
    ])
    if (result.turn.isComplete) setComplete(true)
  }

  async function start() {
    setOpen(true)
    if (!started) await ask([])
  }

  async function submitAnswer() {
    if (!answer.trim()) return
    const next: InterviewMessage[] = [
      ...transcript,
      { role: "user", content: answer.trim() },
    ]
    setAnswer("")
    await ask(next)
  }

  async function writeDraft() {
    setBusy(true)
    const result = await synthesizePrd(workItemId, transcript)
    setBusy(false)

    if ("error" in result) {
      toast.error(result.error)
      return
    }

    setOpen(false)
    reset()
    onDraft(result.draft)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" onClick={start}>
          <Sparkles className="size-4" />
          Build PRD
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Build the PRD</DialogTitle>
          <DialogDescription>
            Answer a few questions about this work item and we&apos;ll draft the
            PRD from your answers. You review it before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex flex-col gap-3 py-2"
          data-testid="interview-transcript"
        >
          {transcript.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                message.role === "assistant"
                  ? "bg-muted"
                  : "ml-6 border bg-background"
              )}
            >
              {message.content}
            </div>
          ))}

          {busy ? (
            <p className="px-3 text-sm text-muted-foreground">Thinking...</p>
          ) : null}
        </div>

        {!complete ? (
          <Textarea
            id="interview-answer"
            rows={3}
            placeholder="Your answer"
            value={answer}
            disabled={busy}
            onChange={(e) => setAnswer(e.target.value)}
          />
        ) : null}

        <DialogFooter>
          {complete ? (
            <Button type="button" onClick={writeDraft} disabled={busy}>
              {busy ? "Writing draft..." : "Write the PRD"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={writeDraft}
                disabled={busy || transcript.length === 0}
              >
                Finish early
              </Button>
              <Button
                type="button"
                onClick={submitAnswer}
                disabled={busy || !answer.trim()}
              >
                Answer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
