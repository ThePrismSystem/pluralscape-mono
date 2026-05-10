# Pluralscape Design System — Governance

This document is the **canonical authority** for status, modes, member identity, data states, destructive actions, and voice. When any other file in this kit conflicts with this one, this file wins. Update this file first; other files follow.

---

## 1. Status taxonomy

Every component, pattern, token, mode and accessibility claim in this kit carries one of three statuses. The taxonomy reduces ambiguity: when two examples seem to define the same pattern differently, the **Canonical** one governs.

| Status | What it means | Authority |
| --- | --- | --- |
| **Canonical** | Official rule or component pattern. Treat as binding. | Must be followed unless an exception is approved here in writing. |
| **Reference** | A recommended direction, demonstrated in the kit, but not yet binding. | May be adopted as canonical after review; may evolve. |
| **Exploratory** | Conceptual — open question, prototype, sketch. | Not binding guidance. Do not cite as a rule. |

**Deprecated patterns are removed**, not flagged. The kit does not carry a `deprecated` status — if a pattern is no longer canonical, its files are deleted and call sites migrated. If you find an undeleted older pattern in this repo, it is an oversight; remove it.

### Current canonical surface

| Area | Canonical artifact | Status |
| --- | --- | --- |
| Tokens (color / type / spacing / radii / motion / elevation) | `tokens/*.json` consumed via `import { useTheme } from '@pluralscape/design-system'` | Canonical |
| Logo | `assets/logo/pluralscape-icon.svg` + 3 wordmark variants | Canonical |
| Accommodation modes | This file, §3 | Canonical |
| Member identity | This file, §4 | Canonical |
| Data-state vocabulary | This file, §5 | Canonical |
| Destructive-action tiers | This file, §6 | Canonical |
| Voice & content rules | This file, §7 | Canonical |
| Mobile primitives (Button, IconButton, Switch, Avatar, etc.) | Canonical primitives layer (§9) | Reference |
| Pattern previews (FrontingTimeline, PrivacyBucket, ConfirmDestructive, ImportConflictResolver, SyncState) | Reference pattern implementations | Reference |
| Reference screens | Reference screen implementations | Reference |
| Terminology presets (parts, headmates, collective) | Consumed via terminology hooks (§8) | Reference |
| CI a11y test gates | `packages/design-system/docs/A11Y_GATES.md` | Exploratory (specified, not wired) |

---

## 2. Accessibility — what the system actually claims

**WCAG 2.2 AA is the target baseline.** That is the only conformance claim this kit makes. Stronger phrasings ("fully meets," "every criterion verified," "zero failures," "every component is accessible") are not used because the kit ships HTML previews — not a built application against which an audit can run.

What canonical components must include:

- An **accessible name** for every interactive element.
- A **visible focus state** that meets 1.4.11 (3:1 against adjacent colors) and 2.4.13 (≥2px perimeter, encloses the element).
- **Sufficient text contrast** (4.5:1 normal text, 3:1 large + non-text).
- A **clear touch target** (≥24×24 visual with ≥10px spacing per 2.5.8 AA; ≥44×44 hit area for primary actions per 2.5.5 AAA).
- **Color is never the only signal** — pair with icon, label, shape, or position.

Known accessibility risks (as of last audit, Apr 2026) are documented in `preview/accessibility.html` under "Known risks" and should be reviewed before any production adoption of this kit. The CI gates in `packages/design-system/docs/A11Y_GATES.md` are the mechanism by which "designed in" becomes "verified" — they are exploratory until a production app wires them up.

### Phrasing rules

| Avoid | Use |
| --- | --- |
| "All criteria are met" | "WCAG 2.2 AA is the target baseline." |
| "Fully verified" | "Designed with accessibility requirements in mind." |
| "Zero failures" | "Known risks are documented; review before production use." |
| "Every component is accessible" | "Canonical components include accessible names, visible focus, sufficient contrast, and clear touch targets." |

---

## 3. Accommodation modes — design contracts

The three accommodation modes are **product safety features**, not visual themes. Each has a contract any component must respect when its mode is active. A surface is conformant only if it satisfies every row of the relevant table.

### 3.1 Static mode — perceptual load reduction

Goal: reduce sensory demand to its strictest setting. Renamed from "low-sensory" because the previous name implied a single sensory dial; the system now ships **two** sensory accommodations and Static is the strictest of the two.

