import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { decryptSecret, encryptSecret } from "@/lib/crypto"

/**
 * These cover the GitHub tokens stored in the `repository` table. A token that
 * silently fails to round-trip would break builds; one that decrypts after
 * tampering would defeat the point of authenticated encryption.
 *
 * `key()` reads AUTH_SECRET on every call, so the last test can unset it.
 */

const SECRET = "test-secret-not-used-anywhere-real"
const TOKEN = "ghp_exampleTokenValue0123456789"

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET
})

afterEach(() => {
  process.env.AUTH_SECRET = SECRET
})

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a token", () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN)
  })

  it("round-trips values that stress the encoding", () => {
    for (const value of ["a", "🔑 unicode ✓", "x".repeat(5000)]) {
      expect(decryptSecret(encryptSecret(value))).toBe(value)
    }
  })

  it("cannot round-trip an empty string", () => {
    // Encrypting "" yields an empty ciphertext segment, which decryptSecret's
    // emptiness check rejects as malformed. Documented rather than fixed: no
    // caller encrypts an empty token, and rejecting is the safe direction.
    expect(() => decryptSecret(encryptSecret(""))).toThrow(
      "Malformed encrypted value"
    )
  })

  it("produces a different ciphertext each time for the same plaintext", () => {
    // A random IV per call, so equal tokens are not recognisable as equal in
    // a database dump.
    const a = encryptSecret(TOKEN)
    const b = encryptSecret(TOKEN)
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe(decryptSecret(b))
  })

  it("emits three base64url parts: iv, tag, ciphertext", () => {
    const parts = encryptSecret(TOKEN).split(".")
    expect(parts).toHaveLength(3)
    for (const part of parts) expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  /**
   * Mutates the *first* character on purpose. base64url's final character can
   * carry bits that fall outside the decoded byte length, so changing it is not
   * guaranteed to change the plaintext — and a tamper test that decodes to the
   * same bytes proves nothing.
   */
  const tamper = (segment: string) =>
    (segment[0] === "A" ? "B" : "A") + segment.slice(1)

  it("rejects a tampered ciphertext", () => {
    const [iv, tag, data] = encryptSecret(TOKEN).split(".")
    expect(() => decryptSecret([iv, tag, tamper(data)].join("."))).toThrow()
  })

  it("rejects a tampered auth tag", () => {
    const [iv, tag, data] = encryptSecret(TOKEN).split(".")
    expect(() => decryptSecret([iv, tamper(tag), data].join("."))).toThrow()
  })

  it("rejects a tampered iv", () => {
    const [iv, tag, data] = encryptSecret(TOKEN).split(".")
    expect(() => decryptSecret([tamper(iv), tag, data].join("."))).toThrow()
  })

  it("rejects a malformed payload", () => {
    for (const bad of ["", "nodots", "only.two"]) {
      expect(() => decryptSecret(bad)).toThrow("Malformed encrypted value")
    }
  })

  it("will not decrypt with a different key", () => {
    const payload = encryptSecret(TOKEN)
    process.env.AUTH_SECRET = "a-completely-different-secret"
    expect(() => decryptSecret(payload)).toThrow()
  })

  it("refuses to operate without AUTH_SECRET", () => {
    delete process.env.AUTH_SECRET
    expect(() => encryptSecret(TOKEN)).toThrow(
      "AUTH_SECRET is required to encrypt secrets"
    )
  })
})
