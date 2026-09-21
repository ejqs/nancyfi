# Responsive UI

## Goal

Nancyfi is a **responsive website**. One codebase adapts to desktop, tablet, and mobile. Native apps are out of scope for now.

## Requirements

1. Primary flows (open budget, edit, invite) usable on phone-width viewports.
2. Touch targets and typography sized for mobile without breaking dense desktop use.
3. No separate “mobile site”; layout and navigation respond to viewport.
4. Offline / sync indicators remain visible on small screens.

## Design notes

- **Product chrome** follows [Linear-inspired UI](./ui-linear-inspired.md) (sidebar + grouped lists, row anatomy, kinds vs labels).
- **Motion:** prefer [React Bits Micro](../conventions/react-bits-micro.md) when a catalog item matches (e.g. `SwipeRow` for mobile list actions).
- Prefer progressive disclosure: simple default screens; advanced controls when needed (aligns with product vision).
- Avoid packing secondary marketing or metadata into the first viewport of promotional pages; product UI can be denser where the job is editing money.
- Test at least three widths: phone (~390), tablet (~768), desktop (~1280).

## Navigation (resolved)

- Primary budget jobs are **Sheets**, **Payday**, **Recurring**, and
  **Transactions**. Sheets is the first nested TanStack grid (Catalog folders +
  Debts purchase → repayment Entries). Account/category setup, People, advanced
  data, and budget configuration live in grouped Settings.
- **Desktop:** one persistent left sidebar (`AppShell`) lists budgets and the
  four primary jobs. Do not repeat the same destinations as content tabs.
- **Mobile:** that sidebar becomes a drawer opened from the sticky header.
  Do not render a second horizontally clipped section strip; sync status stays
  in the header.
- Hard-coded primary jobs bind later to Lenses
  ([NAN-20](https://linear.app/nancyfi/issue/NAN-20/lenses-and-displayprofiles-household-default-personal)).

## Open decisions

- Whether desktop uses a persistent sidebar for budget list — **yes** (shipped default).
- Bottom nav vs drawer on mobile — **drawer** shipped; bottom nav may revisit after usage.

## Task forms

- Start from a user job (Expense / Income / Transfer; Salary / Bill or
  subscription / Debt repayment / Savings), not an Account, Entry, or Plan
  editor.
- On phone widths, focused task forms use the full content width and reveal
  cadence/end-condition fields only when relevant.
- Kernel kinds, posting direction, lifecycle status, and occurrence count stay
  out of the default flow. Advanced primitive editors may exist in Settings.

Work: [NAN-31](https://linear.app/nancyfi/issue/NAN-31/simplify-core-money-flow-with-scenario-safe-tasks).