| Aspect | Default | Static contract |
| --- | --- | --- |
| Gradients | Allowed (avatar, accents) | Flattened to a single tone |
| Glow / inner shadows | Allowed on hover and onboarding | Removed |
| Blur (backdrop, glassmorphism) | Allowed sparingly | Removed |
| Decorative atmosphere (constellations, drift) | Allowed in empty states | Removed; static SVG or none |
| Surface boundaries | Soft 1px borders | Clearer static boundaries with stronger contrast |
| Motion | Gentle (≤400ms) | Clamped to 0 (instant state changes) |
| Tone | Rich, ambient | Plain, calm, low-demand |

CSS hook: `[data-mode="static"]`. Token overrides live in `tokens/colors.json` modes block and mirrored in `theme.js`.

### 3.1b Reduced-motion mode — vestibular accommodation

Goal: address vestibular sensitivity without flattening the visual surface. Some users want motion reduced but **not eliminated** — a 50ms fade communicates state change without triggering, while a 0ms snap reads as broken or jarring. Reduced-motion is independent of Static; users can opt for one without the other, and OS-level `prefers-reduced-motion` maps to this mode (not Static) by default.

| Aspect | Default | Reduced-motion contract |
| --- | --- | --- |
| Visuals (gradients, glow, color) | Default | Untouched |
| Motion | Gentle (≤400ms) | Clamped to ≤50ms — every duration falls under this ceiling |
| Animation styles | Drift, slide, fade allowed | Fade only — no translate, scale, or rotate above 1px |
| OS `prefers-reduced-motion` | Independent | Maps to this mode when no `data-mode` is set |

CSS hook: `[data-mode="reduced-motion"]`.

### 3.2 High-contrast mode — perceptibility

Goal: every interactive boundary is unmistakable. Affects more than text.

| Area | High-contrast contract |
| --- | --- |
| Text | ≥7:1 for primary text, ≥4.5:1 for secondary |
| Borders (interactive) | Promoted from `--border` to `--border-strong`; ≥4.5:1 against surface |
| Focus | Doubled-thickness ring, ≥7:1 against any adjacent fill |
| Disabled states | Remain perceivable — never reduced below 3:1 |
| Danger / warning | Color paired with icon + text label; never color-alone |
| Member identity | Color paired with shape glyph + initial; never color-alone |
| Surface tinting | Disabled — surfaces are flat to maximize boundary contrast |

CSS hook: `[data-mode="high-contrast"]`.

### 3.3 Littles-safe mode — product safety

Goal: simplified, gentle, low-risk surface for younger members. This is the strictest mode — treated as safety, not styling.

| Area | Littles-safe contract |
| --- | --- |
| Visual tone | Softer palette, simpler layouts, less visual density |
| Language | Clear, gentle, low-reading-burden; short sentences |
| Destructive actions | Hidden by default; if exposed, require switch out of mode + confirmation |
| Privacy | Fail-closed defaults across the surface |
| Navigation | Fewer choices per view; primary actions only |
| Error states | Reassuring and non-punitive — never "you did this wrong" |
| Sensitive content | Minimized or gated behind explicit opt-in |
| Hit targets | ≥56×56 (above the 44 floor) |

CSS hook: `[data-mode="littles"]`. Components that hide destructive actions in this mode are responsible for doing so; the mode is not a license to rely on a single rule.

---

## 4. Member identity — final rules

| Rule | Status |
| --- | --- |
| Member colors are **user-chosen**. The kit ships a curated suggestion palette, but **any color is permitted** via a full color picker. | Canonical |
| **There are no reserved colors.** No hue is set aside for system use only. Pale Rose, Lavender, Teal, Crimson, Amber, and any custom hex value are all permitted as member identity colors. The earlier "Pale Rose reserved for intimate UI" framing is fully rescinded. | Canonical |
| Semantic accents (Teal/Lavender/Amber/Crimson) keep their roles **inside system chrome only** (buttons, banners, status badges). When the same hue appears as a *member color* it is unambiguous because member surfaces always pair color with shape + initial + name. | Canonical |
| Member identity is **never color-alone**. Every member surface pairs color with at least one of: initial, shape glyph, name. | Canonical |
| **Shape glyph set is fixed at twelve glyphs** (circle, diamond, triangle, ring, square, pentagon, hex, crescent, star, cross, leaf, wave) for the current design-system baseline. Shapes carry no semantic weight beyond identity disambiguation. Shapes are auto-assigned but user-overridable. | Canonical for v1 — changes require governance update |
| **Initial visibility**: shown by default at avatar size ≥24px. Hidden below 24px; the gradient + shape badge carries identity. | Canonical |
| **Gradients are user-chosen too**: a member can pick a single color or a two-stop gradient. In **low-sensory mode**, gradients flatten to the first stop. | Canonical |
| **Contrast warning, not block**: when a user picks a color whose contrast against the avatar initial color falls below 4.5:1, the picker shows a warning with one-tap fix (auto-darken / auto-lighten the initial). The picker does not refuse the choice. | Canonical |

