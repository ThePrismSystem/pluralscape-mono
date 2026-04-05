---
# ps-8i24
title: Fix All Branding & Logo Audit Findings
status: completed
type: feature
priority: normal
created_at: 2026-04-05T21:04:10Z
updated_at: 2026-04-05T21:19:30Z
---

Resolve 9 branding audit issues: color mismatch, a11y metadata, dimension normalization, text-to-path, light variant, rasterized exports, React Native component, SVGO optimization

## Summary of Changes

### Phase 1: Direct SVG & Doc Edits

- Fixed color mismatch `#b9aaca` → `#b8a9c9` across all SVGs (18 occurrences)
- Added `role="img"`, `aria-labelledby="title"`, `<title>`, and `<desc>` to all 4 SVGs
- Normalized regular wordmark viewBox from `0 0 400 120` to `0 0 400 130`, dimensions from `800x240` to `800x260`, and repositioned icon/text

### Phase 2: Text-to-Path Conversion

- Downloaded DM Sans Light (300) TTF via fontsource CDN
- Wrote opentype.js script to convert "Pluralscape" text to SVG path data
- Replaced `<text>` elements with `<path>` in both wordmark SVGs — no font dependency

### Phase 3: Light-Background Variant

- Created `pluralscape-wordmark-light.svg` with darkened colors for light surfaces
- Colors: Deep Space Blue nodes, Dark Lavender accents, Dark Teal active, `wml_` gradient prefix

### Phase 4: Rasterized Exports

- Generated icon PNGs at 16/32/64/128/192/512/1024px
- Generated wordmark-dark PNGs at 480w/800w
- Copied 1024px icon to `apps/mobile/assets/icon.png`
- Added `"icon"` field to `apps/mobile/app.json`

### Phase 5: React Native Component

- Created `PluralscapeLogo.tsx` with `variant` (icon/wordmark), `size`, and `accessibilityLabel` props
- Uses `react-native-svg` primitives with embedded path data
- Barrel export from `components/brand/index.ts`
- Installed `react-native-svg` dependency

### Phase 6: SVGO Optimization

- Ran SVGO on all 4 SVGs preserving `<title>`, `<desc>`, and gradient IDs

### BRANDING.md Updates

- Added Rose exclusion note under Logo > Concept
- Updated file list with all variants and PNG directory
- Added gradient ID namespace convention
- Added light-variant color table
- Added small-size rendering guidance
