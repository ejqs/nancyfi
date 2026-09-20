import { describe, expect, test } from "bun:test"

import {
  documentIdAllowed,
  extractTokenFromUpgradeUrl,
  mintSyncToken,
  syncUrlWithToken,
  toSyncDocumentId,
  verifySyncToken,
} from "./sync-token"

const SECRET = "test-sync-jwt-secret-32chars!!"

describe("sync-token", () => {
  test("normalizes automerge URLs to document ids", () => {
    // Valid-looking bs58 document id shape is not required for interpretAsDocumentId
    // when parsing full URLs — use mint round-trip for real ids.
    const id = toSyncDocumentId("automerge:4NMNnkMhL8jXrdJ9jamS58PAVdXu")
    expect(id).toBe("4NMNnkMhL8jXrdJ9jamS58PAVdXu")
    expect(documentIdAllowed([id], id)).toBe(true)
    expect(
      documentIdAllowed(
        ["automerge:4NMNnkMhL8jXrdJ9jamS58PAVdXu"],
        "4NMNnkMhL8jXrdJ9jamS58PAVdXu",
      ),
    ).toBe(true)
    expect(documentIdAllowed([id], "otherDocIdThatIsDifferent0001")).toBe(
      false,
    )
  })

  test("mints and verifies a membership-scoped token", async () => {
    const minted = await mintSyncToken({
      userId: "user-1",
      peerId: "peer-abc",
      automergeUrls: ["automerge:4NMNnkMhL8jXrdJ9jamS58PAVdXu"],
      secret: SECRET,
      ttlSeconds: 60,
    })

    expect(minted.token.length).toBeGreaterThan(20)
    expect(minted.peerId).toBe("peer-abc")
    expect(minted.documentIds).toEqual(["4NMNnkMhL8jXrdJ9jamS58PAVdXu"])

    const claims = await verifySyncToken(minted.token, SECRET)
    expect(claims.sub).toBe("user-1")
    expect(claims.peerId).toBe("peer-abc")
    expect(claims.docs).toEqual(["4NMNnkMhL8jXrdJ9jamS58PAVdXu"])
    expect(claims.exp).toBe(minted.expiresAt)
  })

  test("rejects tampered or wrong-secret tokens", async () => {
    const minted = await mintSyncToken({
      userId: "user-1",
      peerId: "peer-abc",
      automergeUrls: [],
      secret: SECRET,
    })

    await expect(verifySyncToken(minted.token, "wrong-secret-value!!")).rejects.toThrow()
    await expect(verifySyncToken(minted.token.slice(0, -4) + "xxxx", SECRET)).rejects.toThrow()
  })

  test("builds and parses token query on sync URL", () => {
    const withToken = syncUrlWithToken("ws://127.0.0.1:3030", "abc.def.ghi")
    expect(withToken).toContain("token=abc.def.ghi")
    expect(extractTokenFromUpgradeUrl("/?token=abc.def.ghi")).toBe("abc.def.ghi")
    expect(extractTokenFromUpgradeUrl("/")).toBeNull()
  })
})
