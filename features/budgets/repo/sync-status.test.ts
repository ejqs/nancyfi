import { describe, expect, test } from "bun:test"

import { deriveSyncPhase } from "./sync-status"

describe("deriveSyncPhase", () => {
  test("is offline when the browser is offline", () => {
    expect(
      deriveSyncPhase({
        online: false,
        syncConfigured: true,
        peerCount: 1,
      }),
    ).toBe("offline")
  })

  test("is syncing while configured remote sync has no peer", () => {
    expect(
      deriveSyncPhase({
        online: true,
        syncConfigured: true,
        peerCount: 0,
      }),
    ).toBe("syncing")
  })

  test("settles online when a configured peer is connected", () => {
    expect(
      deriveSyncPhase({
        online: true,
        syncConfigured: true,
        peerCount: 1,
      }),
    ).toBe("online")
  })

  test("local-only repositories are ready without a peer", () => {
    expect(
      deriveSyncPhase({
        online: true,
        syncConfigured: false,
        peerCount: 0,
      }),
    ).toBe("online")
  })
})
