---
# ps-3d9b
title: "Settings: Help + About"
status: todo
type: feature
created_at: 2026-05-17T06:47:06Z
updated_at: 2026-05-17T06:47:06Z
parent: ps-6a3x
---

## Goal

Design the Help & support surface (FAQ accordions, contact link, send-diagnostics button) and the About page (version, license, attribution, links).

## Surfaces

- Help: `(app)/settings/help.tsx`
- About: `(app)/settings/about.tsx`

## Required states per surface

- help: default (FAQ accordions), with-search, with-contact-form expanded, with-diagnostic-bundle-pending, with-diagnostic-sent confirmation
- about: default (version, build, commit hash, license, links to ToS / Privacy / Open-source notices), with-update-available banner

## Mode notes

- Littles: simplified — single "Get help" entry pointing to a caregiver-curated resource list
- High-contrast: FAQ accordions use border + label

## Primitives required

- ScreenScaffold, Accordion (ps-ecpl, FAQ), SearchHeader (ps-oylh), TextArea (contact form), Button (send diagnostic), KeyValueRow (ps-5lr6, about metadata), Banner (update available), Link

## Data refs (informational)

- Local app version + build metadata
- Help content: bundled static + remote-overridable
- Diagnostic bundle: local (logs + sync state)

## Required output

- [ ] docs/design-system/preview/settings-help-about.html with both surfaces + states
- [ ] Rationale on diagnostic-bundle UX (what's included, opt-in for system data)

## Out of scope

- RN code (M11), data wiring (M12), the contact backend
