/**
 * Membership-scoped sync JWTs for Automerge WebSocket auth (NAN-33).
 *
 * Minted by the Next control plane after Better Auth session + membership lookup.
 * Verified by the sync peer on HTTP upgrade (no Postgres on the sync service).
 *
 * Crypto posture (v1): TLS + server-side ACL (not E2E / Keyhive).
 * `peerId` in the JWT is an **opaque** string — today `nf-<uuid>`; later Automerge
 * Keyhive/ARK peer ids (verifying-key based) must fit the same field without
 * assuming the `nf-` prefix ([NAN-38](https://linear.app/nancyfi/issue/NAN-38)).
 */
import {
  interpretAsDocumentId,
  isValidAutomergeUrl,
  isValidDocumentId,
  parseAutomergeUrl,
  type DocumentId,
  type PeerId,
} from "@automerge/automerge-repo"
import { SignJWT, jwtVerify, errors as JoseErrors } from "jose"

export const SYNC_TOKEN_TTL_SECONDS = 15 * 60
/** Refresh a bit before expiry so reconnects stay authenticated. */
export const SYNC_TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000
export const SYNC_TOKEN_QUERY_PARAM = "token"

const JWT_ALG = "HS256"
const JWT_ISSUER = "nancyfi-sync"
const JWT_AUDIENCE = "automerge-sync"

export type SyncTokenClaims = {
  /** Better Auth user id */
  sub: string
  /** Repo peer id the client must use for this connection */
  peerId: PeerId
  /** Allowlisted Automerge document ids (no `automerge:` prefix) */
  docs: DocumentId[]
  exp: number
  iat: number
}

export type MintSyncTokenInput = {
  userId: string
  peerId: string
  /** Membership automerge URLs (or bare document ids). */
  automergeUrls: string[]
  secret: string
  /** Override TTL for tests. */
  ttlSeconds?: number
}

export type MintSyncTokenResult = {
  token: string
  peerId: PeerId
  documentIds: DocumentId[]
  expiresAt: number
}

function encodeSecret(secret: string): Uint8Array {
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "AUTOMERGE_SYNC_JWT_SECRET must be set (at least 16 characters)",
    )
  }
  return new TextEncoder().encode(secret)
}

/** Normalize automerge:… URLs or bare ids to DocumentId. */
export function toSyncDocumentId(urlOrId: string): DocumentId {
  const trimmed = urlOrId.trim()
  if (!trimmed) {
    throw new Error("Empty automerge url/id")
  }
  if (isValidDocumentId(trimmed)) {
    return trimmed
  }
  if (isValidAutomergeUrl(trimmed)) {
    return parseAutomergeUrl(trimmed).documentId
  }
  return interpretAsDocumentId(trimmed as DocumentId)
}

export function documentIdAllowed(
  allowlist: Iterable<string>,
  documentId: string | undefined,
): boolean {
  if (!documentId) return false
  let normalized: DocumentId
  try {
    normalized = toSyncDocumentId(documentId)
  } catch {
    return false
  }
  for (const entry of allowlist) {
    try {
      if (toSyncDocumentId(entry) === normalized) return true
    } catch {
      // skip malformed allowlist entries
    }
  }
  return false
}

export async function mintSyncToken(
  input: MintSyncTokenInput,
): Promise<MintSyncTokenResult> {
  const peerId = input.peerId.trim() as PeerId
  if (!peerId) throw new Error("peerId is required")

  const documentIds = [
    ...new Set(input.automergeUrls.map((url) => toSyncDocumentId(url))),
  ]
  const ttl = input.ttlSeconds ?? SYNC_TOKEN_TTL_SECONDS
  const secret = encodeSecret(input.secret)
  const expiresAt = Math.floor(Date.now() / 1000) + ttl

  const token = await new SignJWT({
    peerId,
    docs: documentIds,
  })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(input.userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secret)

  return { token, peerId, documentIds, expiresAt }
}

export async function verifySyncToken(
  token: string,
  secret: string,
): Promise<SyncTokenClaims> {
  const key = encodeSecret(secret)
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: [JWT_ALG],
    })

    const sub = payload.sub
    const peerId = payload.peerId
    const docs = payload.docs
    if (typeof sub !== "string" || !sub) {
      throw new Error("Sync token missing subject")
    }
    if (typeof peerId !== "string" || !peerId) {
      throw new Error("Sync token missing peerId")
    }
    if (!Array.isArray(docs) || !docs.every((d) => typeof d === "string")) {
      throw new Error("Sync token missing docs allowlist")
    }
    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
      throw new Error("Sync token missing exp/iat")
    }

    return {
      sub,
      peerId: peerId as PeerId,
      docs: docs.map((d) => toSyncDocumentId(d)),
      exp: payload.exp,
      iat: payload.iat,
    }
  } catch (err) {
    if (err instanceof JoseErrors.JOSEError) {
      throw new Error(`Invalid sync token: ${err.code}`)
    }
    throw err
  }
}

export function getSyncJwtSecretFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = env.AUTOMERGE_SYNC_JWT_SECRET?.trim()
  if (!secret) {
    throw new Error("AUTOMERGE_SYNC_JWT_SECRET is not set")
  }
  return secret
}

/** Append `?token=` / `&token=` to a ws(s) URL. */
export function syncUrlWithToken(baseUrl: string, token: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set(SYNC_TOKEN_QUERY_PARAM, token)
  return url.toString()
}

export function extractTokenFromUpgradeUrl(
  requestUrl: string | undefined,
): string | null {
  if (!requestUrl) return null
  try {
    const url = new URL(requestUrl, "http://automerge-sync.local")
    const token = url.searchParams.get(SYNC_TOKEN_QUERY_PARAM)?.trim()
    return token || null
  } catch {
    return null
  }
}
