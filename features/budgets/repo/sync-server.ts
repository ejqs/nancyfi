/**
 * Dev Automerge sync peer: WebSocket + NodeFS.
 *
 * Clients (Chrome / Safari / Cursor) connect with WebSocketClientAdapter and
 * sync budget docs through this process. Start alongside Next:
 *
 *   bun run sync
 *
 * Env:
 *   AUTOMERGE_SYNC_PORT  (default 3030)
 *   AUTOMERGE_SYNC_DATA  (default .data/automerge-sync)
 */
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

import { Repo, type PeerId } from "@automerge/automerge-repo"
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket"
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs"
import { WebSocketServer } from "ws"

const port = Number(process.env.AUTOMERGE_SYNC_PORT ?? "3030")
const dataDir = resolve(
  process.env.AUTOMERGE_SYNC_DATA ?? ".data/automerge-sync",
)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid AUTOMERGE_SYNC_PORT: ${process.env.AUTOMERGE_SYNC_PORT}`)
}

mkdirSync(dataDir, { recursive: true })

const wss = new WebSocketServer({ port })
const adapter = new WebSocketServerAdapter(wss)

const repo = new Repo({
  peerId: "nancyfi-sync-server" as PeerId,
  // Persist on disk; do not announce every doc to every peer — clients request by id.
  sharePolicy: async () => false,
  network: [adapter],
  storage: new NodeFSStorageAdapter(dataDir),
})

wss.on("listening", () => {
  console.log(`[automerge-sync] listening on ws://127.0.0.1:${port}`)
  console.log(`[automerge-sync] data dir: ${dataDir}`)
  console.log(
    `[automerge-sync] set NEXT_PUBLIC_AUTOMERGE_SYNC_URL=ws://127.0.0.1:${port}`,
  )
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
