---
# crypto-t515
title: Mobile key lifecycle specification
status: todo
type: task
priority: critical
created_at: 2026-03-09T12:13:16Z
updated_at: 2026-03-09T12:14:20Z
parent: crypto-gd8f
blocking:
  - ps-7j8n
---

Create a key lifecycle spec for mobile: when MasterKey is derived, where it's stored (Keychain on iOS, Keystore on Android), when it's cleared, app background/foreground transition behavior. Investigate react-native-quick-crypto or native bindings for secure memzero. Current polyfill (buffer.fill(0)) can be optimized away by Hermes. Make this a prerequisite for apps/mobile implementation.

Source: Architecture Audit 004, Fix This Now #3 & Metric 1
