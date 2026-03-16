# ADR 023: Zod and TypeScript type alignment strategy

## Status

Accepted

## Context

`packages/types` is a zero-dependency pure TypeScript package that defines all domain types. The codebase needs runtime validation at API boundaries (request bodies, job payloads, webhook inputs) but has none today — four extensibility points use `Record<string, unknown>`, blocking meaningful runtime validation.

Three options were considered:

1. **Zod-first (infer types from schemas)** — requires Zod as a dependency of `packages/types` (breaks zero-dep policy) or a massive migration rewriting all 40 source files.
2. **Code-gen (`ts-to-zod`)** — cannot handle branded types (`Brand<T, B>`), `Encrypted<T>`, or `ServerSafe<T>` without extensive manual overrides. Maintenance burden exceeds hand-writing.
3. **Shared validation package (hand-written schemas, contract-tested)** — TypeScript stays as source of truth. A new `packages/validation` package contains Zod schemas for boundary types only. Compile-time and runtime contract tests verify alignment.

## Decision

Create `packages/validation` with hand-written Zod v4 schemas for boundary types only (Option 3).

- **TypeScript remains the source of truth.** Types are defined in `packages/types` and never generated from Zod schemas.
- **Schemas live in `packages/validation`**, which depends on both `zod` and `@pluralscape/types`.
- **Contract tests** use `expectTypeOf` (compile-time) and `safeParse` (runtime) to verify that each schema's inferred type matches the canonical TypeScript interface.
- **Branded type helpers** (`brandedString`, `brandedNumber`) centralize the one warranted `z.custom<Brand<T, B>>()` call so individual schemas stay assertion-free.
- **Scope is boundary types only** — API request/response shapes, job payloads, webhook bodies, notification data. Internal domain types that never cross a trust boundary do not need schemas.

## Consequences

**Easier:**

- Runtime validation at API boundaries with meaningful error messages.
- tRPC router input schemas can import from `packages/validation` directly.
- `packages/queue` can validate job payloads at enqueue time using the same schemas.
- Bean `types-yk6p` (contract tests) is unblocked.

**Harder:**

- Adding a new boundary type requires updating both the TypeScript interface and the Zod schema (two places). Contract tests catch drift, but the duplication is inherent to Option 3.
- Developers must remember to write schemas for new boundary types. A lint rule or PR checklist can mitigate this.
