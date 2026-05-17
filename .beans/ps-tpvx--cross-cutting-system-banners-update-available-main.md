---
# ps-tpvx
title: "Cross-cutting: System banners (update-available, maintenance, breaking-change)"
status: todo
type: feature
priority: normal
created_at: 2026-05-17T06:51:15Z
updated_at: 2026-05-17T07:42:08Z
parent: ps-k8mz
blocked_by:
  - ps-5920
---

## Goal

Design the top-of-app system banner surfaces for: update available, server maintenance, breaking-change advisory.

## Surfaces

- Update-available banner (with "update now" CTA → app store).
- Forced-update gate (full-screen, no dismiss).
- Maintenance window banner (with countdown).
- Breaking-change advisory banner (with link to changelog).

## Required states per surface

- Default (dismissible).
- Persistent (not dismissible).
- With countdown.
- Submitting (forced-update only — checking version).

## Mode notes

- Default mode only.
- Reduced-motion: no banner slide-in — noted for Phase 3.

## Primitives required

- Banner primitive.
- Modal overlay (forced-update only).
- Button.

## Data refs (informational)

- packages/api-client `/system/status` endpoint (if exists; otherwise informational).

## Required output

- HTML mockup of all banner variants in docs/design-system/preview/cross-cutting/system-banners.html.
- Decision notes: dismiss persistence rules, forced-update threshold.

## Out of scope

- RN implementation (M11).
- App store deep-link plumbing (M11).
