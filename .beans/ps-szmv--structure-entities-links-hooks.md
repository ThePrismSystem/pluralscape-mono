---
# ps-szmv
title: Structure entities & links hooks
status: completed
type: feature
priority: normal
created_at: 2026-04-01T00:12:01Z
updated_at: 2026-04-04T10:27:30Z
parent: ps-yspo
---

Nodes, edges, CRUD, relationship traversal

Uses trpc.structure.\* for nodes, edges, CRUD, and relationship traversal.

## Summary of Changes

Implemented 6 hook files with transforms and tests:

- use-structure-entity-types.ts (encrypted CRUD, 7 hooks)
- use-structure-entities.ts (encrypted CRUD + hierarchy, 8 hooks)
- use-structure-links.ts (unencrypted, 4 hooks)
- use-structure-member-links.ts (unencrypted, 3 hooks)
- use-structure-associations.ts (unencrypted, 3 hooks)
- use-relationships.ts (partial encryption, 7 hooks)

3 transforms: structure-entity-type, structure-entity, relationship
6 test files with 48 tests total