**No color is reserved.** Earlier guidance reserving Pale Rose (or any other hue) for system-only use is fully rescinded. Members may pick any color for their identity.

---

## 5. Data-state vocabulary

A formal semantic layer for the state of any user-touched data. Every data-state badge in the system uses one of these nine values. Each has fixed icon, color, label, tone, and severity.

*The nine values, their icons, colors, and labels are **canonical for the current design-system baseline**. Adding, renaming, or retiring a state requires a governance update — not a one-off product decision.*

| State | Meaning | Icon | Color token | Severity |
| --- | --- | --- | --- | --- |
| `saved-local` | Stored on device, not necessarily synced | `device` | `fg-muted` | Info |
| `syncing` | Changes are actively syncing | `sync` (spinner) | `accent` | Info |
| `synced` | Up to date with server | `check` | `success` | Success |
| `conflict` | Two versions need user review | `branch` | `warning` | Warning |
| `offline` | Network unavailable; local use continues | `cloud-off` | `fg-muted` | Info |
| `import-pending` | Imported data needs review before adoption | `inbox` | `accent` | Info |
| `export-ready` | Export prepared and available | `download` | `success` | Success |
| `failed` | Action did not complete; user action available | `alert` | `danger` | Error |
| `key-unavailable` | Encrypted; decryption key not present | `lock` | `fg-muted` | Info |

### Rules

- A surface shows **at most one** data-state badge per logical record.
- The label is always the literal state name in sentence case ("Saved locally", "Syncing…", "Synced", "Needs review", "Offline", "Needs import review", "Export ready", "Couldn't sync", "Encrypted").
- Tone is **neutral and supportive**, never alarming. `failed` says "Couldn't sync — your changes are safe locally," not "Error 503."
- Color is never the only signal — every state pairs an icon with the label.

See reference pattern implementations for a worked example of this state machine.

---

## 5b. Privacy buckets — the privacy primitive

Privacy is the product. The privacy primitive is **as formal as member identity, data states, and destructive actions** — not less.

### What a privacy bucket is

A **privacy bucket** is a named container that controls what a system shares with which friends. Think of a bucket as a lockbox with a label like "Close friends," "Therapist," or "Public." The system owner decides what content goes into each lockbox, and which friends get a key to which lockbox.

### Mental model (canonical)

> Tagging content with a bucket puts it inside the lockbox. Assigning a bucket to a friend hands them the key. A friend sees a piece of content only if they hold at least one key to a lockbox it's in. If anything is unclear or missing, the answer is always "no" — content stays hidden by default.

This is **fail-closed, intersection-based privacy**. Two implications drive design:

- **Untagged content is invisible to friends.** A member with no bucket tags is private, full stop. "A friend's view of a system shows nothing yet" is a real, common state — design empty states for it on purpose.
- **A friend with no buckets sees nothing.** Newly accepted friend connections start in this state.

### Content kinds a bucket can hold (canonical for v1)

A single bucket can hold many kinds of content at once. Components and screens that gate visibility must accept at least all of:

- Members
- Groups
- Custom fronts
- Fronting sessions and comments
- Notes, journal entries, wiki pages
- Chat messages, board messages, polls, acknowledgements
- Innerworld entities and regions
- Relationships
- Custom field definitions and values
- Member photos
- Structure entity types and structure entities

**Field-level gating:** even when a member is visible, individual fields on that member can be gated to specific buckets ("show pronouns to close friends; show full name only to family"). Member-detail components must support this, not just member-level visibility.

### Visibility scopes (canonical for v1)

When designing the bucket configuration UI, content groups into these scopes — a bucket expresses "this group of friends sees these scopes" without making the user think about individual entities:

- Members
- Custom fields
- Fronting status
- Custom fronts
- Notes
- Chat
- Journal entries
- Member photos
- Groups

### Design rules

| Rule | Status |
| --- | --- |
| **Fail-closed defaults.** Empty / unknown / loading state of any privacy-sensitive surface renders nothing visible — never "everything" or "last seen." | Canonical |
| **Explicit scope on focus.** Privacy-bucket controls announce their current scope on focus (assistive output: "Therapist bucket. 3 friends. Sees fronting status, notes."). | Canonical |
| **No silent widening.** Increasing what a bucket exposes — adding a scope, adding members, adding a friend — is a destructive-tier action (§6, High). The user sees a named consequence list before confirming. |
| **No silent narrowing of friend keys without notice.** Removing a friend from a bucket is Low-tier with an undo window; the friend is not notified, but the action is logged in the system's own audit view. | Canonical |
| **Color is never the only signal.** Bucket chips pair color with the bucket name and an icon. | Canonical |
| **Fronting status is its own scope.** "Who's fronting right now?" is gated independently from member visibility — a friend may see the system's roster without seeing live fronting state, or vice versa. | Canonical |
| **Field-level gating is exposed in the same UI as member-level.** Field gates do not live in a separate "advanced" surface. | Canonical for v1 |

