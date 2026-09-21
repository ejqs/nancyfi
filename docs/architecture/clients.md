# Clients — Next.js now, other hosts later

Nancyfi **ships as a responsive website** first ([product vision](../product-vision.md), [responsive](./responsive.md)). Architecture must still allow a later **PWA**, **Electron** window, or **Capacitor** wrap of the same DOM client. Native store builds and a React Native rewrite are **out of scope** until Linear says otherwise.

## Split

| Next.js may own | Must stay host-agnostic |
| --- | --- |
| Auth cookies, `/invites/[token]`, RSC marketing, catalog/membership | Budget Automerge document, `apply*` mutations, integer money, schedule |
| App shell routes in `app/` | TanStack Table row models (`parentId` → `getSubRows`), expand state |
| | Sync adapters as pluggable (IndexedDB, WebSocket, BroadcastChannel) |

**Must not:** Server Actions as the only Automerge write path for nested cells; `next/link` inside sheet/mutation modules.

Shipped (NAN-42): `features/budgets/sheets.ts`, `mutations.ts`, and `entry-tree.ts` import without Next.js. `NestedSheetTable` is a client React module any DOM host can mount.

Work: [NAN-42](https://linear.app/nancyfi/issue/NAN-42/first-slice-tanstack-nested-grid-entryparentid) (first slice) · [NAN-40](https://linear.app/nancyfi/issue/NAN-40/nested-spreadsheet-sheets-entryparentid-tanstack-table) (full sheets pivot).
