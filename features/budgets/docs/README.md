# Budgets (feature)

Feature-scoped docs for **budgets** — the core collaboration unit in Nancyfi.

System context: [product vision](../../../docs/product-vision.md), [multiplayer](../../../docs/architecture/multiplayer.md), [offline-first & CRDTs](../../../docs/architecture/offline-first-and-crdt.md), [data model index](../../../docs/architecture/data-model.md).

**Data model:** [data-model.md](./data-model.md) (Budget, Account, Entry, Plan, and Money).  
**Automation:** [features/rules](../../rules/docs/README.md).

## Intent

A budget is the thing a person (or group) plans and tracks money against. One user may have many budgets. A budget can be shared via invites. Content is stored as **accounts**, balanced **entries**, and declarative **plans**; **rules** automate how plans and events produce proposed entries.

## App surfaces (shipped)

| Surface | Path / component |
| --- | --- |
| Budget list + create | Dashboard (`BudgetListPanel`) — membership-backed |
| Open / rename / archive | `/budgets/[budgetId]` (`BudgetWorkspace`) |
| Local CRDT store | `BudgetRepoProvider` + `createBudgetInRepo` |

Create flow: client imports schema-init bytes into Automerge Repo, then `createBudgetAction` registers catalog + owner membership. Rename updates CRDT `name` and catalog `budget.name`. Archive sets control-plane `status = archived` (owner only).

## Requirements (feature)

### Must

1. Create, open, rename, and delete (or archive) a budget.
2. Store budget content in a form that can sync via Automerge as one document (or a clearly defined set of docs).
3. Work offline for local edits; merge when peers sync.
4. List budgets the current user can access.

### Should

1. Sensible empty state for a new budget (initialize schema once — see Automerge [modeling data](https://automerge.org/docs/cookbook/modeling-data/)).
2. Show membership / who has access at a glance.

### Could

1. Rich-text notes on the budget ([ProseMirror + Automerge](https://automerge.org/docs/cookbook/rich-text-prosemirror-react/)).
2. Templates for common budgeting styles without locking users into one method.

## Open decisions

- Invite UX and revoke/leave behavior — see [multiplayer](../../../docs/architecture/multiplayer.md).
- Posting sign convention, holiday calendars, and auto-post policy — see [data-model.md](./data-model.md).
- Hard delete of Automerge docs (archive on control plane is the shipped path).

## Resolved

- **Budgets list** is derived from control-plane `budget_membership` records (not a separate Automerge root doc).
- **Archive** sets `budget.status = archived` on the control plane (owner only). CRDT content is retained locally; no tombstone delete yet.

## Related docs

- [data-model.md](./data-model.md) — Automerge document shape
- `requirements.md` — expand acceptance criteria (later)
- `ux.md` — responsive flows for create / edit / share (later)
