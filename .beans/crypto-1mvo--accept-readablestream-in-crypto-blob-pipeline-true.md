---
# crypto-1mvo
title: Accept ReadableStream in crypto blob pipeline (true streaming)
status: todo
type: task
priority: high
created_at: 2026-04-20T09:22:51Z
updated_at: 2026-04-20T09:22:51Z
parent: crypto-cpir
---

Finding [PERF-1] from audit 2026-04-20. packages/crypto/src/blob-pipeline/encrypt-blob.ts:40, packages/crypto/src/symmetric.ts:76-96. encryptStream receives complete Uint8Array; 'streaming' is chunked-in-memory only. Fix: accept ReadableStream / AsyncIterable<Uint8Array> for true backpressure.
