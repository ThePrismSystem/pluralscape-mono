# @pluralscape/import-sp

Simply Plural import engine — pure data layer.

Parses Simply Plural JSON exports or Simply Plural API responses, validates with Zod, maps every collection to Pluralscape entities, and drives a resumable, idempotent import via a pluggable `Persister`.

This package is **mobile-only-compatible** — no Node streams, no `fs` outside the dev script, no React. The mobile glue (Expo SecureStore for tokens, file picker for exports, encrypted SQLite persister) lives in `apps/mobile/src/features/import-sp/` and is built in Plan 3.

See `docs/planning/2026-04-08-simply-plural-import.md` for the full design.
