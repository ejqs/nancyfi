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
- Prefer progressive disclosure: simple default screens; advanced controls when needed (aligns with product vision).
- Avoid packing secondary marketing or metadata into the first viewport of promotional pages; product UI can be denser where the job is editing money.
- Test at least three widths: phone (~390), tablet (~768), desktop (~1280).

## Open decisions

- Navigation pattern on mobile (bottom nav vs drawer vs top) — prefer Linear-like sidebar collapsing to drawer/bottom where needed.
- Whether desktop uses a persistent sidebar for budget list (**yes** as default per Linear-inspired shell).
