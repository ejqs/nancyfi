# Lenses and personalization

How members customize **look**, **derived views**, and **automation** without forking the shared ledger or locking collaborators into one budgeting method.

Design test: [payday, subscriptions, and debt reimbursement](../scenarios/payday-subscriptions-and-debt.md).  
Money truth: [data model](./data-model.md).  
Sharing boundary: [multiplayer](./multiplayer.md).  
Automation: [Rules](../../features/rules/docs/README.md).

## Problem

On a shared budget, people want different setups:

- How each Entry **looks** (row vs card, which fields, debt remaining on that charge).
- How debts are **organized** (pay off per Entry vs one rolled-up debt board).
- How payday **proposals** feel — without changing someone else’s methodology.

If presentation and rollups live inside shared `Entry` / `Account` rows, collaborators overwrite each other on CRDT merge, or Nancyfi forces one “correct” UI. If deduction math lives only in private custom code, balances drift from posted history.

## Three customization layers

| Layer | Changes posted money? | Default scope | Lives where |
| --- | --- | --- | --- |
| **DisplayProfile** — how Entries/Plans render | No | **Per user** | Personal prefs / private overlay (not unscoped in shared BudgetDoc) |
| **Lens** — filter, group, layout for a derived board | No (read-only derive) | **Household default** on the budget + **per-user** override/extra Lenses; shareable as template | Budget soft default + personal config; optional catalog publish |
| **Plan + Rule** — commitments and reactions | Yes (or proposes Entries) | **Budget-shared** when applied | Budget Automerge doc + Rule catalog |

```text
Shared BudgetDoc                 Personal (per user)
──────────────────────────────   ────────────────────────────────
Accounts, Entries, Plans         DisplayProfiles
rulesApplied, ruleRuns           Personal Lenses (override or add boards)
Household default Lens refs      Active Lens choice per surface
(soft; does not change money)
```

**Facts and Plans stay one set.** The budget may pin **household default Lenses** so new members and shared screens start aligned. Each member may **override** those defaults or add personal Lenses. They must not disagree on posted balances unless they post Entries.

## Primitives

### DisplayProfile

Maps shared Entry/Plan fields (and posting roles) to presentation: which columns, density, whether to show FX, remaining-on-this-debt, etc.

- Do **not** store CSS/layout as the only truth on every shared Entry.
- Optional shared **soft defaults** on the budget (“suggest this label pattern”) that each member can override locally.
- Optional data hints on Entries (`labels[]`, `iconKey`) are shared tags; each DisplayProfile decides whether to show them.

### Lens

A declarative query + layout over Accounts, Entries, and Plans. Lenses power the scenario’s required derived views (monthly %, payday checklist, burn, subscriptions, debt remaining) and custom boards.

**Resolution order** for a surface (e.g. debt board, payday checklist):

1. Member’s **personal** Lens for that surface, if set.
2. Else the budget’s **household default** Lens for that surface, if set.
3. Else a built-in product default.

Household/personal Lenses stay for members. **Public ShareLinks** may pin a Lens for outsiders (view or allowlisted actions) — see [Public / guest share links](./public-share-links.md). Guests do not edit arbitrary Lenses.

Example shape (informative):

```text
Lens "My debt board"
  scope: user | budget
  surface: debtBoard   // paydayChecklist | subscriptions | burn | …
  filter: accounts.kind == liability (or labels)
  groupBy: accountId | plan.kind
  columns: principal, paid, outstanding, nextDue  // all derived
  layout: cards | table | paydayChecklist
```

Lenses **never** store a second editable outstanding balance. Outstanding remains derived from posted postings (see scenario acceptance invariants).

### Plan + Rule (unchanged role)

- **Plan:** what should happen (salary, allocation, subscription, repayment, …; user templates for installment / owe-Mom).
- **Rule:** when/how to react (propose Entries, match deposits).
- Paying debt — including “pay off this Entry” — still creates a normal proposed/posted **Entry** with balanced postings against the liability Account. UI/Lens actions are shortcuts; they do not invent private balances.

Optional Entry link fields (e.g. payment targeting a principal Entry) stay inspectable data so Lenses and audits can explain allocation without custom-only state.

## Multiplayer force ladder

How hard each knob pushes collaborators:

1. **Personal DisplayProfiles + personal Lenses** — no force on others.
2. **Household default Lenses** — soft shared starting point; members can override per surface without forking money.
3. **Shared Plans** — shared commitments (we owe Mom ₱X twice monthly). Correct for real money intent.
4. **Shared `rulesApplied`** — shared automation everyone sees. Use sparingly; prefer personal “suggest” flows that create proposed Entries when that user runs them, if soft collaboration is enough.

**Share without lock-in:** publish a Lens or Rule to the catalog (`public` / `unlisted` / `private`, same visibility idea as Rules). Apply a template as a **household default** (budget) or a **personal** Lens.

## Storage rules

| Do | Don’t |
| --- | --- |
| Scope Lenses as `budget` (household default) or `user` (personal); DisplayProfiles stay per-user | Put unscoped personal UI state that overwrites every member’s chrome in the shared BudgetDoc |
| Resolve personal → household default → built-in | Force household default with no personal override |
| Derive debt boards from liability Accounts + Entries + Plans | Maintain a mutable “remaining debt” field per Lens |
| Let per-Entry payoff UI write payment Entries | Let a custom view silently rewrite posted history |
| Reuse Rule catalog patterns for shareable Lens templates | Treat sandboxed Rule JS as the only place amounts/cadence live |

## Scenario mapping

| Need | Layer |
| --- | --- |
| Payday checklist / % used / burn / subscriptions / debt remaining | Built-in or user Lenses over shared facts |
| Pay debt against one purchase Entry | Action → payment Entry (+ optional link); Lens shows remaining per Entry |
| Roll all debts into one custom board | Personal Lens; partner can use a different Lens |
| Cancel subscription, keep debt visible | Same records; subscription Lens filters `Plan.status`; debt Lens still includes liability |
| Partner keeps a simple list | Their DisplayProfile + personal Lens override; household default unchanged for others |
| New member opens debt board first time | Sees household default Lens until they set a personal one |

## Resolved

- **Household default + personal Lenses both exist.** Resolution: personal override → household default → built-in. Household defaults do not change posted money.

## Open decisions

1. Storage for personal overlays (and whether household default Lens defs live in BudgetDoc vs control plane): control-plane rows vs Automerge (shared soft config vs private doc) vs local-first sync later.
2. Who may edit household default Lenses (`owner` only vs any `contributor`).
3. Exact schema for payment→principal Entry links and Entry presentation hints.
4. Which built-in Lenses ship with an empty budget vs templates from the catalog.

Work: [NAN-20](https://linear.app/nancyfi/issue/NAN-20/lenses-and-displayprofiles-household-default-personal) (Foundation). ShareLinks that pin Lenses: [NAN-21](https://linear.app/nancyfi/issue/NAN-21/public-guest-share-links-view-limited-act).

## Related

- [Data model](./data-model.md)
- [Multiplayer](./multiplayer.md)
- [Budgets data model](../../features/budgets/docs/data-model.md)
- [Rules](../../features/rules/docs/README.md)
- [Scenario catalog](../scenarios/README.md)
