# Responsive Layout Hardening Design

## Goal

Make Trade Town remain operable across desktop, portrait mobile, and short
landscape viewports after the recent dashboard and immersive-mode changes.
Responsive success means that the map keeps a usable frame when it remains
visible, every panel and modal is reachable, and competing inspectors never
silently collapse one another.

## Scope

This change covers:

- immersive HUD drawers for Markets, Citizens, and Agent Talk;
- the in-map player conversation detail pane;
- Help and Create ME modal viewport constraints;
- compact header controls and Help reachability;
- HUD active and accessibility state;
- responsive Playwright regression coverage.

It does not change the town map, sprites, financial data, game simulation, or
the visual design language.

## Responsive Invariants

1. A visible map must keep a practical interaction area; it must not be reduced
   to a decorative strip.
2. A modal or inspector must fit within the dynamic viewport or provide its own
   scrollable body.
3. Each panel has one scroll owner. Headers and close controls remain visible
   while the content body scrolls.
4. Only one detail inspector may compete with the map at a time.
5. Layout changes near breakpoints must preserve the same capabilities and
   avoid a one-pixel usability cliff.

## Layout Strategy

Use an adaptive inspector with three modes:

- **Desktop and wide tablet:** the immersive HUD drawer is a right-side column.
  The map resizes into the remaining space through its existing ResizeObserver.
- **Portrait and sufficiently tall narrow screens:** keep the map above a
  bottom inspector. Calculate the inspector from available height while
  preserving a minimum map interaction area.
- **Short landscape and other low-height screens:** open the selected HUD panel
  as a viewport-contained full-screen inspector. The map is suspended from the
  visible layout until the inspector closes, then returns without losing the
  current town view.

Low-height behavior is selected by usable height rather than device identity.
The full-screen inspector is the deliberate fallback when showing both map and
panel would violate the map minimum.

## Inspector State Coordination

`TradeTownShell` remains the owner of HUD drawer state. The town render context
will expose whether an external HUD inspector is open. `Game` will consume that
state and clear its internal selected player detail when an external inspector
opens.

This establishes one explicit rule:

> Opening Markets, Citizens, or Agent Talk closes the in-map player
> conversation detail before the new inspector participates in layout.

Closing a HUD inspector restores the map but does not automatically reopen a
previous player conversation. This avoids hidden stale state and makes the
transition predictable.

## Scrolling and Modal Behavior

- HUD drawers use a fixed outer frame with `overflow: hidden`.
- Drawer content components use `min-height: 0`; their content body owns
  vertical scrolling.
- The Activity panel replaces fixed 260/280px content minimums with
  `minmax(0, 1fr)` inside a drawer.
- Help and Create ME dialogs are constrained by `100dvh` and safe-area insets
  at every width, including wide landscape phones.
- Dialog content scrolls internally while the close control remains reachable.

## Header and Navigation

- Compact header behavior extends beyond the current 640px boundary so controls
  do not jump back to full labels before they fit.
- Immersive mode retains a directly reachable Help action on narrow screens.
- Markets, Citizens, and Agent Talk buttons all expose the same active class,
  `aria-expanded`, and `aria-controls` relationship.
- Drawer identifiers remain stable across layout modes.

## Testing

Add Playwright tests under `tests/responsive` using the existing configuration.
The suite will cover:

- 1440×900 desktop;
- 1024×768 tablet landscape;
- 768×1024 tablet portrait;
- 390×844 phone portrait;
- 667×375 short phone landscape;
- 640/641 and 720/721 breakpoint boundaries.

Test states include overview, immersive, each HUD drawer, Help, Create ME, and
player detail followed by a HUD drawer. Assertions focus on behavior and
geometry:

- no document-level horizontal overflow;
- visible dialogs fit the viewport or have a scrollable body;
- short-landscape HUD inspectors cover the usable application viewport;
- map and bottom inspector do not overlap in portrait mode;
- opening a HUD drawer closes player detail;
- Activity content owns scrolling and remains reachable;
- all HUD buttons report consistent active and ARIA state;
- the Pixi canvas continues to match its visible map container.

Visual snapshots may be added for the stable shell states, while geometry and
accessibility assertions remain the primary regression contract.

## Acceptance Criteria

- All tested viewport/state combinations preserve access to core functions.
- A visible map never collapses below the chosen minimum interaction area.
- Short landscape uses the approved panel-first inspector behavior.
- Help and Activity content are reachable in short landscape.
- Competing inspectors cannot remain open simultaneously.
- `npm run test:responsive`, unit tests, lint, and production build complete
  successfully, apart from explicitly documented pre-existing warnings.
