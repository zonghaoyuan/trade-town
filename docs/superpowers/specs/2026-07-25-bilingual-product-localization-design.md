# Bilingual Product Localization Design

## Goal

Add first-class English and Simplified Chinese support to Trade Town without
changing its financial, Web3, or multi-Agent product focus.

The initial release localizes product-owned static content. Chat history,
user-authored content, Agent reasoning, trade rationales, and dynamic activity
content remain in their original language.

## Success Criteria

- A user can switch between English and Simplified Chinese without reloading.
- An explicit language choice survives a browser restart.
- A first-time visitor sees English regardless of browser language.
- Static interface copy, map labels, product-owned profile copy, accessibility
  labels, and locale-sensitive date and number formatting follow the selected
  language.
- Both the live Convex application and the no-Convex preview use the same
  localization state.
- Missing or invalid locale state never produces blank interface text.
- The financial simulation, identifiers, persisted Convex data, and Agent
  output behavior remain unchanged.

## Scope

This release includes:

- application navigation, header actions, HUD controls, drawers, tabs, and
  dialogs;
- help, status, loading, empty-state, and error copy shown by the frontend;
- player details and Create ME static interface copy;
- product-owned market names and descriptions, trader roles and profile
  descriptions, when those values are presented as interface metadata;
- functional building labels rendered on the Pixi town map;
- the static no-Convex preview;
- `aria-label`, `title`, placeholder, and other user-facing accessibility copy;
- frontend date, time, integer, decimal, percentage, currency-like, and compact
  number presentation.

This release excludes:

- existing and future chat message bodies;
- user-authored text;
- Agent beliefs, reasoning, memory, trade rationales, and generated reports;
- dynamic town activity, social posts, transaction explanations, and event
  details;
- asset symbols, Agent names, addresses, block heights, transaction hashes,
  chain identifiers, and other canonical identifiers;
- backend errors and logs, service responses, prompts, the level editor, and
  documentation localization.

Static labels surrounding excluded dynamic content are still localized. For
example, a "Decision thesis" heading can become Chinese while its generated
thesis body remains unchanged.

## Chosen Approach

Use a small, type-safe in-repository localization layer instead of adding a
general-purpose internationalization dependency.

The project needs two locales and does not currently require plural rules,
server-rendered locale routing, translation downloads, or a translation
management service. A local layer keeps the runtime synchronous, makes the
fallback behavior explicit, and avoids coupling the hackathon build to another
package. The public interface remains small enough to replace with a mature
library later if the language count or content workflow grows.

Component-level language ternaries are not permitted. All localized strings
must come from the localization layer so coverage can be tested centrally.

## Localization Architecture

Create a focused `src/i18n/` module with four responsibilities:

1. Define the supported locale union: `en | zh-CN`.
2. Resolve and persist the active locale.
3. Provide type-safe message lookup and named interpolation.
4. Provide locale-aware formatting helpers backed by `Intl`.

The English catalog defines the canonical nested key shape. The Simplified
Chinese catalog must satisfy the same recursive shape while allowing different
string values. A generated union of dot-separated keys gives `t()` typed lookup
without making the Chinese values equal to the English string literals.

Interpolation uses named tokens such as `{current}` and `{total}`. Unknown
tokens remain visible in development and are reported rather than silently
removed. This release does not need language-dependent plural selection; copy
that would require pluralization uses neutral wording.

`I18nProvider` is mounted once in `src/main.tsx`, outside the live/preview
branch, so `Home` and `DemoApp` behave identically. `useI18n()` exposes:

- `locale`;
- `setLocale(locale)`;
- `t(key, variables?)`;
- locale-aware number, date, and time formatters.

## Locale Resolution and Persistence

Use this deterministic priority order:

1. A valid value from the `trade-town.locale.v2` local storage key.
2. English.

Browser language does not change the first-visit locale. The versioned storage
key resets locale values previously written automatically from browser
detection; future explicit choices remain persistent.

When the locale changes:

- React consumers update synchronously;
- `<html lang>` becomes `en` or `zh-CN`;
- the valid locale is written to local storage;
- no network request, Convex mutation, or full-page reload occurs.

Storage access is guarded because browsers can deny it. An invalid or
unreadable stored value is ignored, and the application continues in English.

## Language Switcher

Add a reusable `LanguageSwitcher` component to the existing header actions.
It uses compact, self-identifying labels (`EN` and `中`) and exposes the active
state with standard button and ARIA semantics.

