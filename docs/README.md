# Nancyfi docs

Design documents and requirements for the app.

## Where docs live

| Scope | Location |
| --- | --- |
| Whole system (product, architecture, cross-cutting rules) | `docs/` (this folder) |
| One feature / use case | `features/<feature>/docs/` |

Prefer **feature folders** over technical folders when a doc is about one business capability. Put validators, handlers, UI, and docs for that capability together under the same feature. See [Feature folders](https://www.kamilgrzybek.com/blog/posts/feature-folders) and [conventions/feature-folders.md](./conventions/feature-folders.md).

## Source of truth

| Kind | Source |
| --- | --- |
| Design (vision, requirements, data model, scenarios) | `docs/` and `features/*/docs/` |
| Work to do (tasks, status, assignees) | **[Linear — Nancyfi](https://linear.app/nancyfi)** |

Do not maintain a parallel task list in markdown. When work is discovered in docs or chat, create or update a Linear issue.

**Before implementing:** read the relevant docs *and* the Linear issue. If the request, docs, and Linear disagree, clarify or update docs/Linear so they agree — then code. Keep issue descriptions and docs synced as work progresses.

## Index

### Product

- [Product vision](./product-vision.md) — simple yet flexible budgeting
- [Requirements](./requirements.md) — must-have system requirements

### Design scenarios

- [Scenario catalog](./scenarios/README.md) — behavioral goals that drive primitives and data models
- [Payday, subscriptions, and debt reimbursement](./scenarios/payday-subscriptions-and-debt.md)

### Architecture (system-wide)

- [Offline-first & CRDTs](./architecture/offline-first-and-crdt.md) — local-first Automerge; sync auth; future Keyhive/ARK ([NAN-38](https://linear.app/nancyfi/issue/NAN-38/eventually-automerge-keyhive-ark-e2e-crypto-acl-when-stable))
- [Data model](./architecture/data-model.md) — primitives index; detail in feature docs
- [Lenses & personalization](./architecture/lenses-and-personalization.md) — per-user views vs shared ledger
- [Public / guest share links](./architecture/public-share-links.md) — scoped view & limited guest actions (eventually)
- [Multiplayer & sharing](./architecture/multiplayer.md)
- [Responsive UI](./architecture/responsive.md)
- [UI: Linear-inspired product chrome](./architecture/ui-linear-inspired.md) — list/shell patterns for signed-in UI
- [MCP & email-driven updates](./architecture/mcp-and-email-updates.md) — brief; details in feature docs

### Conventions

- [Feature folders](./conventions/feature-folders.md)
- [Git (branches + commits)](./conventions/git.md) — [Conventional Branch](https://conventionalbranch.org/) + [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

### Feature docs

- [Budgets](../features/budgets/docs/README.md) — [data model](../features/budgets/docs/data-model.md) (Accounts, Entries, Plans)
- [Rules](../features/rules/docs/README.md)
- [MCP](../features/mcp/docs/README.md)
