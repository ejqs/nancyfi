# Clients

Nancyfi is **web first**. Native shells (Electron, Capacitor) are out of scope until the kernel and sheets are stable in the browser.

Related: [offline-first](./offline-first-and-crdt.md), [responsive UI](./responsive.md), work [NAN-40](https://linear.app/nancyfi/issue/NAN-40/nested-spreadsheet-sheets-entryparentid-tanstack-table).

## Host vs kernel

| Layer | Lives in | Next.js? |
| --- | --- | --- |
| Budget Automerge kernel (types, mutations, balances, schedule, payday prepare) | `features/budgets/*.ts` (not `components/`) | No |
| Nested sheet row models (Recurring / Debts / Payday) | `features/budgets/sheets.ts` | No |
| TanStack Table UI | `features/budgets/components/nested-sheet.tsx` | React only — no Next imports |
| App router, Better Auth, control-plane actions | `app/`, `features/budgets/actions.ts`, `schema/` | Yes |

A later PWA or desktop host should import `sheets.ts` + `mutations.ts` the same way the Next app does. Do not put `next/link`, `next/navigation`, or server actions behind those kernel entrypoints.

## Default surfaces

The signed-in budget workspace is three nested sheets:

1. **Recurring** — income, subscription, and allocation Plans; expand for generated Entries.
2. **Debts** — repayment Plans; remaining/paid derived from posted liability history.
3. **Payday** — grouping Entry `payday:${date}:parent` with nested proposed children; confirm-to-post.

Settings keep people, invites, account hierarchy, one-off transactions, and advanced primitives.
