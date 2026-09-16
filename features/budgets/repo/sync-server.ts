/**
 * Automerge sync peer: WebSocket + NodeFS.
 *
 * Clients (Chrome / Safari / Cursor) connect with WebSocketClientAdapter and
 * sync budget docs through this process.
 *
 * Local:
 *   bun run sync
 *
 * Railway: separate `automerge-sync` service; binds `PORT`, persists under
 * the volume mount (`RAILWAY_VOLUME_MOUNT_PATH` or `AUTOMERGE_SYNC_DATA`).
 *
 * Env:
 *   PORT / AUTOMERGE_SYNC_PORT  (Railway injects PORT; local default 3030)
 *   AUTOMERGE_SYNC_DATA         (default .data/automerge-sync; or volume path)
 *   RAILWAY_VOLUME_MOUNT_PATH   (preferred data root when a volume is attached)
 */
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

import { Repo, type PeerId } from "@automerge/automerge-repo"
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket"
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs"
import { WebSocketServer } from "ws"

function resolvePort(): number {
  const raw =
    process.env.PORT?.trim() ||
    process.env.AUTOMERGE_SYNC_PORT?.trim() ||
    "3030"
  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT / AUTOMERGE_SYNC_PORT: ${raw}`,
    )
  }
  return port
}

function resolveDataDir(): string {
  const volumeRoot = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim()
  if (volumeRoot) {
    return resolve(volumeRoot, "automerge-sync")
  }
  return resolve(
    process.env.AUTOMERGE_SYNC_DATA ?? ".data/automerge-sync",
  )
}

const port = resolvePort()
const dataDir = resolveDataDir()

mkdirSync(dataDir, { recursive: true })

const wss = new WebSocketServer({ port, host: "0.0.0.0" })
const adapter = new WebSocketServerAdapter(wss)

const repo = new Repo({
  peerId: "nancyfi-sync-server" as PeerId,
  // Persist on disk; do not announce every doc to every peer — clients request by id.
  sharePolicy: async () => false,
  network: [adapter],
  storage: new NodeFSStorageAdapter(dataDir),
})

wss.on("listening", () => {
  console.log(`[automerge-sync] listening on 0.0.0.0:${port}`)
  console.log(`[automerge-sync] data dir: ${dataDir}`)
  if (!process.env.RAILWAY_ENVIRONMENT) {
    console.log(
      `[automerge-sync] set NEXT_PUBLIC_AUTOMERGE_SYNC_URL=ws://127.0.0.1:${port}`,
    )
  }
})

wss.on("error", (err) => {
  console.error("[automerge-sync] websocket server error", err)
  process.exitCode = 1
})

async function shutdown(signal: string) {
  console.log(`[automerge-sync] ${signal}, shutting down…`)
  try {
    await repo.shutdown()
  } catch (err) {
    console.error("[automerge-sync] repo.shutdown failed", err)
  }
  await new Promise<void>((resolveClose) => {
    wss.close(() => resolveClose())
  })
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})
process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
