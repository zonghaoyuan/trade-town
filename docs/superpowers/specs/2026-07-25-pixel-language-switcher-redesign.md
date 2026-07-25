# Pixel Language Switcher Redesign

## Goal

Replace the generic language button with a compact, unambiguous pixel-art
language badge that feels native to the INJ Trade Town header.
The control must remain directly accessible on desktop, tablet, portrait
mobile, and short landscape layouts.

## Chosen Direction

Use one persistent target-language badge.

- The English interface displays `中`, indicating that the next action switches
  to Chinese.
- The Chinese interface displays `EN`, indicating that the next action switches
  to English.
- The control uses the same hard edges, integer-pixel borders, inset bevel, and
  offset shadow as the surrounding HUD, without inheriting the visually heavy
  generic action-button frame.
- Do not use national flags. Flags identify countries rather than languages.
- Do not open a dropdown. With two languages, a single reversible action is
  faster and occupies less header space.

The badge stays visually subordinate to Create ME and the town-view action.
Its tooltip and accessible name state the full destination action.

## Component and Semantics

`LanguageSwitcher` remains one native button:

- Its visible glyph is the destination locale's short label.
- The glyph receives the destination `lang` attribute.
- Its localized accessible name and tooltip read “Switch to Chinese” or
  “切换至英文”.
- A `data-target-locale` attribute exposes the destination for deterministic
  browser testing.
- Activation continues to use the existing `setLocale` function, browser
  persistence, and document-language update.

## Visual Specification

### Desktop

- Overall size: 42 by 42 CSS pixels.
- A three-pixel night frame surrounds a slate terminal-like face.
- Gold type, four pixel-corner details, a bottom status line, inset lighting,
  and a three-by-four-pixel outer shadow create the badge treatment.
- Hover brightens the face and glyph; press moves the badge down by two pixels.

### Compact layouts

- Overall size reduces to 40 by 42 CSS pixels.
- The pointer target remains larger than the WCAG 2.2 minimum.
- The visible label stays `EN` or `中`; it is never replaced by a globe, flag,
  or tooltip-only icon.
- The selector participates in the existing header-action gap and must not
  overlap replay, Create ME, town-view, help, or Injective status controls.

### Motion and focus

- State changes use an immediate pixel-style press without sliding or blurred
  animation.
- Keyboard focus uses a high-contrast two-pixel blue outline.
- Reduced-motion mode requires no special fallback because the design has no
  essential animation.

## Responsive and Regression Requirements

- The selector is visible in overview and immersive modes at every supported
  breakpoint.
- Existing behavior at 640/641, 720/721, 1100/1101, and 1320/1321 pixels must
  remain overflow-free.
- The 667 by 375 short-landscape header must retain its single-row compact
  replay layout.
- The 390 by 844 mobile header must keep the language badge visible.

## Testing

- Update the existing locale end-to-end test to select the target-language
  badge.
- Assert `data-target-locale` before and after a switch.
- Preserve the English first-visit default and reload-persistence coverage.
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

## Out of Scope

- Adding more locales.
- Reintroducing browser-language auto-detection.
- Translating chat bodies or Agent-generated reasoning.
- Restyling unrelated header controls.
