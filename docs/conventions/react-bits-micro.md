# React Bits Micro

**Whenever a UI control, gesture, or feedback already exists in [React Bits Micro](https://reactbits.dev/c/micro), use that component.** Do not invent a parallel motion or gesture.

This is a standing rule for future UI work ([NAN-41](https://linear.app/nancyfi/issue/NAN-41/prefer-react-bits-micro-for-ui-interactions)). Existing screens stay as-is until the next change that can adopt a Micro component.

Related: [Linear-inspired product chrome](../architecture/ui-linear-inspired.md) (structure, density, keyboard). Agent rule: `.cursor/rules/react-bits-micro.mdc`.

## Source of truth

| Kind | URL |
| --- | --- |
| Catalog (browse first) | [https://reactbits.dev/c/micro](https://reactbits.dev/c/micro) |
| Component page | `https://reactbits.dev/micro/<kebab-name>` (e.g. `/micro/status-mark`) |
| Install (this repo) | `npx shadcn@latest add @react-bits/<PascalName>-TS-TW` |
| Registry JSON | `https://reactbits.dev/r/<PascalName>-TS-TW.json` |
| Library-wide LLM index | [https://reactbits.dev/llms.txt](https://reactbits.dev/llms.txt) — Micro may be missing; the catalog page wins |

**Variant for Nancyfi:** TypeScript + Tailwind (`-TS-TW`). Do not install JS or plain-CSS variants.

The official `llms.txt` is organized as Text / Animations / Components / Backgrounds. **Micro is a separate category.** Consult the catalog and the component page, not training-data memory of older React Bits sections.

## How this fits Linear-inspired chrome

Linear’s **structure** stays: sidebar + dense rows, settings rows, keyboard-first, quiet color.

Micro supplies the **interaction** when one matches: switches, swipe rows, hold-to-confirm, status glyphs, toasts, OTP slots, number scrubbing, and similar.

| Keep from Linear docs | Take from Micro |
| --- | --- |
| Layout, density, row anatomy, settings groups | Motion, springs, drag/flick, in-place status morphs |
| Command menu + shortcuts for every mutation | Pointer/touch feel on the same action |
| Semantic tokens, near-monochrome chrome | Restyle Micro demo colors to those tokens |

Do **not** pull React Bits **Backgrounds**, 3D galleries, or landing-page shaders into signed-in product chrome. Those may appear on marketing pages only. Prefer Micro over the older Components / Animations / Text catalogs when both could apply.

## Before coding UI

1. Open [https://reactbits.dev/c/micro](https://reactbits.dev/c/micro) (or the matching component page) and check the catalog below.
2. If a Micro item covers the control or feedback, **install it** and compose it. Do not hand-roll the same spring, swipe, hold, or status morph.
3. After `shadcn add`, read the installed file. Swap icons to `lucide-react` if the source uses Hugeicons. Replace hardcoded hex with semantic tokens (`currentColor`, `bg-primary`, `text-muted-foreground`, status colors already used in product).
4. Keep keyboard paths. A Micro gesture is extra, not a replacement for `⌘/Ctrl K` or a focusable control.
5. Honor `prefers-reduced-motion` (Micro components that use Motion already check `useReducedMotion`; do not strip that).

## Install

`components.json` already maps `@react-bits` → `https://reactbits.dev/r/{name}.json`.

```bash
npx shadcn@latest add @react-bits/StatusMark-TS-TW
# equivalent:
npx shadcn@latest add https://reactbits.dev/r/StatusMark-TS-TW
```

CLI identifiers are PascalCase. Page URLs are kebab-case.

Review added files (shadcn skill): aliases, composition, icon library, no leftover demo copy.

## When to use which (Nancyfi)

Prefer these when the job matches. Skip items that would fight density or seriousness (see [Do not](#do-not)).

| Job | Micro | Docs |
| --- | --- | --- |
| OTP / verify-email / 2FA code | `CodeSlots` | [code-slots](https://reactbits.dev/micro/code-slots) |
| List row swipe actions (mobile) | `SwipeRow` | [swipe-row](https://reactbits.dev/micro/swipe-row) |
| In-place status / progress glyph | `StatusMark` | [status-mark](https://reactbits.dev/micro/status-mark) |
| Switch | `SquishSwitch` | [squish-switch](https://reactbits.dev/micro/squish-switch) |
| Checkbox + optional strike | `SpringCheck` | [spring-check](https://reactbits.dev/micro/spring-check) |
| Segmented control / view tabs | `RubberSegment` | [rubber-segment](https://reactbits.dev/micro/rubber-segment) |
| Radio chips | `JellyRadio` | [jelly-radio](https://reactbits.dev/micro/jelly-radio) |
| Select / dropdown | `GlideSelect` | [glide-select](https://reactbits.dev/micro/glide-select) |
| Hold-to-confirm (destructive) | `HoldButton` | [hold-button](https://reactbits.dev/micro/hold-button) |
| Slide-to-confirm (async) | `SlideCommit` | [slide-commit](https://reactbits.dev/micro/slide-commit) |
| Action + timed undo | `FuseButton` | [fuse-button](https://reactbits.dev/micro/fuse-button) |
| Number field you can drag-scrub | `ScrubField` | [scrub-field](https://reactbits.dev/micro/scrub-field) |
| Range slider | `WakeSlider` | [wake-slider](https://reactbits.dev/micro/wake-slider) |
| Toast / undo toast | `SwipeToast` | [swipe-toast](https://reactbits.dev/micro/swipe-toast) |
| Toolbar tooltip group | `WarmTooltip` | [warm-tooltip](https://reactbits.dev/micro/warm-tooltip) |
| Inline loader / long task | `LatticeLoader` | [lattice-loader](https://reactbits.dev/micro/lattice-loader) |
| Notify on/off pill | `BellToggle` | [bell-toggle](https://reactbits.dev/micro/bell-toggle) |
| Chat / command composer | `PromptBar` | [prompt-bar](https://reactbits.dev/micro/prompt-bar) |
| Fill / remaining gauge | `SloshGauge` | [slosh-gauge](https://reactbits.dev/micro/slosh-gauge) |
| Tool-call / sync chip | `CallChip` | [call-chip](https://reactbits.dev/micro/call-chip) |
| Tree / collapsible nav | `BranchedMenu` | [branched-menu](https://reactbits.dev/micro/branched-menu) |
| Folder picker / notes pop | `FolderFloat` | [folder-float](https://reactbits.dev/micro/folder-float) |
| Star rating | `PeekRating` | [peek-rating](https://reactbits.dev/micro/peek-rating) |
| Dial / knob | `CometDial` | [comet-dial](https://reactbits.dev/micro/comet-dial) |
| Send-with-pull-back | `SlingButton` | [sling-button](https://reactbits.dev/micro/sling-button) |
| Mic / dictation pill | `VoicePill` | [voice-pill](https://reactbits.dev/micro/voice-pill) |
| Reasoning / “thought for Ns” | `ThoughtLine` | [thought-line](https://reactbits.dev/micro/thought-line) |
| Media generate / refine frame | `RefineFrame` | [refine-frame](https://reactbits.dev/micro/refine-frame) |

Full catalog (including more playful items): [reactbits.dev/c/micro](https://reactbits.dev/c/micro).

## Do not

- Hand-roll swipe, hold-to-confirm, OTP slots, rubber segmented thumbs, or status morphs when Micro already ships them.
- Drop Micro into a screen in a way that replaces dense **rows** with card stacks, or hides keyboard/command-menu paths.
- Use `DodgeField` (pointer flees the control) on money, auth, or other high-stakes actions.
- Use `PulseHeart`, `FlipCard`, `TearTicket`, or `PaperCrumple` as default product-list or settings chrome. Landing/marketing only, and only when the metaphor fits.
- Install React Bits **Pro** (`@reactbits-pro/…`) without a license.
- Treat blog posts as newer than the catalog page when they disagree.
- Leave registry demo colors, Hugeicons, or `@/components/ui/...` aliases that do not match this repo.

## shadcn vs Micro

Keep shadcn for **layout and accessibility primitives**: `Button`, `Field` / `FieldGroup`, `Dialog`, `DropdownMenu`, `Input` (plain text), `Card` structure.

When the *interaction* is the point (animated switch, swipe row, hold confirm, OTP cascade, toast fuse), install the Micro component and theme it. Do not wrap a Micro control in a second, conflicting control.
