# Mobile and web accessibility gates — proposed

> **Status: design-system spec, not yet wired to CI.**
> This file specifies the gates that should run before any Pluralscape surface ships to users. The gates below are **planned** — they live as a contract between design and engineering. None of them currently execute in CI on this kit; the production monorepo owns moving each row from "planned" to "running" and updating the status column.

The intent: nothing merges to `main` without section A passing; nothing ships to the App Store / Play Store without section B logged in the release record.

The gates exist because the Apr 2026 audit flagged that earlier docs claimed full WCAG 2.2 AA conformance while several primitives lacked accessible names, focus styles, or dialog semantics. These gates make the claim falsifiable when implemented.

---

## A. Automated — to wire into CI

The gates split into five categories. Each row gets its own test or lint rule; gates without a concrete test obligation belong in section C, not here.

### A.1 Lint gates

| Gate                    | Tool                                                                                                                                                                                 | Where                   | Status  | Failing means |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------- | ------------- |
| **Web a11y lint**       | [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) `recommended` ruleset, no rule allowed below `error`                                                | `apps/web/.eslintrc`    | planned | block PR      |
| **RN a11y lint**        | [`eslint-plugin-react-native-a11y`](https://github.com/FormidableLabs/eslint-plugin-react-native-a11y) `all` ruleset                                                                 | `apps/mobile/.eslintrc` | planned | block PR      |
| **Inline-literal lint** | Custom rule extending `pluralscape/no-design-token-literals` to interactive props (`accessibilityLabel`, `aria-label`) — values must come from `i18n` keys, never hard-coded strings | `tooling/eslint-config` | planned | block PR      |

### A.2 Token and contrast gates

| Gate                             | Tool                                                                                                                                                                                           | Where                       | Status  | Failing means |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------- | ------------- |
| **Token contrast (default)**     | `tests/tokens/contrast.test.ts` — iterates `tokens/pairings.json`. Every `allowed` pair must clear its declared min; no `forbidden` pair may resolve as fg+bg in any `semantic.<mode>` mapping | `packages/design-system` CI | planned | block PR      |
| **Token contrast (per mode)**    | `tests/tokens/contrast-modes.test.ts` — re-runs the contrast iteration for every active theme (`static`, `reduced-motion`, `high-contrast`, `littles`); high-contrast text must clear ≥7:1     | `packages/design-system` CI | planned | block PR      |
| **Mode coverage**                | `tests/tokens/mode-coverage.test.ts` — every override key in `tokens/*.json` modes blocks must reference a default token; every primitive must render under all five modes without crashing    | tokens + components         | planned | block PR      |
| **Forbidden-pair short-circuit** | The `tokens/build.mjs` script runs the pairings validator before emitting any output, so a forbidden pair never reaches a generated artifact even if Vitest hasn't run                         | `pnpm tokens:build`         | live    | block build   |

### A.3 Component contract gates

| Gate                          | Tool                                                                                                                                                                                            | Where              | Status  | Failing means |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------- | ------------- |
| **Hit-area floor**            | `tests/components/hit-area.test.tsx` — renders every primitive in default mode, asserts bounding box ≥ 44×44; in `littles` mode asserts ≥56×56                                                  | components package | planned | block PR      |
| **Touch-target spacing**      | `tests/components/touch-target-spacing.test.tsx` — adjacent interactive primitives must have ≥10px clear space per WCAG 2.5.8                                                                   | components package | planned | block PR      |
| **Focus-visible coverage**    | `tests/components/focus-visible.test.tsx` — every interactive primitive shows a `box-shadow` or RN `accessibilityState` change matching `--focus-ring` when focused via keyboard                | components         | planned | block PR      |
| **Focus trap (overlays)**     | `tests/components/focus-trap.test.tsx` — `Dialog`, `BottomSheet`, `Popover` keep focus inside the surface; `Tab` / `Shift-Tab` cycle the surface's focusable elements only                      | components         | planned | block PR      |
| **Esc closes overlays**       | `tests/components/escape-closes.test.tsx` — every overlay primitive responds to `Escape` (web) and the OS back gesture (mobile) by closing                                                      | components         | planned | block PR      |
| **Form-label association**    | `tests/components/labels.test.tsx` — every `Input`, `TextArea`, `Select`, `Checkbox`, `Radio`, `Switch` exposes an accessible name via `<label htmlFor>`, `aria-label`, or `accessibilityLabel` | components         | planned | block PR      |
| **Error-message association** | `tests/components/error-association.test.tsx` — input components render `aria-describedby` (web) / `accessibilityHint` (RN) pointing at the error text whenever the `error` prop is set         | components         | planned | block PR      |
| **Autocomplete attribute**    | `tests/components/autocomplete.test.tsx` — every `Input` whose semantics map to a known `autocomplete` token (email, current-password, given-name, etc.) sets it; per WCAG 1.3.5                | components         | planned | block PR      |

### A.4 Motion and mode contracts

| Gate                          | Tool                                                                                                                                                                                                              | Where               | Status  | Failing means |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------- | ------------- |
| **Duration ceiling per mode** | `tests/tokens/duration-ceiling.test.ts` — for every animated primitive, the resolved duration is ≤400ms in `default`, ≤50ms in `reduced-motion`, 0ms in `static`                                                  | tokens + components | planned | block PR      |
| **No motion-only signal**     | `tests/components/motion-signal.test.tsx` — primitives that animate state changes (`Switch`, `Toast`, `Progress`) also expose the change via text or `aria-live`; verified by snapshotting the static-mode render | components          | planned | block PR      |
| **Live-region etiquette**     | `tests/components/live-regions.test.tsx` — `aria-live="assertive"` (web) / `LiveRegion` priority `high` (RN) used only on `danger`/`critical` tone surfaces; `polite` is the default                              | components          | planned | block PR      |

### A.5 Render and document gates

| Gate                         | Tool                                                                                                                                                                                       | Where                  | Status  | Failing means           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------- | ----------------------- |
| **axe-core in render tests** | [`jest-axe`](https://github.com/nickcolley/jest-axe) on every screen and component render test, no violations allowed                                                                      | components + screens   | planned | block PR                |
| **Heading order**            | `tests/screens/heading-order.test.tsx` — every screen's rendered DOM has a single `<h1>` and no skipped heading levels per WCAG 1.3.1                                                      | screens                | planned | block PR                |
| **Image alt-text**           | `tests/components/image-alt.test.tsx` — every `<img>` / RN `Image` has either an `alt` / `accessibilityLabel` or is explicitly marked decorative (`alt=""`, `accessibilityElementsHidden`) | components + screens   | planned | block PR                |
| **Lang attribute**           | `tests/screens/lang.test.tsx` — every web screen renders `<html lang="…">` matching the active i18n locale                                                                                 | apps/web               | planned | block PR                |
| **Skip-to-content**          | `tests/screens/skip-link.test.tsx` — every web screen exposes a focusable "Skip to content" link as the first tab stop                                                                     | apps/web               | planned | block PR                |
| **Lighthouse a11y score**    | CI Lighthouse run against the marketing site and primary product screens; a11y score ≥95 required                                                                                          | CI nightly + PR labels | planned | warn PR / block release |

### Forbidden-pair tests

The test iterates the explicit `pairings.json` registry rather than guessing
implied pairings from the shape of `semantic.default`. Every `allowed` pair
must clear its declared minimum ratio; every `forbidden` pair must be unreachable
as a resolved fg+bg pair in any `semantic.<mode>` mapping.

```ts
// tests/tokens/forbidden-pairs.test.ts
import colors from "../../tokens/colors.json";
import pairings from "../../tokens/pairings.json";
import { contrast, resolveColor, semanticPairs } from "../helpers/contrast";

test.each(pairings.allowed)("allowed: $id clears $min:1", (p) => {
  const r = contrast(resolveColor(p.fg), resolveColor(p.bg));
  expect(r).toBeGreaterThanOrEqual(p.min);
});

test.each(pairings.forbidden)("forbidden: $id never resolves in any semantic mode", (p) => {
  const fg = resolveColor(p.fg).toLowerCase();
  const bg = resolveColor(p.bg).toLowerCase();
  for (const [modeName, mode] of semanticPairs(colors)) {
    for (const { fgRole, bgRole, fgVal, bgVal } of mode) {
      if (fgVal.toLowerCase() === fg && bgVal.toLowerCase() === bg) {
        throw new Error(
          `mode "${modeName}" reaches forbidden pair ${p.id} via ${fgRole} on ${bgRole}`,
        );
      }
    }
  }
});
```

The same validation runs as a build-time gate in `tokens/build.mjs` so a
forbidden pair never reaches the generated CSS/JS even if Vitest hasn't run.

### Contrast helper signature

```ts
// tests/helpers/contrast.ts
export function contrast(fg: string, bg: string): number; // returns ratio
export function passesAA(fg: string, bg: string, large?: boolean): boolean;
export function passesAAA(fg: string, bg: string, large?: boolean): boolean;
```

---

## B. Manual — to run each release candidate

These are **not** automatable; they require devices and humans. **None have been run yet against this kit** — there is no built mobile app to test against. Log results in the release record (`releases/<version>/a11y.md`) with date, tester, and tool versions when the production app exists.

- [ ] **VoiceOver iOS** — every screen traversable; every screen reaches Sign Out without losing focus. Form fields announce label + value + state.
- [ ] **TalkBack Android** — same coverage as iOS. Custom views announce role.
- [ ] **External keyboard / Switch Control** — every action reachable in ≤6 swipes from the home screen. No keyboard traps. `Esc` closes every dialog.
- [ ] **Dynamic Type / Font Scaling at 200%** — no text clipped, no overlapping containers. The Today, Members, Chat, and Settings tabs are the canonical screens to verify.
- [ ] **Reduced Motion** — verify both `data-mode="reduced-motion"` (visuals untouched, durations clamped to 50ms) and `data-mode="static"` (visuals flatten, durations clamp to 0). OS `prefers-reduced-motion` should map to `reduced-motion`, not `static`.
- [ ] **Low-vision contrast review** — set `data-mode="high-contrast"` and verify every interactive border is distinguishable from its surface at arm's length.
- [ ] **Color-blindness simulation** — run the marketing site and primary product screens through deuteranopia, protanopia, and tritanopia simulators. No interactive element should depend on hue alone for state.
- [ ] **Panic / dissociation walkthrough** — a tester unfamiliar with the app should be able to: (a) change who's fronting, (b) send a chat message, (c) sign out — using only first-pass guesses, in under 60 seconds total. This proxies low-capacity users.
- [ ] **Offline path** — turn on airplane mode, exercise every data-modifying screen. Every action shows a `SyncState` badge and survives the app being relaunched.

---

## C. What the gates explicitly do not cover

These need separate processes; flag them in design review:

- **Cognitive load** — there is no automated test for "is this copy gentle enough." Voice review is part of design crit.
- **Cultural fit of terminology** — community language drift is monitored in the `terminology.json` change log, not in CI.
- **Trauma-informed flow design** — destructive-action confirmation, account deletion, and crisis-mode flows go through a community advisory review before release.
- **Reading level** — automated readability scoring is unreliable for the voice the docs target. Crit is the gate.

---

## D. Adding a new gate

Open a PR that:

1. Adds the test or lint rule.
2. Updates this file with a row in the right table.
3. Captures one historical bug the gate would have caught (link the GitHub issue).

Gates without bugs don't earn their maintenance cost.
