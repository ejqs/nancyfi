# Offline-first & CRDTs

## Goal

Treat the user’s **local copy** of budget data as primary. Sync when a connection exists. Concurrent edits must merge automatically.

Nancyfi targets [Automerge](https://automerge.org/docs/hello/) as the CRDT foundation: immutable document snapshots, automatic merge of concurrent changes, and network-agnostic sync.

**Agent requirement:** before any Automerge-related code or sync change, consult the full Automerge LLM reference — [https://automerge.org/llms-full.txt](https://automerge.org/llms-full.txt) — not training-data memory. Enforced by `.cursor/rules/automerge.mdc`.

## Design principles (from Automerge)

- **Network-agnostic** — sync over WebSocket, other transports, or even out-of-band file exchange; Automerge does not dictate the network.
- **Immutable state** — each change yields a new document snapshot (fits React-style UIs).
- **Automatic merging** — CRDT conflict resolution; no central lock required for concurrent edits.
- **Local-first** — cloud is optional for availability/sync, not the only source of truth.

## Document modeling

Guidance from [Modeling Data](https://automerge.org/docs/cookbook/modeling-data/):

| Decision | Nancyfi direction |
| --- | --- |
| Granularity | Prefer a **budget** as the main collaboration / sync document (unit of work between people). Avoid thousands of tiny docs unless measured need appears. |
| Schema init | Initialize schema carefully so peers share ancestry; prefer one initial change (or hard-coded init bytes) over independent empty `change()` on every device. |
| Versioning | Schema upgrades must be safe under concurrent migration; hard-coded migration changes are the recommended pattern if/when versions ship. |
| Performance | Documents keep history; measure with real workloads before truncating history. |

## Rich text (optional path)

If notes or descriptions need collaborative rich text, use Automerge’s ProseMirror integration ([React cookbook](https://automerge.org/docs/cookbook/rich-text-prosemirror-react/)). Keep rich text behind a clear field in the budget document; do not force a rich editor for every string.

## Shipped adapters (local + sync)

| Layer | Adapter |
| --- | --- |
| Browser storage | IndexedDB (`nancyfi-automerge`) |
| Same-browser tabs | BroadcastChannel |
| Cross-browser / devices | WebSocket client → Automerge sync peer (NodeFS) |

### Local sync server

```bash
# Terminal 1
bun run sync

# Terminal 2 — ensure .env.local has:
# NEXT_PUBLIC_AUTOMERGE_SYNC_URL=ws://127.0.0.1:3030
bun run dev
```

1. Open the budget in the browser that already has it (e.g. Chrome) so it pushes to the sync server.
2. Open the same budget URL in Safari / Cursor browser — it should load via sync.

Env: `AUTOMERGE_SYNC_PORT`, `AUTOMERGE_SYNC_DATA`, `NEXT_PUBLIC_AUTOMERGE_SYNC_URL` (see `.env.example`). Work: [NAN-30](https://linear.app/nancyfi/issue/NAN-30/automerge-websocket-sync-server-cross-browser).

### Production sync server (Railway)

Service `automerge-sync` in the nancyfi Railway project:

- Start: `bun run sync` (`features/budgets/repo/sync-server.ts`)
- Binds Railway `PORT` (falls back to `AUTOMERGE_SYNC_PORT` locally)
- Persists under the attached volume (`RAILWAY_VOLUME_MOUNT_PATH/automerge-sync`)
- Public URL → set on the web app as `NEXT_PUBLIC_AUTOMERGE_SYNC_URL=wss://…` (rebuild required; `NEXT_PUBLIC_*` is build-time)
- **Existing budgets:** open once on the device that already has IndexedDB data after sync is configured — the app nudges an empty Automerge change so the sync server receives the doc. New budgets created while connected upload automatically.

Work: [NAN-32](https://linear.app/nancyfi/issue/NAN-32/deploy-automerge-sync-server-on-railway).

## Open decisions

- Auth / encryption boundaries relative to CRDT payloads (v1 sync is unauthenticated).
- What lives in Automerge vs relational/auth systems (accounts, invites metadata, billing).
