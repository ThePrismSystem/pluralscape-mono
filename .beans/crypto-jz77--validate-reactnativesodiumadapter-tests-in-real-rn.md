---
# crypto-jz77
title: Validate ReactNativeSodiumAdapter tests in real RN environment
status: todo
type: task
priority: normal
created_at: 2026-03-09T05:12:37Z
updated_at: 2026-03-21T10:13:24Z
parent: ps-7j8n
---

Current RN adapter tests mock react-native-libsodium with libsodium-wrappers-sumo (WASM). This covers logic and crypto correctness but doesn't verify JSI binding compatibility. Add RN-environment tests when Expo test runner or similar is set up.
