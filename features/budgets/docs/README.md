# Budgets (feature)

Feature-scoped docs for **budgets** — the core collaboration unit in Nancyfi.

System context: [product vision](../../../docs/product-vision.md), [multiplayer](../../../docs/architecture/multiplayer.md), [offline-first & CRDTs](../../../docs/architecture/offline-first-and-crdt.md), [data model index](../../../docs/architecture/data-model.md).

**Data model:** [data-model.md](./data-model.md) (Budget, Account, Entry, Plan / Plan templates, Money).  
**Automation:** [features/rules](../../rules/docs/README.md).  
**Views:** [Lenses and personalization](../../../docs/architecture/lenses-and-personalization.md) (household default + personal).

## Intent

A budget is the thing a person (or group) plans and tracks money against. One user may have many budgets. A budget can be shared via invites. Content is stored as **accounts**, balanced **entries**, and declarative **plans**; **rules** automate how plans and events produce proposed entries.

## App surfaces (shipped)

| Surface | Path / component |
| --- | --- |
| App shell (sidebar + sticky header) | `components/app-shell.tsx` — desktop sidebar, mobile drawer |
| Budget list + create | Dashboard (`BudgetListPanel`) — membership-backed |
| Open / rename / archive | `/budgets/[budgetId]` (`BudgetWorkspace` + settings panel) |
| Primary jobs | Home · Payday · Recurring · Transactions (one navigation control per viewport) |
| Grouped settings | Money & categories · People · Advanced data · Budget |
| Members + invites | Settings → People (`MembersPanel`; owner invite by email; Copy link; revoke / leave) |
| Accept invite | `/invites/[token]` (Sign out on email mismatch) |
| Account reset | Dashboard → **Reset account to 0** (`AccountResetPanel` + `resetUserAccountAction`) — archives sole-owned budgets, leaves the rest, clears local Automerge store |
| Transactions | Expense · Income · Transfer task form; dense transaction rows |
| Recurring | Salary · Bill/subscription · Debt repayment · Savings task form |
| Payday | Prepare occurrence, adjust actual salary, review, confirm |
| Advanced data | Primitive Accounts / Entries / Plans and templates |
| Local CRDT store | `BudgetRepoProvider` + `createBudgetInRepo` |
| Automerge sync (dev) | `bun run sync` + `NEXT_PUBLIC_AUTOMERGE_SYNC_URL` (WebSocket) |

Create flow: client imports schema-init bytes into Automerge Repo, then `createBudgetAction` registers catalog + owner membership. Rename updates CRDT `name` and catalog `budget.name`. Archive sets control-plane `status = archived` (owner only).

Accounts, Plans, and Entries mutate the local Automerge doc via draft-safe `apply*` helpers. Catalog Plan templates copy into `planTemplatesById` via `applySeedCatalogPlanTemplates`. Posted balances use `accountPostedBalanceMinor` / `listAccountBalances`.

Default creation uses scenario-safe task commands. Those commands atomically
create or validate the Accounts, Entries, Plans, and schedules needed for the
user's job. Primitive editors remain available under Advanced data; they are
not the default onboarding path.

## Requirements (feature)

### Must

1. Create, open, rename, and delete (or archive) a budget.
2. Store budget content in a form that can sync via Automerge as one document (or a clearly defined set of docs).
3. Work offline for local edits; merge when peers sync.
4. List budgets the current user can access.

### Should

1. Sensible empty state for a new budget (initialize schema once — see Automerge [modeling data](https://automerge.org/docs/cookbook/modeling-data/)).
2. Show membership / who has access at a glance.
3. Normal flows do not require Account-kind, posting-direction, lifecycle
   status, or occurrence-count decisions.
4. Incomplete legacy scenario data is visibly repairable and never presented
   as a valid debt/subscription result.

### Could

1. Rich-text notes on the budget ([ProseMirror + Automerge](https://automerge.org/docs/cookbook/rich-text-prosemirror-react/)).
2. Templates for common budgeting styles without locking users into one method.

## Open decisions

- Posting sign convention, holiday calendars, and auto-post policy — see [data-model.md](./data-model.md).
- Hard delete of Automerge docs (archive on control plane is the shipped path).
- Whether contributors can invite (owners only today) — see [multiplayer](../../../docs/architecture/multiplayer.md).

## Resolved

- **Budgets list** is derived from control-plane `budget_membership` records (not a separate Automerge root doc).
- **Archive** sets `budget.status = archived` on the control plane (owner only). CRDT content is retained locally; no tombstone delete yet.
- **Invites** — email link → `/invites/[token]`; always `contributor`; owners invite; revoke/leave on control plane (see multiplayer).

## Related docs

- [data-model.md](./data-model.md) — Automerge document shape
- `requirements.md` — expand acceptance criteria (later)
- `ux.md` — responsive flows for create / edit / share (later)
