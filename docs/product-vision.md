# Product vision

Nancyfi is a **budgeting website**.

Compared with other budgeting products, the goal is:

> Be as **simple** as possible, yet as **flexible** as possible.

## What that means

**Simple**

- Few concepts a person must learn to start
- Clear primary actions; no dashboard clutter by default
- Sensible defaults that work without configuration

**Flexible**

- Users can shape budgets to their life (categories, periods, sharing, notes) without fighting the tool
- Power stays available without being required up front
- Data model and UI should not force one “correct” budgeting method

## Product pillars

1. **Responsive** — one website that adapts to desktop, tablet, and mobile
2. **Offline-first** — the local copy of data is primary; sync when a network is available
3. **CRDT-backed** — concurrent edits merge cleanly without a single write lock
4. **Multiplayer** — many budgets per user; invite others into a budget

## Account updates without bank APIs

Traditional bank sync / aggregation is **low priority**. It is unavailable or unreliable in most countries, so Nancyfi should not depend on it.

Preferred direction: expose an **MCP** for the app (see [features/mcp/docs](../features/mcp/docs/README.md)). The user runs their **own AI**, which can read their emails (e.g. bank alerts, statements) and call Nancyfi’s MCP to update accounts and transactions. That keeps automation in the user’s control and works wherever email exists, not only where open banking does.

## Non-goals (for now)

These may change later; they are not the starting bar:

- Competing feature-for-feature with full personal-finance suites
- Native mobile apps (responsive web first)
- Built-in bank aggregation as a first-class, day-one product path (see MCP + email above instead)

## Success look

A person can open Nancyfi, create a budget, edit it offline, invite someone, and keep working without wondering where the “real” data lives. Later, their own AI can update balances from email via MCP without Nancyfi needing direct bank access.
