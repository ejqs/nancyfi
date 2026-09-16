import { describe, expect, test } from "bun:test"

import { deriveSyncPhase } from "./sync-status"

describe("deriveSyncPhase", () => {
  test("is offline when the browser is offline", () => {
    expect(
      deriveSyncPhase({
        online: false,
        syncConfigured: true,
        peerCount: 1,
        syncServerConnected: true,
      }),
    ).toBe("offline")
  })

  test("is syncing while configured remote sync has no sync-server peer", () => {
    expect(
      deriveSyncPhase({
        online: true,
        syncConfigured: true,
        peerCount: 0,
        syncServerConnected: false,
      }),
    ).toBe("syncing")
  })

  test("BroadcastChannel peers alone do not count as Synced", () => {
    expect(
      deriveSyncPhase({
        online: true,
        syncConfigured: true,
        peerCount: 2,
        syncServerConnected: false,
      }),
    ).toBe("syncing")
  })

  test("settles online when the sync server peer is connected", () => {
    expect(
      deriveSyncPhase({
        online: true,
        syncConfigured: true,
        peerCount: 1,
        syncServerConnected: true,
      }),
    ).toBe("online")
  })

  test("local-only repositories are ready without a peer", () => {
    expect(
      deriveSyncPhase({
        online: true,
        syncConfigured: false,
        peerCount: 0,
        syncServerConnected: false,
      }),
    ).toBe("online")
  })
})
