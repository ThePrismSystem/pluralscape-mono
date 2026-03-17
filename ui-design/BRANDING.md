# Pluralscape Brand Guidelines — "Inner Horizons"

## Brand Identity

**Concept**: Inner Horizons — an expansive, ethereal visual language that evokes the vastness of inner worlds, constellations of connected identities, and the peaceful depth of a system's inner landscape.

**Mood**: Stargazing, ethereal calm, vast inner landscape, dreamy but grounded.

---

## Logo

### Concept
A constellation of connected nodes — 6 dots of varying sizes linked by thin gradient lines. Each node represents a member/identity within a system. The varying sizes and colors express individuality; the connecting lines express relationships and co-consciousness. The overall shape is organic and asymmetric, like a real constellation.

### Files
- `logo/pluralscape-icon.svg` — Icon only, suitable for app icons, favicons
- `logo/pluralscape-wordmark.svg` — Icon + "Pluralscape" wordmark, for headers, splash screens

### Usage Rules
- Minimum clear space: 1x the height of the largest node on all sides
- Minimum size: 32px for icon-only, 120px wide for wordmark variant
- Always display on dark backgrounds (Deep Space Blue or darker)
- Never stretch, rotate, or recolor individual nodes
- Never add drop shadows or outlines — the logo has its own glow

---

## Color System

### Primary Palette

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| **Base** | Deep Space Blue | `#0f0f23` | App background, primary surfaces |
| **Primary** | Soft Lavender | `#b8a9c9` | Primary actions, interactive elements, links |
| **Active** | Sky Teal | `#7ecbc0` | Active/fronting states, success indicators, toggles |
| **Intimate** | Pale Rose | `#d4a5b5` | Personal/intimate elements, member-specific accents |
| **Text** | Moonlight | `#e8e4f0` | Primary text, icons on dark surfaces |

### Extended Palette

| Role | Name | Hex | Usage |
|------|------|-----|-------|
| Surface Elevated | Space Mist | `#181833` | Cards, modals, elevated surfaces |
| Surface Subtle | Nebula | `#12122a` | Subtle background differentiation |
| Text Secondary | Dim Moonlight | `#a8a4b8` | Secondary text, captions, placeholders |
| Text Muted | Stardust | `#6b6780` | Disabled text, hints |
| Border | Twilight | `#2a2a4a` | Subtle borders, dividers |
| Border Focus | Lavender Bright | `#c9bcda` | Focus rings, active borders |
| Error | Soft Crimson | `#d4626e` | Error states, destructive actions |
| Warning | Pale Amber | `#d4b05a` | Warning states, caution indicators |

### Accessibility Contract (WCAG AA Verified)

All text/background combinations have been verified against WCAG 2.1 AA standards.

**Dark text on dark background (primary use case):**

| Foreground | Background | Ratio | AA Normal | AA Large |
|------------|------------|-------|-----------|----------|
| Moonlight `#e8e4f0` | Deep Space Blue `#0f0f23` | 15.08:1 | PASS | PASS |
| Soft Lavender `#b8a9c9` | Deep Space Blue `#0f0f23` | 8.59:1 | PASS | PASS |
| Sky Teal `#7ecbc0` | Deep Space Blue `#0f0f23` | 10.06:1 | PASS | PASS |
| Pale Rose `#d4a5b5` | Deep Space Blue `#0f0f23` | 8.85:1 | PASS | PASS |

**Dark text on colored surfaces (buttons, badges):**

| Foreground | Background | Ratio | AA Normal | AA Large |
|------------|------------|-------|-----------|----------|
| Deep Space Blue `#0f0f23` | Soft Lavender `#b8a9c9` | 8.59:1 | PASS | PASS |
| Deep Space Blue `#0f0f23` | Sky Teal `#7ecbc0` | 10.06:1 | PASS | PASS |
| Deep Space Blue `#0f0f23` | Pale Rose `#d4a5b5` | 8.85:1 | PASS | PASS |
| Deep Space Blue `#0f0f23` | Moonlight `#e8e4f0` | 15.08:1 | PASS | PASS |

### Color Rules

1. **Dark backgrounds only** for the base app experience — this is dark-mode-first
2. **Light text on dark surfaces**: Use Moonlight for primary text, Dim Moonlight for secondary
3. **Dark text on colored surfaces**: Always use Deep Space Blue text on lavender, teal, rose, or moonlight buttons/badges
4. **Never place light text on colored surfaces** — Moonlight on Lavender (1.76:1) and Moonlight on Teal (1.50:1) both fail WCAG AA
5. **Semantic color mapping**: Teal = active/fronting/success, Lavender = primary/interactive, Rose = personal/intimate, Amber = warning, Crimson = error

---

## Typography

### Font Stack

| Priority | Font | Fallback | Usage |
|----------|------|----------|-------|
| Primary | DM Sans | Inter, -apple-system, sans-serif | All UI text |
| Monospace | JetBrains Mono | Fira Code, monospace | Code, timestamps, IDs |

DM Sans was selected for its light, airy quality that matches the ethereal mood while remaining highly readable at small sizes. Use the Light (300) and Regular (400) weights primarily, Medium (500) for emphasis.

### Type Scale

