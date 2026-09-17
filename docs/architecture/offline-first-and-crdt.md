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
# Terminal 1 — requires AUTOMERGE_SYNC_JWT_SECRET in the environment
bun run sync

# Terminal 2 — ensure .env.local has:
# NEXT_PUBLIC_AUTOMERGE_SYNC_URL=ws://127.0.0.1:3030
# AUTOMERGE_SYNC_JWT_SECRET=<same secret as sync process>
bun run dev
```

1. Sign in, then open the budget in the browser that already has it (e.g. Chrome) so it pushes to the sync server.
2. Open the same budget URL in Safari / Cursor browser — it should load via sync.

Env: `AUTOMERGE_SYNC_PORT`, `AUTOMERGE_SYNC_DATA`, `AUTOMERGE_SYNC_JWT_SECRET`, `NEXT_PUBLIC_AUTOMERGE_SYNC_URL` (see `.env.example`). Work: [NAN-30](https://linear.app/nancyfi/issue/NAN-30/automerge-websocket-sync-server-cross-browser).

### Production sync server (Railway)

Service `automerge-sync` in the nancyfi Railway project:

- Start: `bun run sync` (`features/budgets/repo/sync-server.ts`)
- Binds Railway `PORT` (falls back to `AUTOMERGE_SYNC_PORT` locally)
- Persists under the attached volume (`RAILWAY_VOLUME_MOUNT_PATH/automerge-sync`)
- Public URL → set on the web app as `NEXT_PUBLIC_AUTOMERGE_SYNC_URL=wss://…` (rebuild required; `NEXT_PUBLIC_*` is build-time)
- **Auth:** set the same `AUTOMERGE_SYNC_JWT_SECRET` on the web app service and `automerge-sync` (see [Sync auth](#sync-auth-nan-33))
- **Existing budgets:** open once on the device that already has IndexedDB data after sync is configured — the app nudges an empty Automerge change so the sync server receives the doc. New budgets created while connected upload automatically.

Work: [NAN-32](https://linear.app/nancyfi/issue/NAN-32/deploy-automerge-sync-server-on-railway).

### Sync auth (NAN-33)

Production `wss://` is not an open relay. Sync connections require a short-lived JWT minted by the Next control plane after a Better Auth session check.

| Piece | Behavior |
| --- | --- |
| Mint | `getSyncTokenAction` — membership `automergeUrl`s → JWT `docs[]` + client `peerId` (~15m TTL) |
| Connect | Browser `WebSocketClientAdapter` uses `?token=` (browser WS cannot set headers) |
| Verify | Sync peer validates JWT on HTTP upgrade (`noServer`); rejects unauthenticated upgrades |
| ACL | Repo `shareConfig.access` allows only document ids listed in the JWT for that `peerId` |
| Refresh | Client refreshes before expiry; re-issues after budget create / invite accept |

**Crypto decision (v1):** TLS in transit + server-side membership ACL. End-to-end / Keyhive is deferred until stable — see [Future — Keyhive / ARK](#future--keyhive--ark).

Work: [NAN-33](https://linear.app/nancyfi/issue/NAN-33/authenticate-automerge-sync-public-wss-is-unauthenticated).

### Future — Keyhive / ARK

**Eventually** adopt [Automerge Repo Keyhive (ARK)](https://automerge.org/docs/keyhive/ark-api-guide/) for E2E encryption and cryptographic document ACL. Package is still **alpha** — track readiness in [NAN-38](https://linear.app/nancyfi/issue/NAN-38/eventually-automerge-keyhive-ark-e2e-crypto-acl-when-stable). Do not implement until stable.

| Layer | v1 (now) | With Keyhive (later) |
| --- | --- | --- |
| Transport | JWT on `wss` upgrade | JWT (or successor) can remain; Keyhive signs/verifies peer traffic |
| Server sees | Plain CRDT bytes (membership-gated) | Ciphertext; sync server ideally `relay` only |
| Product roles | Postgres `owner` / `contributor` | Unchanged control plane; Keyhive grants map from invites |
| Doc ids | Unprotected Automerge URLs | `create2` + keyhive ids; migrate via `isUnprotectedDoc` |
| Peer id | Opaque string in JWT (`nf-…`) | ARK verifying-key peer id (+ suffix); JWT still treats as opaque |
| Storage | IndexedDB `nancyfi-automerge` | Separate adapter for keyhive state (`nancyfi-keyhive` reserved) |

**Compatibility rules for current work** (so Keyhive can land without a rewrite):

1. Keep control-plane membership as product authority — never authorize roles from the CRDT alone.
2. Treat sync JWT `peerId` as opaque (do not assume the `nf-` prefix forever).
3. Keep the sync peer a **byte relay** (no reading budget plaintext for business logic).
4. Keep document storage separable from a future keyhive storage database.
5. When iterating budget doc **root** keys, skip `__automerge-repo-keyhive__*` (see `features/budgets/repo/keyhive-compat.ts`).
6. Prefer `repo.import` / find-by-URL patterns that still work for unprotected docs during migration.

## Open decisions

- What lives in Automerge vs relational/auth systems (accounts, invites metadata, billing).
- Keyhive adoption timing — gated on ARK leaving alpha ([NAN-38](https://linear.app/nancyfi/issue/NAN-38/eventually-automerge-keyhive-ark-e2e-crypto-acl-when-stable)).
