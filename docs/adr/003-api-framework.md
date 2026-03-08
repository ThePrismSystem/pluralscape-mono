# ADR 003: API Framework — Hono on Bun with tRPC + REST

## Status

Accepted

## Context

The API must support:

- 17+ endpoint categories (identity management, fronting logs, chat, friends, privacy buckets, polls, webhooks)
- Real-time capabilities (WebSockets for chat and fronting updates)
- Self-hosting as a single binary or Docker container
- Type safety with the Expo/React Native frontend
- Public API for third-party integrations (CLI tools, Discord bots, community extensions)
- Scale to 500K users

Evaluated: Hono, Fastify, NestJS, Elixir/Phoenix. Also evaluated tRPC as a complementary layer.

## Decision

**Hono** as the HTTP framework, running on **Bun**, with a hybrid API approach:

- **tRPC** for internal frontend ↔ backend communication (type-safe, zero runtime overhead)
- **REST** endpoints for the public API, webhooks, and third-party integrations

Key factors:

- **Hono**: ~14KB, runs on Bun/Node/Deno/edge. Built-in WebSocket helper. Most portable option.
- **tRPC**: End-to-end type safety with the Expo frontend. Eliminates API contract drift. Works as a layer on top of Hono.
- **REST public API**: Third-party developers, CLI tools, and Discord bots need standard HTTP endpoints, not tRPC. The hybrid approach (tRPC internal + REST public) is the current best practice.
- **Self-hosting**: `bun build --compile` produces a single binary (~96MB with runtime). Simplest possible deployment.

Rejected alternatives:

- **Fastify**: Solid but Node-only, less portable than Hono.
- **NestJS**: Heavy abstraction layer, harder to security-audit, overkill for this project.
- **Elixir/Phoenix**: Best real-time performance (2M concurrent WebSockets proven), but adds a second language/runtime. Only justified if WebSocket scale becomes a bottleneck TypeScript cannot handle.

## Consequences

- Hono's ecosystem is younger than Fastify/NestJS — fewer battle-tested plugins
- WebSocket support is basic compared to Phoenix Channels (no built-in pub/sub or presence tracking) — requires Valkey for horizontal scaling
- tRPC couples frontend and backend TypeScript tightly — external clients must use REST endpoints
- Bun runtime is the primary target; Node.js compatibility maintained as a fallback

### License

Hono: MIT. tRPC: MIT. Bun: MIT (LGPL-2.1 for JavaScriptCore, non-issue as runtime). All compatible with AGPL-3.0.