The switcher remains directly reachable in overview and immersive layouts. Its
responsive styling follows the existing header control breakpoints and must not
push Help, Create ME, or the view toggle out of the viewport.

The control announces the destination language, for example "切换至中文" while
the interface is English and "Switch to English" while it is Chinese.

## Content Boundaries and Stable Data

Canonical application data remains language-neutral wherever it participates
in simulation or persistence.

- Symbols, names, IDs, actions such as `BUY`, and transaction states remain
  canonical values.
- UI code maps canonical enums to localized display labels.
- Market and trader metadata is localized at the presentation boundary using
  stable symbols and Agent names as lookup keys. The English seed data in
  `shared/finance.ts` is not rewritten because backend and deterministic
  simulation code also consume it.
- Create ME payload values remain stable IDs; only option labels, guidance, and
  summaries are localized.

This prevents switching language from changing equality checks, stored data,
orders, simulations, or replay determinism.

## Map Labels

Separate map-label identity from rendered text.

`data/urban.ts` continues to own building IDs, geometry, entrances, collision,
and label placement. Raw Chinese display text is replaced by a stable label key
or explicit label visibility marker. The locale catalogs own the English and
Chinese text for every visible functional building label.

`PixiStaticMap` receives the active locale or resolved label map as a prop.
Because the current `PixiComponent` creates its text objects only once, a locale
change remounts the static map layer with a locale-specific React key. Language
changes are rare, so rebuilding the static layer is simpler and less risky than
adding mutable Pixi text reconciliation.

This change does not modify map tiles, collision, building geometry, Agent
spawn points, or the generated Kenney tileset. It therefore does not introduce
a new map layout version.

## Formatting

Frontend formatting must use the selected locale instead of hard-coded
`en-US`, `en-GB`, or `en-CA` locales.

Formatting helpers preserve the existing financial precision and 24-hour time
requirements. Localization may change grouping separators, date ordering, and
localized units, but must not change underlying numeric values, rounding rules,
prices, quantities, percentages, or timestamps.

Machine-oriented values such as ISO dates, asset symbols, hashes, and chain
proof references retain their canonical representation where changing the
format would reduce auditability.

## Error Handling and Fallbacks

- Invalid locale input resolves to English.
- Missing Chinese messages fall back to English and emit a development warning.
- Missing English canonical messages return their visible key and emit a
  development error so blank controls are impossible.
- Failed local storage reads or writes do not interrupt rendering.
- A missing localized market, trader, or building metadata entry falls back to
  the existing canonical English value.
- Excluded dynamic content is displayed unchanged, never sent to an automatic
  translation service.

## Testing

Add unit coverage for:

- English default regardless of browser language;
- stored-locale priority and invalid stored values;
- storage failure fallback;
- complete English/Chinese catalog key parity;
- named interpolation;
- missing-key English fallback;
- locale-aware number and time formatting without changing precision;
- stable entity-to-label lookup for markets, traders, and buildings.

Add component coverage for:

- the initial English language even with a Chinese browser preference;
- switching languages without reload;
- persistence of an explicit choice;
- updates to `<html lang>`;
- active and accessible Language Switcher state.

Extend map regression tests to confirm:

- every building configured to show a label has non-empty English and Chinese
  text;
- locale changes do not alter layout, collision, entrances, or spawn
  accessibility.

Run the project verification required for map-label changes:

```bash
python3 scripts/generate_urban_tileset.py
npm test -- --runInBand
npm run build
npx convex run init
```

Also run lint and responsive/browser checks when the available development
server and Convex environment allow them. Visually inspect English and Chinese
at desktop, phone portrait, and short landscape sizes, focusing on header
overflow, drawer tabs, modal controls, Create ME forms, and Pixi label width.

## Rollout

Ship both catalogs in the main frontend bundle. No data migration or backend
deployment ordering is required. The versioned locale key makes existing and
new visitors enter in English once; choices made after this release persist.

The release is reversible by removing the provider and switcher; it does not
rewrite stored world, chat, market, replay, or Agent data.

## Acceptance Criteria

- English and Simplified Chinese are selectable from every supported layout.
- English is the first-visit default and an explicit choice persists.
- All in-scope static copy has entries in both catalogs.
- Chat, generated Agent content, and dynamic activity bodies remain byte-for-
  byte unchanged.
- Map labels switch languages without changing the town layout or navigation.
- No in-scope control renders blank text after a catalog or storage failure.
- Existing financial and world tests continue to pass.
- The required map verification commands and production build complete
  successfully, apart from explicitly documented environment failures.
