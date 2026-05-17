---
# ps-6g36
title: "Audit: Screen → tRPC router parity (41 routers)"
status: todo
type: task
created_at: 2026-05-17T06:52:27Z
updated_at: 2026-05-17T06:52:27Z
parent: ps-oqs8
---

## Goal

Audit Phase 1 + Phase 2 design coverage against every tRPC router in apps/api/src/trpc/routers/ (41 routers). Every router's user-facing operations must map to at least one designed surface. Every undesigned operation either spawns a bean or is documented as backend-only.

## Method

1. Enumerate routers: `ls apps/api/src/trpc/routers/*.ts` → 41 entries.
2. For each router, list the procedures and classify each:
   - **User-facing** (needs UI design).
   - **Backend-internal** (used by sync, server-to-server — no UI needed).
   - **Devtools-only** (debug routes — no design required).
3. For each user-facing procedure, map to the designed surface (or note "no surface — gap").
4. For every gap, create a follow-up bean.

## Required output

- Audit report at docs/superpowers/audits/2026-XX-XX-router-screen-parity.md.
- Mapping table: rows = procedures, columns = classification + designed-surface-bean-id.
- For each gap: a new bean titled "Surface: <router>.<procedure>" parented to the most-relevant Phase 2 domain epic.
- This bean's `## Summary of Changes` includes the full mapping table + spawned bean IDs.

## Out of scope

- REST parity (separate concern — `pnpm trpc:parity` covers this).
- RN implementation (M11).
