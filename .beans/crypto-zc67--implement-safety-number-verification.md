---
# crypto-zc67
title: Implement Safety Number verification
status: todo
type: feature
priority: high
created_at: 2026-03-09T12:13:19Z
updated_at: 2026-03-09T12:14:19Z
parent: crypto-gd8f
blocking:
  - ps-qcfr
---

Implement Safety Number verification (Ed25519 public key fingerprint comparison) for out-of-band identity verification. Without this, self-hosted instances are vulnerable to MITM by malicious admins substituting fake public keys on initial key exchange (TOFU). Must ship before any self-hostable build.

Source: Architecture Audit 004, Metric 1
