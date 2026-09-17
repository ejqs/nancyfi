/**
 * Automerge sync peer: WebSocket + NodeFS + membership-scoped JWT auth (NAN-33).
 *
 * Clients (Chrome / Safari / Cursor) connect with WebSocketClientAdapter and
 * sync budget docs through this process. Connections must present a short-lived
 * JWT (`?token=`) minted by the Next control plane for the peer’s allowlisted
 * document ids.
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
 *   AUTOMERGE_SYNC_JWT_SECRET   (shared with the Next app; required)
 */
import { createServer } from "node:http"
import { mkdirSync } from "node:fs"
import { resolve } from "node:path"

import {
  Repo,
  type DocumentId,
  type PeerId,
} from "@automerge/automerge-repo"
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket"
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs"
import { WebSocketServer } from "ws"

import { SYNC_SERVER_PEER_ID } from "./sync-constants"
import {
  documentIdAllowed,
  extractTokenFromUpgradeUrl,
  getSyncJwtSecretFromEnv,
  verifySyncToken,
  type SyncTokenClaims,
} from "./sync-token"

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

function rejectUpgrade(
  socket: { write: (chunk: string) => void; destroy: () => void },
  status: number,
  message: string,
) {
  socket.write(
    `HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`,
  )
  socket.destroy()
}

const port = resolvePort()
const dataDir = resolveDataDir()
const jwtSecret = getSyncJwtSecretFromEnv()

mkdirSync(dataDir, { recursive: true })

/** peerId (from JWT / join) → allowlisted document ids */
const peerAllowlist = new Map<PeerId, Set<DocumentId>>()
/** Monotonic generation so a stale socket close does not clear a newer JWT. */
const peerAllowlistGeneration = new Map<PeerId, number>()

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" })
  res.end("nancyfi automerge-sync\n")
})

const wss = new WebSocketServer({ noServer: true })
const adapter = new WebSocketServerAdapter(wss)

httpServer.on("upgrade", (request, socket, head) => {
  const token = extractTokenFromUpgradeUrl(request.url)
  if (!token) {
    rejectUpgrade(socket, 401, "Unauthorized")
    return
  }

  void verifySyncToken(token, jwtSecret)
    .then((claims: SyncTokenClaims) => {
      const generation =
        (peerAllowlistGeneration.get(claims.peerId) ?? 0) + 1
      peerAllowlistGeneration.set(claims.peerId, generation)
      peerAllowlist.set(claims.peerId, new Set(claims.docs))
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.once("close", () => {
          if (peerAllowlistGeneration.get(claims.peerId) === generation) {
            peerAllowlist.delete(claims.peerId)
            peerAllowlistGeneration.delete(claims.peerId)
          }
        })
        wss.emit("connection", ws, request)
      })
    })
    .catch((err) => {
      console.warn(
        "[automerge-sync] upgrade rejected:",
        err instanceof Error ? err.message : err,
      )
      rejectUpgrade(socket, 401, "Unauthorized")
    })
})

const repo = new Repo({
  peerId: SYNC_SERVER_PEER_ID as PeerId,
  // Do not announce every doc; only sync docs the peer’s JWT allowlists.
  shareConfig: {
    announce: async () => false,
    access: async (peerId, documentId) => {
      const allowed = peerAllowlist.get(peerId)
      if (!allowed) return false
      return documentIdAllowed(allowed, documentId)
    },
  },
  network: [adapter],
  storage: new NodeFSStorageAdapter(dataDir),
})

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`[automerge-sync] listening on 0.0.0.0:${port}`)
  console.log(`[automerge-sync] data dir: ${dataDir}`)
  console.log("[automerge-sync] auth: JWT required (?token=)")
  if (!process.env.RAILWAY_ENVIRONMENT) {
    console.log(
      `[automerge-sync] set NEXT_PUBLIC_AUTOMERGE_SYNC_URL=ws://127.0.0.1:${port}`,
    )
  }
})

httpServer.on("error", (err) => {
  console.error("[automerge-sync] http server error", err)
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
    wss.close(() => {
      httpServer.close(() => resolveClose())
    })
  })
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})
process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
