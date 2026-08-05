import { Resend } from "resend"

const apiKey = process.env.RESEND_API_KEY

/** Where links in emails point. Set `NEXTAUTH_URL` for anything but local dev. */
function appUrl(path: string) {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  )
  return `${base}${path}`
}

async function send(to: string, subject: string, text: string) {
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set")
    }
    // Logged in full rather than summarised so the unconfigured path is still
    // inspectable — this is what the milestone's email checks read.
    console.warn(
      `[resend] RESEND_API_KEY not set — would email ${to}\nSubject: ${subject}\n${text}`
    )
    return
  }

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to,
    subject,
    text,
  })
}

/**
 * Tells the operator a build finished, since nobody was watching it.
 *
 * Failures are the caller's to swallow: the queue stamps `notifiedAt` whether
 * or not this succeeds, so a broken mail config costs one lost email rather
 * than a run that is re-notified on every tick.
 */
export async function sendBuildFinishedEmail(opts: {
  to: string
  workItemId: string
  workItemTitle: string
  succeeded: boolean
  pullRequestUrl: string | null
  outputSummary: string | null
}) {
  const verb = opts.succeeded ? "succeeded" : "failed"
  const subject = `Build ${verb}: ${opts.workItemTitle}`

  const body = [
    opts.succeeded
      ? `The build for "${opts.workItemTitle}" finished and opened a pull request.`
      : `The build for "${opts.workItemTitle}" did not finish.`,
    "",
    opts.pullRequestUrl ? `Pull request: ${opts.pullRequestUrl}` : null,
    `Work item: ${appUrl("/work-items/" + opts.workItemId)}`,
    "",
    opts.outputSummary ? `---\n${opts.outputSummary.slice(0, 2000)}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n")

  await send(opts.to, subject, body)
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set")
    }
    console.warn(
      `[resend] RESEND_API_KEY not set — password reset link for ${to}: ${resetUrl}`
    )
    return
  }

  const resend = new Resend(apiKey)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to,
    subject: "Reset your Conexus password",
    text: [
      "Someone requested a password reset for your Conexus account.",
      "",
      `Reset your password: ${resetUrl}`,
      "",
      "This link expires in 1 hour. If you didn't request this, you can ignore this email.",
    ].join("\n"),
  })
}
