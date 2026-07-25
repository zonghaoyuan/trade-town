# Compact Header and Replay Controls Design

## Goal

Keep Create ME and the deterministic Panda replay controls readable and
operable at every responsive breakpoint. Compact layouts must not duplicate the
ME label, and they must not remove play/pause or replay speed.

## Current Failure

The compact Create ME button retains the JSX text `+ Create ME` while CSS also
generates `ME` through `::after`. In flex layouts the hidden anonymous text
node still affects spacing, so the visible `+` and generated `ME` do not align
consistently.

At widths up to 1100px, `.pixel-replay-status-controls` is set to
`display: none`. This removes previous day, play/pause, next day, speed, and
loop instead of adapting them.

Measured header action width ranges from roughly 210px at 390px viewport width
to 458px at 768–1024px. Adding replay controls to the existing row would
reintroduce overlap.

## Create ME Markup

Replace generated compact content with explicit semantic spans:

- a `+` symbol;
- a full `Create ME` label;
- a compact `ME` label.

Desktop shows the symbol and full label. Compact layouts show the symbol and
compact label. The button remains an inline flex container in every state.
When an existing character avatar is present, only the avatar is rendered and
the text labels do not participate in layout.

No responsive label is generated with `::before` or `::after`.

## Responsive Replay Controls

Keep the current full ReplayStatus controls above 1100px.

At 1100px and below, the header becomes a two-level compact header:

1. The first row contains product identity and compact global actions.
2. The second row contains a responsive replay control bar.

The compact replay bar always shows:

- current replay day;
- play or pause;
- replay speed;
- a More disclosure.

The More disclosure contains:

- previous day;
- next day;
- loop toggle.

The compact bar is rendered only when the deterministic replay controller is
available. LLM replay keeps its existing status-only presentation because it
does not expose local replay controls.

## Low-Height Layout

On low-height landscape screens, the replay bar remains operable without adding
a permanent second header row. It uses the compact one-row header treatment:

- nonessential brand copy is reduced;
- compact global actions remain icon-sized;
- replay day, play/pause, speed, and More occupy the remaining header space.

This preserves the map's existing top safe inset instead of reducing the map to
an unusable strip.

## State and Accessibility

Extract the existing controller buttons into a reusable replay control
component so desktop and compact presentations invoke the same callbacks.

- Play/pause keeps its dynamic accessible label.
- Speed retains the native select and its `Replay speed` label.
- More uses a native disclosure or an equivalent button with
  `aria-expanded` and an associated menu region.
- Previous and next retain their disabled states at the replay boundaries.
- Loop remains a labeled checkbox.
- Escape and outside interaction close the More menu when a custom popover is
  used.

## Responsive Header Actions

The compact action treatment extends through 1100px:

- Create ME displays `+ ME`;
- Help uses its compact `?` presentation where the HUD provides a text Help
  action;
- the view switch keeps a short readable label;
- Injective connection status uses its icon and connected indicator.

This frees room for the product name and replay controls while preserving every
action.

## Testing

Extend the Playwright responsive suite to assert:

- Create ME has exactly one visible `+` and one visible `ME` in compact mode;
- no generated ME pseudo-content exists;
- play/pause and speed are visible at 390, 640, 768, and 1024px;
- the More disclosure exposes previous, next, and loop;
- replay controls remain usable in overview and immersive modes;
- 640/641 and 1100/1101 transitions have no document overflow or header
  overlap;
- full controls remain inline above 1100px.

Run responsive tests, unit tests, lint, and production build after the change.

## Acceptance Criteria

- Compact Create ME renders as a stable, centered `+ ME`.
- Play/pause and speed never disappear when a deterministic controller exists.
- Previous, next, and loop remain reachable through More at compact widths.
- The header does not overlap or create horizontal document overflow.
- Low-height landscape retains the approved map usability behavior.
