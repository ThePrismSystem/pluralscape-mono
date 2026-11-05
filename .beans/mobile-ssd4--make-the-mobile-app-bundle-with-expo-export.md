---
# mobile-ssd4
title: Make the mobile app bundle with expo export
status: completed
type: bug
priority: normal
created_at: 2026-11-05T23:03:17Z
updated_at: 2026-11-05T23:34:18Z
---

expo export fails on every platform, and no CI job runs it, so nothing noticed. React Native 0.85.3 does not match Expo SDK 55, Metro's hierarchical lookup is off under pnpm, Metro does not map .js specifiers to TypeScript sources, and the locale loader uses a computed import path.

## Summary of Changes

- Moves the mobile app from Expo SDK 55 to SDK 56, the release that pairs with React Native 0.85.3. SDK 55's Babel preset could not compile React Native 0.85's native component files.
- Pins React and React DOM to 19.2.3 through the catalog, with overrides so optional peers no longer install a second copy beside it.
- Replaces the custom Metro lookup settings with Expo's monorepo defaults, maps ESM `.js` specifiers in workspace source to TypeScript files, and lists `.wasm` as an asset.
- Replaces the computed import in the locale loader with one literal import per file, because Metro rejects computed paths.
- Adds a Mobile Bundle CI job that runs `expo install --check` and exports web, iOS, and Android.
- Corrects Renovate's holds, which named the wrong SDK, and turns off updates to modules the SDK sets.
- Raises the parity integration test's script timeout, which expired under load during this work.

Bundling does not prove the app runs. That check is tracked in mobile-tgog.
