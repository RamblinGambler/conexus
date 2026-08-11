import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import type { z } from "zod"

const MODEL = "claude-opus-5"
const MAX_TOKENS = 16000

export const aiIsStubbed = !process.env.ANTHROPIC_API_KEY

/**
 * Generates JSON matching `schema`.
 *
 * Without ANTHROPIC_API_KEY the app falls back to `stub` in development so the
 * feature stays runnable and testable without a key — the same pattern
 * src/lib/resend.ts uses for email. In production a missing key is an error.
 */
export async function generate<T extends z.ZodType>({
  schema,
  system,
  prompt,
  stub,
}: {
  schema: T
  system: string
  prompt: string
  stub: z.infer<T>
}): Promise<z.infer<T>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ANTHROPIC_API_KEY is not set")
    }
    console.warn("[ai] ANTHROPIC_API_KEY not set — returning stub content")
    return stub
  }

  const client = new Anthropic()
  const message = await client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(schema) },
  })

  if (message.stop_reason === "refusal") {
    throw new Error("The model declined to generate this content.")
  }
  if (!message.parsed_output) {
    throw new Error("The model returned no usable content. Try again.")
  }

  return message.parsed_output
}
