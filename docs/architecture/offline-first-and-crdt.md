# Offline-first & CRDTs

## Goal

Treat the user’s **local copy** of budget data as primary. Sync when a connection exists. Concurrent edits must merge automatically.

Nancyfi targets [Automerge](https://automerge.org/docs/hello/) as the CRDT foundation: immutable document snapshots, automatic merge of concurrent changes, and network-agnostic sync.

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

## Open decisions

- Exact Automerge Repo storage + network adapters for web (IndexedDB / sync server).
- Auth / encryption boundaries relative to CRDT payloads.
- What lives in Automerge vs relational/auth systems (accounts, invites metadata, billing).
