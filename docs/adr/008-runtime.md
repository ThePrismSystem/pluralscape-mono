# ADR 008: Runtime — Bun with Node.js Fallback

## Status

Accepted

## Context

The API server needs a JavaScript/TypeScript runtime. The runtime choice affects:

- Self-hosting simplicity (single binary vs. runtime + dependency installation)
- Performance at scale
- Built-in capabilities (SQLite, WebSocket support)
- Ecosystem compatibility

## Decision

**Bun** as the primary runtime, with **Node.js** maintained as a compatible fallback.

Key factors:

- **Single binary compilation**: `bun build --compile` produces a self-contained executable (~96MB including runtime). Combined with embedded SQLite, self-hosters can deploy a single file — no runtime installation, no `node_modules`.
- **Built-in SQLite**: Bun has native SQLite support, eliminating the need for `better-sqlite3` native compilation.
- **Performance**: Faster startup and HTTP throughput than Node.js in benchmarks.
- **Hono compatibility**: Hono runs on both Bun and Node.js with no code changes. If Bun stability becomes a concern at 500K scale, switching to Node.js requires only a deployment change, not a code change.

## Consequences

- Bun's ecosystem is younger than Node.js — some npm packages may have edge-case incompatibilities
- The 96MB binary size (bundled Bun runtime) is larger than compiled-language alternatives but acceptable for server deployment
- Must avoid Bun-specific APIs in application code to maintain Node.js fallback compatibility
- CI should test against both Bun and Node.js

### License

Bun: MIT (LGPL-2.1 for JavaScriptCore, non-issue as a runtime dependency). Node.js: MIT. Both compatible with AGPL-3.0.
