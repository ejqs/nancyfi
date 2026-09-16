# UI: Linear-inspired product chrome

**Product UI** (budget workspace, lists, boards, **settings**) should be heavily inspired by [Linear](https://linear.app)’s issue list, app shell, and Preferences. Marketing / landing pages may diverge for brand; once the user is signed in, prefer this language.

Related: [Responsive UI](./responsive.md), [Lenses](./lenses-and-personalization.md), work [NAN-17](https://linear.app/nancyfi/issue/NAN-17/responsive-app-shell-mobile-tablet-desktop) / [NAN-20](https://linear.app/nancyfi/issue/NAN-20/lenses-and-displayprofiles-household-default-personal).

## North star

Dense, calm, keyboard-friendly. One composition: **narrow sidebar + main list/board** (or settings detail). Status and category signal with **icons + small pills**, not cards stacked as a dashboard.

**Structure first, customize second:** ship a clear default skeleton (kinds, statuses, built-in Lenses, sensible prefs). Let people reshape chrome and taxonomy without forking the ledger — same idea as Linear’s fixed issue model + editable labels/templates/sidebar.

**Keyboard-first:** most navigation and mutations should be reachable without the mouse (Linear’s command menu + single-key / chord shortcuts). See [Keyboard & command menu](#keyboard--command-menu).

## Layout

| Linear pattern | Nancyfi mapping |
| --- | --- |
| Workspace / team sidebar | Budgets, inbox-like surfaces, settings |
| Breadcrumb + view tabs (Active / Backlog / All) | Surface switchers driven by **Lenses** (e.g. Proposed / Posted / All; Payday / Debt / Subscriptions) |
| Collapsible **group headers** with count + inline `+` | Group by status, account kind, Plan kind, labels, or payday |
| Single-line **rows** | Accounts, Entries, Plans — one row each |
| Filter + display options (top right) | Lens / DisplayProfile controls |

Prefer progressive disclosure: simple default list; filters and columns behind view options.

## Row anatomy (lists)

Left → right, keep secondary metadata muted:

1. Selection / drag (optional)
2. Priority or urgency affordance (optional)
3. Stable id or short code (muted), when useful
4. **Status icon** (proposed / posted / void; Plan active / paused / cancelled)
5. **Title** (primary)
6. **Pills**: labels, project-like badges (budget/account), comment/link counts
7. Assignee / member avatar when multiplayer matters
8. Date or amount (trailing)

Hairline separators or slight hover wash — not heavy cards for every row.

## Settings & setup (structure + customizability)

Mirror Linear Preferences: **grouped settings sidebar** + **main pane of setting rows** (title, short description, control on the right). Esc / “Back to app” returns to the workspace.

### Settings sidebar groups (informative)

| Group | Examples |
| --- | --- |
| **Personal** | Preferences, profile, notifications, security, DisplayProfile defaults, font/density |
| **Budget** (shared) | Members/invites, household default Lenses, soft label suggestions |
| **Money model** | Account hierarchy helpers, **Labels**, **Plan templates**, statuses if any |
| **Automation** | Rules catalog apply, MCP / email (later) |
| **Features** | Experimental toggles |

Split **personal** vs **budget-shared** clearly (same rule as Lenses: chrome can be private; money stays one set).

### Setting row pattern

Each preference is one horizontal row in a quiet rounded group:

- **Left:** bold label + one-line muted description  
- **Right:** dropdown, toggle, or “Customize” button  
- Sections titled lightly (“General”, “Interface”) — not a grid of cards  

Examples of customizability to expose (Linear analogues):

| Linear | Nancyfi |
| --- | --- |
| Default home view | Default Lens / home surface per user |
| App sidebar → Customize | Sidebar item visibility, order, badges |
| Issue Labels / Templates | Budget **labels** + **Plan templates** |
| Project Statuses | Entry/Plan status vocabulary stays kernel-small; extras via labels |
| Font size / theme | DisplayProfile + theme prefs |

### Product principle

1. **Defaults work out of the box** — empty budget still has Account kinds, proposed/posted, a few built-in Lenses.  
2. **Customize taxonomy and chrome** — labels, templates, sidebar, personal Lenses/DisplayProfiles.  
3. **Do not customize the ledger physics** — balancing postings, kernel kinds, void-not-delete stay fixed.  
4. Household defaults are **soft** (starting point); personal overrides never rewrite someone else’s view of money.

## Workspaces, labels, and managed taxonomies

Linear separates **containers**, **workflow buckets**, and **user taxonomies**. Nancyfi should feel the same in settings and pickers.

### Container hierarchy (Linear → Nancyfi)

| Linear | Nancyfi | Managed where |
| --- | --- | --- |
| **Workspace** | User’s Nancyfi account / org shell (profile, billing later, global prefs) | App-level settings (Workspace / Administration) |
| **Team** | **Budget** (collaboration + CRDT boundary) | Budget settings; list in app sidebar like “Your teams” |
| **Project** (optional grouping) | Soft grouping via **labels**, parent Accounts, or a future Lens board — not a second ledger | Budget “Money model” / Labels |
| **Issue** | **Entry** / **Plan** / **Account** row entities | Budget workspace lists |

Workspace settings screens (name, logo, timezone/region, default home view, members) follow Linear’s card sections: **header → rounded group → field label + control + muted help**. Immutable-at-create fields (e.g. region analogue) are labeled as such.

See [multiplayer](./multiplayer.md): membership/invites stay control-plane; money stays in the budget doc.

### Labels (and “tags”)

Treat **label** as the product word; “tag” is the same primitive (colored name + optional description/group). Do not ship two systems.

**Settings UI** (Linear Issue labels):

- Title + primary actions: **New label** (solid CTA), **New group** (secondary)
- Filter by name; optional view options
- Table/list rows: checkbox, **color dot**, name, description (inline placeholder), last applied, created, `⋯` menu
- Label **groups** organize the catalog (e.g. “Needs / Wants”, “Debt”, “FX”) without becoming Account kinds

**Scope:** labels are **budget-shared** by default (everyone sees the same Feature/Bug-style pills). Personal DisplayProfiles only choose whether/how to show them.

**Applied on:** Entries primarily; optionally Accounts and Plans. Filter/group in Lenses via `labels`.

### Statuses: fixed buckets, custom names inside

Linear Project statuses: fixed workflow stages (**Backlog / Planned / In Progress / Completed / Canceled**) each with `+` to add custom statuses *inside* the bucket.

Nancyfi analogue:

| Fixed bucket (kernel — not user-deletable) | Examples of soft names / presentation |
| --- | --- |
| Entry: `proposed` → `posted` → `void` | Display labels / icons via DisplayProfile; do not invent parallel money states |
| Plan: `active` \| `paused` \| `cancelled` \| `completed` | Template-facing names (“On hold”) map to kernel status |
| Account `kind` | Never user-extendable as new accounting kinds; use hierarchy + labels instead |

If we later need richer workflow (e.g. “for review” on guest ShareLinks), add **named statuses inside a fixed bucket** (or a dedicated review flag) — same Linear pattern — rather than open-ended status enums that break Rules.

Status settings UI: section per bucket, usage count under each status (“3 entries”), `+` within bucket only.

### Templates catalog

Same settings family as Labels: Plan templates (and later Rule/Lens templates) as a searchable list with New / groups, not buried in create modals only. Creating an entity **copies** template fields (inspectable), matching Plan template docs.

## Kinds vs labels (Linear analogy)

| Linear | Nancyfi |
| --- | --- |
| Issue type (Bug / Feature) | Kernel `kind` on Account / Plan (small fixed set; code branches here) |
| Labels / tags | Shared label catalog + `labels[]` on entities |
| Label groups | Label groups in budget settings |
| Project status *buckets* | Kernel Entry/Plan status (or review buckets later) |
| Custom status *within* bucket | Soft display name / extra named state inside bucket only |
| Issue templates | Plan templates |
| Custom views / filters | **Lenses** (household default + personal) |
| Display prefs | **DisplayProfiles** |
| Workspace / team settings | App workspace + per-budget settings |

Do **not** invent a separate Category entity for income/expense buckets — use Account hierarchy (`parentId`) plus labels. Do **not** grow kernel kinds for every user phrase; use templates + labels.

## Keyboard & command menu

Study target: Linear’s model ([Search](https://linear.app/docs/search), [Select issues](https://linear.app/docs/select-issues), command menu via `⌘/Ctrl K`). Nancyfi should feel the same: **if you forget a shortcut, open the command menu and type the action**.

### Layers (most → least specific)

| Layer | Linear | Nancyfi |
| --- | --- | --- |
| **1. Command menu** | `⌘/Ctrl K` — every action + jump targets; context-ranked | Same. Primary escape hatch for everything |
| **2. Global create / search** | `C` create issue; `/` workspace search | `C` create (context: Entry / Account / Plan / Budget); `/` search budgets, accounts, entries, plans, settings |
| **3. Go / Open chords** | `G` then letter (Inbox, My issues, Settings…); `O` then letter (open issue…) | `G` → surfaces (Budgets, Payday, Debt, Settings…); `O` → open recent Entry/Budget by id/title |
| **4. Selection + single keys** | `J`/`K` or ↑/↓ highlight; `X` select; `S` status; `P` priority; `L` label; `Esc` clear | Highlight rows; `X` multi-select; keys for status/post, void, labels, assign; `Esc` clears |
| **5. View-local find** | `⌘/Ctrl F` filter titles in current list | Same for current Lens / list |
| **6. Discoverability** | `?` shortcuts help; UI shows shortcut hints (e.g. Esc on Back) | Same — every menu item / settings back control can show its chord |

### Command menu rules (from Linear)

1. **Habit:** prefer `⌘/Ctrl K` before hunting in the UI; show the matching shortcut beside each result so muscle memory forms.
2. **Context-first ranking:** with an Entry selected, status/void/label/post actions float to the top; on a payday Lens, payday actions first; in Settings, settings commands first.
3. **Click opens the same menu:** pickers (status, label, account, member) should open the **same command UI** as the keyboard — not a one-off dropdown with different options.
4. **Groups + icons:** group by Navigate / Create / Selection / Settings; icons for skim.
5. **Typeahead scopes (optional Linear pattern):** prefixes like `i ` issues, `l ` labels, `p ` projects → Nancyfi: `e ` entries, `a ` accounts, `p ` plans, `b ` budgets, `l ` labels.
6. **Mobile:** long-press / FAB still reaches the same command list (Linear uses a dedicated open gesture).

### List interaction (from Linear select model)

- Default: **nothing selected**; highlight ≠ select.
- Move highlight with `J`/`K` or arrows; `Enter` opens detail; `X` toggles selection; `Shift`+move extends range; `⌘/Ctrl A` selects all **in the current filtered view**.
- Bulk actions: selection → `⌘/Ctrl K` or bottom bulk bar (post, void, add label).
- `Esc`: close menu → clear selection → blur, in that order.

### Starter shortcut map (informative — lock in implementation issue)

| Action | Shortcut |
| --- | --- |
| Command menu | `⌘/Ctrl K` |
| Shortcuts help | `?` |
| Create (contextual) | `C` |
| Create from template | `⌥/Alt C` |
| Workspace search | `/` |
| Find in current view | `⌘/Ctrl F` |
| Go budgets / home | `G` then `B` |
| Go settings | `G` then `S` |
| Go payday / debt / subscriptions Lens | `G` then `P` / `D` / `U` (pick letters when shipping) |
| Open recent entry/budget | `O` then `E` / `B` |
| Highlight move | `J` / `K` |
| Select / multi | `X` / `Shift`+move |
| Post / confirm proposed | (e.g. `⌘/Ctrl Enter` on detail, or `S` status picker) |
| Labels | `L` |
| Back / clear | `Esc` |

Show shortcut chips in command results and on settings “Back to app”. Never bind shortcuts that steal browser/OS chords without `⌘/Ctrl`, except well-known Linear-like singles when focus is not in a text field.

### Implementation notes (keyboard)

- Central **keymap + command registry** (id, title, section, when-clause, run, optional chord). UI buttons call `run(commandId)` — no parallel mouse-only code paths.
- Disable single-key chords while focus is in inputs/contenteditable (except `Esc`, and `⌘/Ctrl` combos).
- Work: file under Foundation when scheduling shell (related [NAN-17](https://linear.app/nancyfi/issue/NAN-17/responsive-app-shell-mobile-tablet-desktop)).

## Visual language

- **Quiet chrome:** near-monochrome surfaces; color only for status, labels, and money sign.
- **Subtle depth:** section headers slightly elevated; thin rules; soft radius on pills and active nav — not multi-layer card shadows.
- **Status icons** over text badges for proposed/posted/void (text still available for a11y).
- **Group headers:** chevron, icon, title, count, trailing `+` to add into that group.
- Dense desktop lists; same patterns collapse cleanly on mobile (see responsive.md).

Theme (light vs dark) is a product choice — Linear’s *structure* matters more than copying dark mode. Match whatever theme Nancyfi ships; keep the same density and hierarchy.

## Anti-patterns

- Dashboard of metric cards as the primary budget surface
- Card-per-Entry as the default list (cards OK for focused single-item detail)
- Rainbow pill clusters or emoji as primary category system
- Hiding status only in prose with no scanable icon/column
- Settings as a dump of forms without sidebar groups / row pattern
- Letting “customize” rewrite shared balances or invent private money truth
- Separate “tags” product beside labels
- User-defined Account/Plan kernel kinds or open-ended Entry statuses outside fixed buckets
- Mouse-only actions with no command-menu equivalent
- Silent shortcuts (no `?` help / no hint on command rows)

## Implementation notes

- Prefer shared list/row primitives in the app shell so Accounts, Entries, and Plans feel like one system.
- Prefer shared **settings row** primitives (label + description + control) for Preferences and budget setup.
- Prefer shared **catalog list** primitives for Labels and Plan templates (filter, New, groups, row + `⋯`).
- Prefer a shared **command palette** (`⌘/Ctrl K`) + keymap registry; pickers reuse it.
- Wire grouping and tabs to Lenses when [NAN-20](https://linear.app/nancyfi/issue/NAN-20/lenses-and-displayprofiles-household-default-personal) lands; until then, hard-code a Linear-like shell that can later bind to Lens configs.
- Budget setup (labels, templates, household Lens defaults) should feel like Linear’s Issues/Projects settings sections — structured catalogs, not freeform schema editors.
- App-level workspace settings (profile, members-at-workspace if any, billing later) stay separate from per-budget Money model settings.
