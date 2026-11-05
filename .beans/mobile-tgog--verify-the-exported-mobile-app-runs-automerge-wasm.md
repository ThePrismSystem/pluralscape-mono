---
# mobile-tgog
title: "Verify the exported mobile app runs: Automerge WASM on Metro web and Hermes"
status: todo
type: bug
priority: high
created_at: 2026-11-05T23:03:17Z
updated_at: 2026-11-05T23:03:17Z
---

The app now bundles, but nothing has run the exported output. Metro treats Automerge's web entry .wasm import as an asset, so the fullfat_bundler entry receives an asset reference instead of a WebAssembly module. Hermes has no WebAssembly, so the base64 entry that native resolves to should fail when sync loads Automerge. Run the exported web and native builds, confirm sync initializes, and choose an Automerge entry or engine that works on each platform.
