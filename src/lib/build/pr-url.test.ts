import { describe, expect, it } from "vitest"

import { extractPullRequestUrl } from "@/lib/build/pr-url"

/**
 * The build runner scrapes this out of serialized session events, so the input
 * is unpredictable: prose, JSON, or an MCP tool result. Whatever it returns
 * becomes the pull-request link stored on the run and shown on the board.
 */

const URL = "https://github.com/RamblinGambler/conexus/pull/42"

describe("extractPullRequestUrl", () => {
  it("finds a bare URL", () => {
    expect(extractPullRequestUrl(URL)).toBe(URL)
  })

  it("finds a URL inside prose", () => {
    expect(
      extractPullRequestUrl(`Opened ${URL} with the changes you asked for.`)
    ).toBe(URL)
  })

  it("finds a URL inside serialized JSON", () => {
    const event = JSON.stringify({
      type: "mcp_tool_result",
      content: [{ type: "text", text: `created pull request: ${URL}` }],
    })
    expect(extractPullRequestUrl(event)).toBe(URL)
  })

  it("handles dots and hyphens in owner and repo names", () => {
    const url = "https://github.com/some-org.io/my.repo-name/pull/7"
    expect(extractPullRequestUrl(url)).toBe(url)
  })

  it("handles multi-digit pull request numbers", () => {
    const url = "https://github.com/o/r/pull/123456"
    expect(extractPullRequestUrl(url)).toBe(url)
  })

  it("returns the first match when several appear", () => {
    // A run opens one pull request; later mentions repeat it.
    const text = `first ${URL} then https://github.com/o/r/pull/99`
    expect(extractPullRequestUrl(text)).toBe(URL)
  })

  it("stops at the pull request number", () => {
    expect(
      extractPullRequestUrl("https://github.com/o/r/pull/42/files#diff-abc")
    ).toBe("https://github.com/o/r/pull/42")
  })

  it("returns null when there is no URL", () => {
    expect(extractPullRequestUrl("")).toBeNull()
    expect(extractPullRequestUrl("The build failed before opening a PR.")).toBeNull()
  })

  it("ignores near-misses", () => {
    for (const text of [
      "https://github.com/o/r/pulls/42", // wrong path segment
      "https://github.com/o/r/pull/", // no number
      "https://github.com/o/r/pull/abc", // non-numeric
      "https://gitlab.com/o/r/pull/42", // wrong host
      "https://github.com/o/issues/42", // not a pull request
    ]) {
      expect(extractPullRequestUrl(text)).toBeNull()
    }
  })

  it("does not carry state between calls", () => {
    // Guards against a `g` flag being added later, which would make `exec`
    // stateful and cause every other call to miss.
    expect(extractPullRequestUrl(URL)).toBe(URL)
    expect(extractPullRequestUrl(URL)).toBe(URL)
    expect(extractPullRequestUrl(URL)).toBe(URL)
  })
})
