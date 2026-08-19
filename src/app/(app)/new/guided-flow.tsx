"use client"

import { ArrowLeft, Check, Hammer, Loader2, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { createWorkItem } from "@/app/(app)/board/actions"
import {
  applyGeneratedDraft,
  continueInterview,
  generateSpec,
  synthesizePrd,
  synthesizeRoadmap,
} from "@/app/(app)/work-items/[id]/actions"
import {
  linkRepository,
  startBuildRun,
} from "@/app/(app)/work-items/[id]/build-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { InterviewMessage } from "@/lib/ai/schemas"

type Step = "describe" | "interview" | "prd" | "spec" | "repository" | "build"

const STEPS: { id: Step; label: string }[] = [
  { id: "describe", label: "Describe" },
  { id: "interview", label: "Questions" },
  { id: "prd", label: "Requirements" },
  { id: "spec", label: "Spec" },
  { id: "repository", label: "Repository" },
  { id: "build", label: "Build" },
]

const PRD_FIELDS = [
  { name: "problemStatement", label: "Problem statement" },
  { name: "goals", label: "Goals" },
  { name: "inScope", label: "In scope" },
  { name: "outOfScope", label: "Out of scope" },
  { name: "successCriteria", label: "Success criteria" },
]

const SPEC_FIELDS = [
  { name: "technicalApproach", label: "Technical approach" },
  { name: "acceptanceCriteria", label: "Acceptance criteria" },
]

const NONE = "none"

type Draft = Record<string, string>

export function GuidedFlow({
  repositories,
  defaultRepositoryId,
}: {
  repositories: { id: string; name: string }[]
  defaultRepositoryId: string | null
}) {
  const router = useRouter()

  const [step, setStep] = useState<Step>("describe")
  const [busy, setBusy] = useState(false)
  const [workItemId, setWorkItemId] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")

  const [transcript, setTranscript] = useState<InterviewMessage[]>([])
  const [answer, setAnswer] = useState("")
  const [interviewDone, setInterviewDone] = useState(false)

  const [prdDraft, setPrdDraft] = useState<Draft>({})
  const [specDraft, setSpecDraft] = useState<Draft>({})
  const [repositoryId, setRepositoryId] = useState(defaultRepositoryId ?? NONE)
  const [specApplied, setSpecApplied] = useState(false)

  const stepIndex = STEPS.findIndex((s) => s.id === step)

  /**
   * Server actions infer an optional `error`, so narrowing leaves it as
   * `string | undefined` — take that shape rather than asserting at each site.
   */
  function fail(message: string | undefined) {
    toast.error(message ?? "Something went wrong")
    setBusy(false)
  }

  // ---------- step 1: describe ----------
  async function createAndContinue() {
    if (!title.trim()) return
    setBusy(true)

    const result = await createWorkItem({
      title: title.trim(),
      summary: summary.trim(),
      priority: "medium",
      ownerId: "",
    })
    if ("error" in result) return fail(result.error)

    setWorkItemId(result.id)
    const asked = await continueInterview(result.id, [])
    setBusy(false)

    if ("error" in asked) {
      toast.error(asked.error)
      setStep("prd")
      return
    }
    setTranscript([{ role: "assistant", content: asked.turn.message }])
    if (asked.turn.isComplete) setInterviewDone(true)
    setStep("interview")
  }

  // ---------- step 2: interview ----------
  async function submitAnswer() {
    if (!answer.trim() || !workItemId) return
    const next: InterviewMessage[] = [
      ...transcript,
      { role: "user", content: answer.trim() },
    ]
    setAnswer("")
    setTranscript(next)
    setBusy(true)

    const result = await continueInterview(workItemId, next)
    setBusy(false)
    if ("error" in result) return fail(result.error)

    setTranscript([...next, { role: "assistant", content: result.turn.message }])
    if (result.turn.isComplete) setInterviewDone(true)
  }

  /** Drafts the PRD and the roadmap from the same transcript. */
  async function draftRequirements() {
    if (!workItemId) return
    setBusy(true)

    const [prd, roadmap] = await Promise.all([
      synthesizePrd(workItemId, transcript),
      synthesizeRoadmap(workItemId, transcript),
    ])
    setBusy(false)

    if ("error" in prd) return fail(prd.error)
    setPrdDraft(prd.draft as unknown as Draft)

    // The roadmap is applied without review — it is derived context, not the
    // thing the operator came here to write, and it stays editable afterwards.
    if (!("error" in roadmap)) {
      await applyGeneratedDraft("roadmap", {
        workItemId,
        ...(roadmap.draft as unknown as Draft),
      } as never)
    }

    setStep("prd")
  }

  // ---------- step 3/4: review ----------
  async function applyPrd() {
    if (!workItemId) return
    setBusy(true)
    const result = await applyGeneratedDraft("prd", {
      workItemId,
      ...prdDraft,
    } as never)
    setBusy(false)
    if (result?.error) return fail(result.error)
    await draftSpec()
  }

  async function draftSpec() {
    if (!workItemId) return
    setBusy(true)
    const result = await generateSpec(workItemId)
    setBusy(false)
    if ("error" in result) return fail(result.error)
    setSpecDraft(result.draft as unknown as Draft)
    setStep("spec")
  }

  async function applySpec() {
    if (!workItemId) return
    setBusy(true)
    const result = await applyGeneratedDraft("spec", {
      workItemId,
      designNotes: "",
      ...specDraft,
    } as never)
    setBusy(false)
    if (result?.error) return fail(result.error)
    setSpecApplied(true)
    setStep("repository")
  }

  // ---------- step 5/6 ----------
  async function confirmRepository() {
    if (!workItemId) return
    setBusy(true)
    const result = await linkRepository(
      workItemId,
      repositoryId === NONE ? null : repositoryId
    )
    setBusy(false)
    if (result?.error) return fail(result.error)
    setStep("build")
  }

  async function build() {
    if (!workItemId) return
    setBusy(true)
    const result = await startBuildRun(workItemId)
    setBusy(false)
    if ("error" in result) return fail(result.error)
    router.push(`/work-items/${workItemId}`)
  }

  function finish() {
    if (workItemId) router.push(`/work-items/${workItemId}`)
    else router.push("/board")
  }

  const canBuild = specApplied && repositoryId !== NONE
  const blockedReason = !specApplied
    ? "This needs a spec before a build can run — you skipped that step."
    : repositoryId === NONE
      ? "This needs a linked repository before a build can run."
      : null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Start something new
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, i) => (
            <Badge
              key={s.id}
              data-testid={`step-${s.id}`}
              variant={
                i === stepIndex ? "default" : i < stepIndex ? "secondary" : "outline"
              }
              className={cn(i > stepIndex && "text-muted-foreground")}
            >
              {i < stepIndex ? <Check className="size-3" /> : null}
              {s.label}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        {step === "describe" ? (
          <>
            <CardHeader>
              <CardTitle>What do you want to build?</CardTitle>
              <CardDescription>
                One line is enough. Everything else gets drafted from here.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="flow-title">Title</FieldLabel>
                <Input
                  id="flow-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Bulk CSV import for contacts"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="flow-summary">In a sentence</FieldLabel>
                <Textarea
                  id="flow-summary"
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Sales ops retype contact lists by hand after every event."
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  data-testid="flow-next"
                  onClick={createAndContinue}
                  disabled={busy || !title.trim()}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {busy ? "Starting..." : "Continue"}
                </Button>
              </div>
            </CardContent>
          </>
        ) : null}

        {step === "interview" ? (
          <>
            <CardHeader>
              <CardTitle>A few questions</CardTitle>
              <CardDescription>
                Answer what you can. Skip whenever you have said enough.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div
                data-testid="flow-transcript"
                className="flex flex-col gap-2"
              >
                {transcript.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      m.role === "assistant"
                        ? "bg-muted"
                        : "ml-6 border bg-background"
                    )}
                  >
                    {m.content}
                  </div>
                ))}
                {busy ? (
                  <p className="px-1 text-sm text-muted-foreground">Thinking...</p>
                ) : null}
              </div>

              {!interviewDone ? (
                <Textarea
                  id="flow-answer"
                  rows={3}
                  value={answer}
                  disabled={busy}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your answer"
                />
              ) : null}

              <div className="flex justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep("describe")}
                  disabled={busy}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    data-testid="flow-skip"
                    onClick={draftRequirements}
                    disabled={busy}
                  >
                    {interviewDone ? "Draft it" : "Enough — draft it"}
                  </Button>
                  {!interviewDone ? (
                    <Button
                      data-testid="flow-answer-submit"
                      onClick={submitAnswer}
                      disabled={busy || !answer.trim()}
                    >
                      Answer
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </>
        ) : null}

        {step === "prd" || step === "spec" ? (
          <>
            <CardHeader>
              <CardTitle>
                {step === "prd" ? "Requirements" : "Technical spec"}
              </CardTitle>
              <CardDescription>
                Drafted for you. Edit anything before it is saved.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {(step === "prd" ? PRD_FIELDS : SPEC_FIELDS).map((field) => (
                <Field key={field.name}>
                  <FieldLabel htmlFor={`flow-${field.name}`}>
                    {field.label}
                  </FieldLabel>
                  <Textarea
                    id={`flow-${field.name}`}
                    rows={3}
                    value={
                      (step === "prd" ? prdDraft : specDraft)[field.name] ?? ""
                    }
                    onChange={(e) => {
                      const setter = step === "prd" ? setPrdDraft : setSpecDraft
                      setter((d) => ({ ...d, [field.name]: e.target.value }))
                    }}
                  />
                </Field>
              ))}

              <div className="flex justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep(step === "prd" ? "interview" : "prd")}
                  disabled={busy}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    data-testid="flow-skip"
                    onClick={() =>
                      step === "prd" ? draftSpec() : setStep("repository")
                    }
                    disabled={busy}
                  >
                    Skip
                  </Button>
                  <Button
                    data-testid="flow-next"
                    onClick={step === "prd" ? applyPrd : applySpec}
                    disabled={busy}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                    {busy ? "Working..." : "Looks good"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : null}

        {step === "repository" ? (
          <>
            <CardHeader>
              <CardTitle>Where should this be built?</CardTitle>
              <CardDescription>
                Pre-filled with your default repository.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="flow-repository">Repository</FieldLabel>
                <Select value={repositoryId} onValueChange={setRepositoryId}>
                  <SelectTrigger id="flow-repository" className="w-full">
                    <SelectValue placeholder="Not linked" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not linked</SelectItem>
                    {repositories.map((repo) => (
                      <SelectItem key={repo.id} value={repo.id}>
                        {repo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep("spec")}
                  disabled={busy}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button
                  data-testid="flow-next"
                  onClick={confirmRepository}
                  disabled={busy}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </>
        ) : null}

        {step === "build" ? (
          <>
            <CardHeader>
              <CardTitle>Ready to build</CardTitle>
              <CardDescription>
                {canBuild
                  ? "A coding agent will implement this and open a pull request."
                  : "You can still finish — this just won't start a build."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {blockedReason ? (
                <p
                  data-testid="flow-build-blocked"
                  className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                >
                  {blockedReason}
                </p>
              ) : null}

              <div className="flex justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setStep("repository")}
                  disabled={busy}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    data-testid="flow-finish"
                    onClick={finish}
                    disabled={busy}
                  >
                    Finish without building
                  </Button>
                  {canBuild ? (
                    <Button
                      data-testid="flow-build"
                      onClick={build}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Hammer className="size-4" />
                      )}
                      {busy ? "Starting..." : "Build it"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </>
        ) : null}
      </Card>

      {workItemId ? (
        <p className="text-center text-xs text-muted-foreground">
          <Sparkles className="mr-1 inline size-3" />
          Saved as you go — leaving now keeps everything on the board.
        </p>
      ) : null}
    </div>
  )
}