See reference pattern implementations for a worked example of bucket-aware visibility rules.

---

## 6. Destructive-action tiers

Every destructive action maps to exactly one tier. The tier determines friction and visual treatment.

*The four tiers and their friction rules are **canonical for the current design-system baseline**. Reclassifying an action across tiers is a normal product decision; changing the tier definitions themselves requires a governance update.*

| Tier | Use for | Friction |
| --- | --- | --- |
| **Low** | Reversible actions, minor removals (delete a draft message, remove a tag) | One-tap with snackbar undo for ≥5s |
| **Medium** | Recoverable but meaningful loss (delete a fronting log entry, archive a member) | Confirmation dialog with consequence copy + Cancel + Confirm |
| **High** | Major loss, privacy change, or identity-related deletion (revoke device, change privacy bucket scope) | Confirmation dialog with explicit consequence list, named consequences, 3-second cooldown before Confirm enables |
| **Critical** | Irreversible deletion, data wipe, encryption-key loss, full system deletion | Type-to-confirm (record name) + cooldown + plain-language consequence list + final confirm |

### Tone rules (canonical)

| Avoid | Prefer |
| --- | --- |
| Alarmist warnings ("⚠️ DANGER!") | Clear consequence statements ("This will delete 3 fronting entries.") |
| Shame or blame ("Are you sure you want to lose this?") | Neutral, supportive language ("This can't be undone. Continue?") |
| Vague danger copy ("This is permanent") | Specific description of what changes ("Your sign-in keys on this device will be revoked. You'll be signed out everywhere.") |
| Color-only warning | Icon, label, text, and layout hierarchy together |

See reference pattern implementations for a worked example of confirmation dialogs that enforce these contracts.

In **Littles-safe mode**, tiers Medium / High / Critical are hidden by default. Low-tier actions remain available with extended undo windows.

---

## 7. Voice & content — concrete rules

The voice is calm, respectful, non-clinical, community-aware. Below are the rules that operationalize it. When in conflict with poetic copy elsewhere in this kit, these rules govern.

| Principle | Rule |
| --- | --- |
| Gentle | Use calm language without hiding consequences. Soften the delivery, never the meaning. |
| Non-clinical | Avoid medicalized framing unless the user has chosen it. Default vocabulary is community-led, not diagnostic. |
| User-controlled | Say what the user can choose or change. Surface the lever, don't gesture at "settings". |
| Privacy-aware | Be explicit about who can see what. "Only your system can see this" beats "private". |
| Low-capacity friendly | Prefer short sentences and clear actions. Default to ≤16-word sentences in error/empty/onboarding copy. |
| Nonjudgmental | Avoid implying the user made a mistake when memory, fronting, or identity data is unclear. "We aren't sure who's fronting yet" beats "missing data". |

Casing: sentence case for all UI labels, headings, buttons. No trailing periods on buttons or single-line labels. Oxford comma in prose. No emoji in system-authored UI; user content can include emoji.

---

## 8. Terminology — configurable principle

Plural communities use widely varying preferred vocabulary. The system defines **default terminology for documentation and examples only**; user-facing product language — including assistive labels, screen-reader output, and announcements — must be **terminology-aware** wherever a term appears. The default examples ("member," "fronting," "co-conscious") are illustrative; a system that has chosen "alter," "headmate," "part," or any other term should hear that term back in every surface, including assistive output.

Configurable concepts (canonical list):

| Concept | Notes |
| --- | --- |
| Member / alter / headmate / part / person | Configurable per-system |
| System / collective / self / we | Configurable per-system |
| Fronting / present / active | Configurable per-system |
| Co-fronting / co-conscious / blended / together | Configurable per-system. **Default: "co-conscious"** across the kit's documentation. |
| Little / younger member / young part | Configurable per-system |
| Subsystem / inner group | Configurable per-system |
| Unknown / blurry / not sure | Configurable per-system |
| Origin / how this part formed | Configurable per-system; **off by default** — many systems prefer not to label. |

Components must use terminology hooks provided by the design system to render user-facing text. All user-facing terminology is configurable; components must never hardcode terms. New components are reviewed against this rule.

