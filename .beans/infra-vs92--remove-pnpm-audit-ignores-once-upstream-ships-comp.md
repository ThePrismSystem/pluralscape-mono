---
# infra-vs92
title: Remove pnpm audit ignores once upstream ships compatible fixes
status: todo
type: task
created_at: 2026-11-05T13:40:42Z
updated_at: 2026-11-05T13:40:42Z
---

pnpm-workspace.yaml auditConfig.ignoreGhsas holds 7 advisories with no patched version inside current ranges: decode-uri-component (expo-router 55 → query-string 7), image-size (metro), zod 3 (@expo/cli), glob 13 (@expo/config), minimatch 10 (eslint). Drop each entry as its parent ships a compatible fix; the Expo SDK upgrade clears the expo-router/@expo/cli ones.

- [ ] decode-uri-component (GHSA-qr28-fpjm-wq7f, GHSA-vcc3-ghjq-m6fr) — Expo SDK upgrade
- [ ] image-size (GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr) — metro moves to image-size 2
- [ ] zod 3 (GHSA-mrhx-c7xc-m3w5) — @expo/cli moves off zod 3
- [ ] glob (GHSA-3g3m-2fjr-6pw4) — @expo/config moves to glob 14
- [ ] minimatch (GHSA-g3hv-75wg-m249) — eslint moves to minimatch 11
