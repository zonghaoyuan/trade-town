# Pixel Language Switcher Redesign

## Goal

Replace the current single-label language button with a compact, unambiguous
pixel-art segmented control that feels native to the INJ Trade Town header.
The control must remain directly accessible on desktop, tablet, portrait
mobile, and short landscape layouts.

## Chosen Direction

Use a persistent two-segment `EN | 中` selector.

- Both supported languages are visible at all times.
- The current locale is the selected segment and uses the town's gold surface
  with dark text.
- The other locale uses the slate surface with cream text.
- The control uses the same hard edges, integer-pixel borders, inset bevel, and
  offset shadow as the surrounding HUD.
- Do not use national flags. Flags identify countries rather than languages.
- Do not open a dropdown. Two choices are faster and clearer as direct actions.

This adapts a conventional segmented control to the project's pixel interface:
the pattern makes closely related exclusive choices visible, while the styling
keeps it visually subordinate to Create ME and the town-view action.

## Component and Semantics

`LanguageSwitcher` becomes a labelled group containing two native buttons:

- English button: visible label `EN`, `lang="en"`.
- Chinese button: visible label `中`, `lang="zh-CN"`.
- Each button exposes its selected state through `aria-pressed`.
- The group receives a localized accessible name through
  `language.selector`.
- Selecting the active locale is a harmless no-op.
- Selecting the other locale continues to use the existing `setLocale`
  function, browser persistence, and document-language update.

The selected state must never depend on color alone. It also receives a
recessed/pressed treatment and a centered 3-by-3-pixel square marker along its
bottom edge.

## Visual Specification

### Desktop

- Overall size: 68 by 42 CSS pixels.
- Two equal segments separated by a 2-pixel dark divider.
- Outer border and shadow align with adjacent header controls.
- Selected segment: gold background, night text, inset lower-right shadow.
- Unselected segment: slate background, cream text.
- Hover affects only the available segment.

### Compact layouts

- Overall size reduces to 60 by 42 CSS pixels.
- Each segment remains at least 28 pixels wide and 42 pixels high.
- Labels stay `EN` and `中`; neither is replaced by a globe, flag, or tooltip-
  only icon.
- The selector participates in the existing header-action gap and must not
  overlap replay, Create ME, town-view, help, or Injective status controls.

### Motion and focus

- State changes use an immediate pixel-style press, without sliding or blurred
  animation.
- Keyboard focus uses a high-contrast two-pixel outline and remains visible
  around the focused segment.
- Reduced-motion mode requires no special fallback because the design has no
  essential animation.

## Responsive and Regression Requirements

- The selector is visible in overview and immersive modes at every supported
  breakpoint.
- Existing behavior at 640/641, 720/721, 1100/1101, and 1320/1321 pixels must
  remain overflow-free.
- The 667 by 375 short-landscape header must retain its single-row compact
  replay layout.
- The 390 by 844 mobile header must keep both language segments visible.

## Testing

- Update the existing locale end-to-end test to select explicit `EN` and `中`
  segments.
- Assert the selected segment's `aria-pressed` state before and after a switch.
- Preserve browser-language detection and reload-persistence coverage.
- Run unit tests, TypeScript/build, lint, and the full responsive Playwright
  suite.
- Capture desktop and mobile screenshots in both locales for visual review.

## References

- W3C: flags represent countries rather than languages:
  https://www.w3.org/International/questions/qa-link-lang.en
- WCAG 2.2 target-size guidance:
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- GOV.UK guidance recommends avoiding a select when a small set of choices can
  be presented directly:
  https://design-system.service.gov.uk/components/select/
- Apple segmented controls describe the pattern as a quick switch between
  closely related choices:
  https://developer.apple.com/design/human-interface-guidelines/segmented-controls

## Out of Scope

- Adding more locales.
- Changing locale detection or persistence.
- Translating chat bodies or Agent-generated reasoning.
- Restyling unrelated header controls.
