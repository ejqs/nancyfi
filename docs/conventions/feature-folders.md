# Feature folders

## Why

Organize by **business capability**, not by technical layer.

Technical folders (`components/`, `hooks/`, `validators/` across the whole app) scatter one use case across many places. Feature folders keep related code and docs together so cohesion stays high.

Reference: [Feature Folders — Kamil Grzybek](https://www.kamilgrzybek.com/blog/posts/feature-folders). Related framing: [feature-oriented structure talk](https://www.youtube.com/watch?v=xyxrB2Aa7KE).

## Rule

| If the doc/code… | Put it… |
| --- | --- |
| Affects the whole system (vision, CRDT strategy, responsive rules, auth cross-cuts) | `docs/` at repo root |
| Belongs to one feature / use case | `features/<feature>/…` including `features/<feature>/docs/` |

## Layout

```text
docs/                          # system-wide design & requirements
schema/                        # Drizzle table schemas (app-wide DB)
  auth-schema.ts               # Better Auth generated tables
  budget.ts                    # Budget control-plane tables
  index.ts                     # Combined re-exports for migrations / DB client
features/
  budgets/
    docs/                      # budgets feature + data-model
    db/                        # feature DB helpers (queries), not table schemas
    …
  rules/
    docs/                      # event-driven custom logic
    …
  mcp/
    docs/                      # MCP tools for user-owned AI / email updates
    …
```
A feature folder may contain UI, domain logic, and docs side by side. Prefer copying a feature folder as a template when adding a similar capability.

**Drizzle schemas** live in root `schema/` — not under `features/` — because tables and FKs are app-wide (migrations, auth ↔ feature catalogs). Feature folders may keep query helpers under `features/<feature>/db/`.

## Doc naming inside a feature

Suggested files (add only when needed):

- `README.md` — feature overview + links
- `requirements.md` — feature must/should
- `data-model.md` — Automerge / domain shape for this feature
- `ux.md` — screens and flows for this feature

## Do not

- Duplicate system architecture into every feature; link to `docs/architecture/` instead.
- Create empty technical mega-folders that cut across unrelated features.
- Put Drizzle table definitions under `features/` — use root `schema/` instead.
