# Cross-platform parity — design contract

Pluralscape ships on **iOS**, **Android**, and **web** from one design system. This document is the **design-level contract** that says what stays the same across platforms and what is allowed to differ. Engineering pipeline details (build, framework, API references) live in the monorepo; this file is for the design decisions that govern parity.

## Core principle

**Identical mental model. Native execution.**

A user who learns the app on iPhone and then signs in on the web should never have to relearn where things are or what they mean. On each platform, the design uses the right primitive for that platform — sheets are sheets on iOS, bottom sheets on Android, modals on the web; system controls (date pickers, file pickers, share sheets) are always native.

---

## What MUST be identical across platforms (design rules)

These are the parity rules a design must hold to. They are **canonical for the current design-system baseline.**

| Surface | Why |
|---|---|
| **Information architecture** — top-level sections, names, order | A user describing the app to their therapist must use the same words on every device. |
| **Terminology** (the term set chosen in Terminology settings) | If a system has chosen "headmates," they are "headmates" everywhere — including assistive labels. |
| **Member identity model** — name, color, shape glyph, pronouns | Visual identity must be portable; a member recognizable on phone must be recognizable on web. |
| **Privacy semantics** — buckets, audiences, fields, fail-closed copy | Privacy is the product. Inconsistency erodes trust. |
| **Destructive-action friction tiers** — the four tiers and their consequences | A delete must be exactly as hard everywhere. |
| **Data-state labels** — the nine canonical strings and tones | "Saved on this device" means the same thing everywhere. |

---

## What SHOULD differ — platform-native presentation

These are presentation differences the design intentionally allows so each platform feels native. Implementation specifics (which framework, which API) are documented separately in the monorepo; this table lists only the design-level differences.



| Concern | iOS | Android | Web |
|---|---|---|---|
| Modal presentation | Sheet (`UIModalPresentationPageSheet`-equivalent) | Bottom sheet (Material) | Centered modal with backdrop |
| Navigation | Stack with system back gesture | Stack with system back button + predictive back | Browser history + breadcrumbs |
| Tab bar | iOS tab bar, bottom, with haptics on switch | Material navigation bar, bottom | Persistent left rail on ≥1024px, bottom nav below |
| Date / time picker | iOS native picker | Material date picker | Native `<input type="date">` |
| File picker / share | UIDocumentPicker, ShareLink | SAF, Android share intent | `<input type="file">`, Web Share API where available |
| Haptics | Subtle confirmation on switch / save | Subtle confirmation on switch / save | None (no equivalent — fall back to subtle motion if `prefers-reduced-motion: no-preference`) |
| Type ramp | SF / SF Pro Display | Roboto Flex / system | Inter (web), system fallback |
| Scroll bounce | iOS rubber-band | Android over-scroll glow | Browser default |

---

## Accessibility parity contract

Every primitive in `SKILL.md`'s acceptance-criteria table must be true on **all three** platforms before that primitive is considered shipped. Specifically:

| Requirement | iOS | Android | Web |
|---|---|---|---|
| Hit area ≥ 44×44 pt | Yes | Yes (≥48dp) | Yes (≥44px) |
| Focus-visible indicator | VoiceOver focus ring | TalkBack focus ring + visible focus | Custom 2px focus ring (`--focus-ring`) |
| Screen reader label | `accessibilityLabel` | `contentDescription` | `aria-label` / labeled control |
| Live region announcements | `UIAccessibility.post` | `announceForAccessibility` | `aria-live` / `role="status"` |
| Reduced motion respected | `UIAccessibility.isReduceMotionEnabled` | `Settings.Global.TRANSITION_ANIMATION_SCALE` | `prefers-reduced-motion` |
| High-contrast mode | iOS Increase Contrast → switch to `data-mode="high-contrast"` equivalent | Android High contrast text | `[data-mode="high-contrast"]` |

---

## Implementation guidance

For design-system purposes, the rules above are sufficient. Concrete implementation details — the React Native version, the tokens regen pipeline, the per-platform component file map — live in the monorepo (`tokens/README.md`, `apps/mobile/`). Update those if the build pipeline changes; update *this* document if a parity rule changes.

## What's NOT covered yet

- Watch / wearable surfaces (deferred — not part of the v1 plan).
- Tablet split-view layout rules beyond "treat as web ≥768px" (needs design pass).
- Offline conflict resolution UX on small screens — `ImportConflictResolver` is a desktop-density layout; mobile variant is open work.

This document is meant to be edited as the platforms reveal disagreements. When you find one, update the table — don't paper it over.
