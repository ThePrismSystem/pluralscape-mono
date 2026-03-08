# License Compatibility Audit — AGPL-3.0

**Date**: 2026-03-08

## Summary

All dependencies in the accepted tech stack are compatible with AGPL-3.0. One substitution was made (Valkey over Redis) to avoid licensing complexity.

## Audit Results

| Technology            | License                       | AGPL-3.0 Compatible | Notes                                                        |
| --------------------- | ----------------------------- | ------------------- | ------------------------------------------------------------ |
| Expo                  | MIT                           | Yes                 |                                                              |
| React Native          | MIT                           | Yes                 | Re-licensed from BSD+Patents to MIT in 2018                  |
| Hono                  | MIT                           | Yes                 |                                                              |
| Bun                   | MIT                           | Yes                 | LGPL-2.1 for JavaScriptCore (runtime dependency, not linked) |
| tRPC                  | MIT                           | Yes                 |                                                              |
| PostgreSQL            | PostgreSQL License (BSD-like) | Yes                 | Separate process, accessed over network                      |
| Drizzle ORM           | Apache 2.0                    | Yes                 | One-way compatible with AGPL-3.0                             |
| SQLite                | Public Domain                 | Yes                 | CC0 in jurisdictions without public domain                   |
| SQLCipher (Community) | BSD 3-Clause                  | Yes                 | Requires attribution. Use Community Edition only             |
| libsodium             | ISC                           | Yes                 |                                                              |
| Automerge             | MIT                           | Yes                 | Rust core + WASM bindings both MIT                           |
| Valkey                | BSD 3-Clause                  | Yes                 | Drop-in Redis replacement, Linux Foundation                  |
| BullMQ                | MIT                           | Yes                 | Valkey-backed job queue                                      |
| MinIO                 | AGPL-3.0                      | Yes                 | S3-compatible object storage, same license as Pluralscape    |
| Node.js               | MIT                           | Yes                 | Fallback runtime                                             |

## Rejected Dependencies (License Concerns)

| Technology       | License                                | Issue                                                                                    |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Redis 7.4-7.x    | RSALv2 / SSPLv1                        | Neither is OSI-approved or AGPL-compatible. Replaced with Valkey                         |
| Redis 8+         | RSALv2 / SSPLv1 / AGPLv3 (tri-license) | AGPLv3 option is compatible, but Valkey is simpler                                       |
| PowerSync Server | FSL-1.1-ALv2                           | Not open source, not AGPL-compatible for distribution. Client SDKs (Apache 2.0) are fine |

## Methodology

Licenses verified via official GitHub repositories, npm package metadata, and project documentation. GNU license compatibility list consulted for copyleft interactions.
