# Mobile accessibility test gates — proposed

> **Status: design-system spec, not yet wired to CI.**
> This file specifies the gates that should run before any Pluralscape surface ships to users. The gates below are **planned** — they live as a contract between design and engineering. None of them currently execute in CI on this kit (the kit is HTML-only). When the production monorepo adopts this system, the engineering team owns moving each row from "planned" to "running" and updating the status column.

The intent: nothing merges to `main` without section A passing; nothing ships to the App Store / Play Store without section B logged in the release record.

The gates exist because the PDF audit (Apr 2026) flagged that our docs claimed full WCAG 2.2 AA conformance while several primitives lacked accessible names, focus styles, or dialog semantics. These gates make the claim falsifiable when implemented.

---

## A. Automated — to wire into CI

| Gate                         | Tool                                                                                                                                                                                                 | Where                   | Status  | Failing means |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------- | ------------- |
| **Web a11y lint**            | [`eslint-plugin-jsx-a11y`](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) `recommended` ruleset, no rule allowed below `error`                                                                | `apps/web/.eslintrc`    | planned | block PR      |
| **RN a11y lint**             | [`eslint-plugin-react-native-a11y`](https://github.com/FormidableLabs/eslint-plugin-react-native-a11y) `all` ruleset                                                                                 | `apps/mobile/.eslintrc` | planned | block PR      |
| **Token contrast**           | `tests/tokens/contrast.test.ts` — iterates `tokens/pairings.json` (C2). Each `allowed` pair must clear its declared min; no `forbidden` pair may resolve as fg+bg in any `semantic.<mode>` mapping.  | `tokens/` package CI    | planned | block PR      |
| **Hit-area floor**           | `tests/components/hit-area.test.tsx` — renders every primitive in default mode, asserts bounding box ≥ 44×44                                                                                         | components package      | planned | block PR      |
| **Mode coverage**            | `tests/tokens/mode-coverage.test.ts` — every override key in `tokens/colors.json` modes must reference an existing default token; every primitive must render under all three modes without crashing | tokens + components     | planned | block PR      |
| **axe-core in render tests** | [`jest-axe`](https://github.com/nickcolley/jest-axe) on every screen/component test, no violations allowed                                                                                           | components + screens    | planned | block PR      |
| **Focus-visible coverage**   | `tests/components/focus-visible.test.tsx` — every interactive primitive shows `box-shadow` matching `--focus-ring` when focused via keyboard                                                         | components              | planned | block PR      |

### Forbidden-pair tests (C2)

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

The `tokens/build.mjs` script runs this same validation as a CI gate before
emitting any platform output, so a forbidden pair never reaches the CSS/JS
artifacts even if jest hasn't run yet.

### Contrast helper signature

```ts
// tests/helpers/contrast.ts
export function contrast(fg: string, bg: string): number; // returns ratio
export function passesAA(fg: string, bg: string, large?: boolean): boolean;
export function passesAAA(fg: string, bg: string, large?: boolean): boolean;
```

---

## B. Manual — to run each release candidate

These are **not** automatable; they require devices and humans. **None have been run yet against this kit** — the kit ships HTML previews, not a built mobile app. Log results in the release record (`releases/<version>/a11y.md`) with date, tester, and tool versions when the production app exists.

- [ ] **VoiceOver iOS** — entire app traversable; every screen reaches Sign Out without losing focus. Form fields announce label + value + state.
- [ ] **TalkBack Android** — same coverage as iOS. Custom views announce role.
- [ ] **External keyboard / Switch Control** — every action reachable in ≤ 6 swipes from the home screen. No keyboard traps. `Esc` closes every dialog.
- [ ] **Dynamic Type / Font Scaling at 200%** — no text clipped, no overlapping containers. The Today, Members, Chat, and Settings tabs are the canonical screens to verify.
- [ ] **Reduced Motion** — verify both `<html data-mode="reduced-motion">` (visuals untouched, durations clamped to 50ms) and `<html data-mode="static">` (visuals flatten, durations clamp to 0). Either mode applied via OS `prefers-reduced-motion` should match the CSS-driven version.
- [ ] **Low-vision contrast review** — set `<html data-mode="high-contrast">` and verify every interactive border is distinguishable from its surface at arm's length.
- [ ] **Panic / dissociation walkthrough** — a tester unfamiliar with the app should be able to: (a) change who's fronting, (b) send a chat message, (c) sign out — using only first-pass guesses, in under 60 seconds total. This proxies low-capacity users.
- [ ] **Offline path** — turn on airplane mode, exercise every data-modifying screen. Every action shows a `SyncState` badge and survives the app being relaunched.

---

## C. What the gates explicitly do not cover

These need separate processes; flag them in design review:

- **Cognitive load** — there is no automated test for "is this copy gentle enough." Voice review is part of design crit.
- **Cultural fit of terminology** — community language drift is monitored in the `terminology.json` change log, not in CI.
- **Trauma-informed flow design** — destructive-action confirmation, account deletion, and crisis-mode flows go through a community advisory review before release.

---

## D. Adding a new gate

Open a PR that:

1. Adds the test or lint rule.
2. Updates this file with a row in the right table.
3. Captures one historical bug the gate would have caught (link the GitHub issue).

Gates without bugs don't earn their maintenance cost.