| Level | Size | Weight | Line Height | Letter Spacing | Color |
|-------|------|--------|-------------|----------------|-------|
| Display | 32px / 2rem | Light (300) | 1.2 | +0.5px | Moonlight |
| Heading 1 | 24px / 1.5rem | Regular (400) | 1.3 | +0.3px | Moonlight |
| Heading 2 | 20px / 1.25rem | Medium (500) | 1.3 | +0.2px | Moonlight |
| Heading 3 | 16px / 1rem | Medium (500) | 1.4 | +0.1px | Moonlight |
| Body | 16px / 1rem | Regular (400) | 1.5 | 0 | Moonlight |
| Body Small | 14px / 0.875rem | Regular (400) | 1.5 | 0 | Dim Moonlight |
| Caption | 12px / 0.75rem | Regular (400) | 1.4 | +0.2px | Stardust |
| Label | 12px / 0.75rem | Medium (500) | 1.2 | +0.5px | Dim Moonlight |

### Mobile Adjustments
- Display: 28px
- Heading 1: 22px
- Body: 16px (unchanged — already optimized for mobile readability)
- Minimum touch-target text: 14px

---

## Spacing & Layout

### Spacing Scale (8px base)

| Token | Value | Usage |
|-------|-------|-------|
| `space-xs` | 4px | Tight internal padding, icon gaps |
| `space-sm` | 8px | Default inner padding, compact gaps |
| `space-md` | 16px | Standard padding, section gaps |
| `space-lg` | 24px | Card padding, section separation |
| `space-xl` | 32px | Major section separation |
| `space-2xl` | 48px | Page-level separation |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 6px | Small elements (badges, chips) |
| `radius-md` | 12px | Buttons, inputs, cards |
| `radius-lg` | 16px | Modals, larger containers |
| `radius-full` | 9999px | Avatars, circular elements |

---

## Component Patterns

### Buttons

**Primary**: Soft Lavender background, Deep Space Blue text, `radius-md`
- Hover: Lighten lavender 10%
- Active: Darken lavender 5%
- Disabled: 40% opacity

**Secondary**: Transparent background, Moonlight 1px border, Moonlight text
- Hover: Moonlight at 10% opacity fill
- Active: Moonlight at 15% opacity fill

**Danger**: Soft Crimson background, Moonlight text
- Use sparingly — only for irreversible destructive actions

### Cards

- Background: Space Mist `#181833`
- Border: 1px Twilight `#2a2a4a`
- Padding: `space-lg` (24px)
- Border radius: `radius-md` (12px)
- Subtle inner glow on hover (optional)

### Badges / Status Indicators

- **Fronting**: Sky Teal background, Deep Space Blue text
- **Co-fronting**: Sky Teal outline, Sky Teal text
- **Member tag**: Soft Lavender background, Deep Space Blue text
- **Custom front**: Pale Rose background, Deep Space Blue text

### Navigation (Bottom Tab Bar — Mobile)

- Background: Deep Space Blue with subtle top border (Twilight)
- Inactive icons: Stardust `#6b6780`
- Active icon: Soft Lavender `#b8a9c9`
- Active indicator: Small lavender dot below icon (not a full highlight bar)

### Toggles & Switches

- Off: Twilight track, Stardust thumb
- On: Sky Teal track, Moonlight thumb
- Track border radius: `radius-full`

---

## Iconography

- Style: Outlined, 1.5px stroke weight (Material Symbols Rounded or equivalent)
- Size: 24px default, 20px compact, 28px emphasis
- Color: Inherits from text color context (Moonlight on dark, Deep Space Blue on colored)
- Active: Filled variant of the same icon, in Soft Lavender

---

## Motion & Animation

- **Duration**: 150ms for micro-interactions, 250ms for transitions, 400ms for page-level
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (Material ease-in-out)
- **Philosophy**: Gentle, never jarring. Transitions should feel like drifting between states, not snapping. The "Inner Horizons" mood means motion should evoke floating, not bouncing.
- **Reduce motion**: Respect `prefers-reduced-motion` — replace animations with instant state changes

---

## Imagery & Illustrations

- **Style**: Soft gradients, constellation motifs, translucent layering
- **Avoid**: Hard edges, harsh shadows, clinical/medical imagery, bright neon
- **Placeholder avatars**: Gradient circles using palette colors (never generic silhouettes)
- **Empty states**: Subtle constellation illustrations with encouraging copy

---

## Voice & Tone (Visual Complement)

The visual language reinforces the project's verbal tone:
- **Calm, not clinical**: The ethereal palette avoids sterile whites and harsh blues
- **Inclusive, not childish**: Soft colors without being pastel-saccharine
- **Empowering, not pitying**: The constellation metaphor frames plurality as a network of strength
- **Private, not secretive**: Deep space blue feels sheltering, not hiding

---

## Dark Mode Notes

This is a **dark-mode-first** application. A light mode may be added later but is not a priority. All design decisions assume dark backgrounds.

If light mode is eventually added:
- Invert the base/text relationship (use a warm off-white base, Deep Space Blue text)
- Colored accents (lavender, teal, rose) may need darkened variants for contrast
- Re-verify all contrast ratios against the light base
