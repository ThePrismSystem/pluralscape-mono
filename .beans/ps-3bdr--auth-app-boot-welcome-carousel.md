---
# ps-3bdr
title: "Auth: App boot + welcome carousel"
status: todo
type: feature
created_at: 2026-05-17T06:33:03Z
updated_at: 2026-05-17T06:33:03Z
parent: ps-nwju
---

## Goal

Design the first-paint surfaces: splash boot gate and welcome carousel (privacy / your-terms / your-community pillars + sign-in vs sign-up fork).

## Surfaces

- Splash: `(boot)/index.tsx` — decision tree (logged-in → home, locked → PIN/biometric, fresh → welcome)
- Welcome carousel: `(auth)/welcome.tsx` — 3-slide pillars + final CTA pair

## Required states per surface

- splash: bootstrapping, fork-decision (each branch shown briefly), error-fallback
- carousel: each slide, paginator dots, language switcher visible

## Mode notes

- Littles: simplified single-screen welcome, no carousel slides — direct "Sign in" / "Get started" buttons
- Static / reduced-motion: shimmer animation disabled

## Primitives required

- ScreenScaffold, PluralscapeLogo, Button, Pagination dots (Skeleton variant or its own atom)

## Data refs (informational)

- None — splash uses local session + key derivation gate; welcome is i18n-only

## Required output

- [ ] docs/design-system/preview/auth-boot-welcome.html with all states
- [ ] Rationale notes on first-paint decision tree

## Out of scope

- RN code (M11), data wiring (M12), mode coverage beyond above (Phase 3)
