# MCP (feature)

Feature-scoped docs for Nancyfi’s **MCP** — the machine interface so a user’s own AI can update budgets without bank aggregation APIs.

System context: [product vision](../../../docs/product-vision.md) (brief mention), [offline-first & CRDTs](../../../docs/architecture/offline-first-and-crdt.md).

## Problem

Bank sync / open-banking aggregation is missing or weak in most countries. Building Nancyfi around aggregator APIs would exclude many users.

## Direction

1. Nancyfi exposes an **MCP** (tools the app understands: update accounts, post transactions, etc.).
2. The user connects **their own AI** to that MCP.
3. That AI reads the user’s **emails** (bank alerts, receipts, statements) and calls Nancyfi tools to keep accounts current.

Automation stays with the user; Nancyfi stays a budgeting system with a machine interface, not a bank connector.

## Priority

Lower than core budgeting, offline/CRDT, and multiplayer. Preferred alternative to traditional bank sync.

## Requirements (feature)

### Could (when prioritized)

1. Authenticated MCP tools scoped to budgets the caller may access.
2. Tools to update account balances and create/update transactions.
3. Safe interaction with CRDT documents (writes merge cleanly with human edits).

### Won’t (as this feature)

1. Hosted bank aggregation inside Nancyfi.
2. Nancyfi reading the user’s email directly (email access stays with the user’s AI).

## Open decisions

- Which MCP tools ship first (balances vs transactions vs categories).
- Auth / scopes for agents.
- Conflict rules when MCP writes meet concurrent human / CRDT edits.
- Tool naming and idempotency for email-driven updates.

## Related docs to add later

- `requirements.md` — acceptance criteria per tool
- `tools.md` — MCP tool surface
- `auth.md` — agent credentials and scopes
