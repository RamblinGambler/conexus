import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

/**
 * Symmetric encryption for GitHub access tokens at rest.
 *
 * These tokens can push to a customer's repositories, so storing them as
 * plaintext columns is not acceptable. The key is derived from AUTH_SECRET,
 * which means anyone who can read the environment can still decrypt them —
 * this raises the bar against database-only exposure (a dump, a backup, a
 * read-only replica), it does not hide the token from the server itself.
 */

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function key() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is required to encrypt secrets")
  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(plaintext: string) {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".")
}

export function decryptSecret(payload: string) {
  const [iv, tag, data] = payload.split(".")
  if (!iv || !tag || !data) throw new Error("Malformed encrypted value")

  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(iv, "base64url")
  )
  decipher.setAuthTag(Buffer.from(tag, "base64url"))

  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