---

## 9. Scope — what belongs in this design system

The design system has a tight scope. Most "components" called for by product specs do **not** live here.

### The rule (canonical)

> The design system owns **visual primitives** and **interaction primitives** that are domain-agnostic. The product owns any component that takes a Member, Bucket, Fronting record, Recovery key, Innerworld entity, or any other Pluralscape domain entity as a prop.

Domain components are *worked examples* — they serve as reference patterns demonstrating how the primitives compose against real product needs. They are **not** part of the canonical primitive layer.

### What lives in the design system (Canonical primitives)

Foundations, generic inputs, generic display, feedback, navigation chrome, and the brand layer:

| Layer | Primitives |
| --- | --- |
| Foundations | `ThemeProvider`, `Text`, `Box` / `Stack` / `Inline`, `Divider`, `Surface`, `Skeleton` |
| Inputs (generic) | `Button`, `IconButton`, `FAB`, `TextField`, `TextArea`, `Switch`, `Checkbox`, `Radio`, `Select`, `MultiSelect`, `SegmentedControl`, `Slider`, `DatePicker` / `TimePicker`, `ColorSwatchPicker`, `PinPad` |
| Display (generic) | `Avatar`, `AvatarStack`, `Card`, `Badge`, `Chip`, `ListItem`, `Section`, `Tabs`, `Accordion`, `KeyValueRow`, `EmptyState`, `ErrorState`, `ProgressBar` / `ProgressRing`, `MarkdownRenderer` |
| Feedback | `Toast` / `Snackbar`, `Dialog`, `BottomSheet`, `Popover`, `Tooltip`, `Banner`, `LoadingOverlay`, `ConfirmGesture` |
| Nav & Chrome | `BottomTabBar`, `AppHeader`, `NavBackButton`, `Drawer`, `ScreenScaffold`, `PullToRefresh`, `SearchHeader` |
| Brand | Logo, wordmark, type ramp, color tokens, illustration vocabulary, voice rules |

### What lives in the product (Reference patterns, not primitives)

Anything whose semantics depend on a Pluralscape concept:

- **Member-aware:** `MemberCard`, `MemberPicker`, `MultiMemberPicker`, `EntityRefPicker`, `MentionRenderer`, `RelationshipTypePicker`, `RelationshipEdge`
- **Bucket-aware:** `BucketPicker`, `BucketPill`, `EncryptionTierBadge` (T1/T2/T3 carry product meaning)
- **Fronting-aware:** `FrontingChip`, `FrontingTimelineLane`, `ProxyChip`, `LifecycleEventChip`, `CheckInPrompt`
- **Structure / saturation / tags:** `TagPicker`, `SaturationPicker`, `EntityTypePicker`, `InnerworldNode`
- **Recovery / security:** `RecoveryKeyDisplay`, `RecoveryKeyField`, `KeyRotationStepper`
- **Account / system:** `SystemSwitcher`
- **Editors with deep product semantics:** `RichTextField`, `BlockEditor`, `ImagePickerLauncher`, `ImageCropper`, `EmojiPicker`

These compose lower-level primitives but their props, behavior, and copy are product-specific. They live in the UI kit so they can iterate alongside the screens that consume them, without churning the system layer.

### Why this boundary

A design system is stable infrastructure. Changing what a button looks like is a system-wide event; changing what a fronting timeline looks like is a product decision. Conflating the two slows both. This boundary lets the primitive layer stay small, auditable, and stable while the product evolves freely on top.

### Promotion path

A reference pattern *may* be promoted to a primitive if it loses its domain coupling — e.g., a `Stepper` extracted from `KeyRotationStepper` once we've seen it serve other flows. Promotion requires:

1. At least two unrelated product surfaces use the pattern.
2. The component takes no Pluralscape-domain entity in its prop signature.
3. A governance update lists it under §9 above.

---

## 10. Document hygiene

The rules below keep this document consistent and reviewable as the system evolves.

| Risk | Rule |
| --- | --- |
| Overconfident claims | Use the phrasing rules in §2. State the target, document the risks. |
| Too many parallel examples | Mark exactly one as Canonical. Remove the rest unless they serve a different purpose. |
| Aspirational behavior described as complete | Separate intent from baseline. Use the status taxonomy in §1. |
| Poetic language where rules are needed | Convert metaphor into the kind of usage table this document uses. Metaphor is fine in marketing copy and brand intro; not in component contracts. |
| Pattern examples without clear authority | Label every example as Canonical / Reference / Exploratory. |

This document exists to make those rules enforceable. When a contributor proposes a new pattern, the first review question is: "Where does this fit in §1?"
