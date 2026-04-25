---
# types-u87m
title: ServerInternal<T> marker for denormalized server-only fields
status: completed
type: task
priority: normal
created_at: 2026-04-24T22:55:29Z
updated_at: 2026-04-25T05:48:22Z
parent: types-ltel
---

Follow-up from PR #557 review (types-2k7g).

## Problem

Some `*ServerMetadata` types include denormalized fields the server fills after write but are not part of the encrypted payload and have no client-facing peer in the plaintext-only domain type. Example: `FrontingCommentServerMetadata.sessionStartTime`. These force hand-rolled `*Result` types that can't collapse to `EncryptedWire<T>` because the wire drops them.

## Scope

- Introduce a `ServerInternal<T>` marker type in `@pluralscape/types` (e.g. `T & { readonly [__serverInternal]: true }`).
- Mark `sessionStartTime` in `FrontingCommentServerMetadata` (plus any sibling denorm fields surfaced by an audit of the remaining hand-rolled `*Result` types).
- Update `EncryptedWire<T>` to auto-`Omit` all `ServerInternal<…>`-marked fields.
- Collapse `FrontingCommentResult` (and any other newly-unblocked types) to `EncryptedWire<…>`.

## Acceptance

- Every retained hand-rolled `*Result` either has a non-`ServerInternal` divergence from its `ServerMetadata` source, or is collapsed to `EncryptedWire<…>`.
- Added field-level audit listing each retained divergence with rationale.

## Summary of Changes

- Introduced ServerInternal<T> marker in @pluralscape/types
- Modified EncryptedWire<T> to strip top-level ServerInternal-marked fields
- Extended Serialize<T> to strip ServerInternal-marked fields recursively for parity coherence
- Marked FrontingComment.sessionStartTime as ServerInternal<UnixMillis>
- Lifted Drizzle frontingComments.sessionStartTime to the same brand
- Collapsed FrontingCommentResult to EncryptedWire<FrontingCommentServerMetadata>
- Added field-level audit (docs/local-audits/2026-04-24-hand-rolled-result-audit.md, gitignored)
- Updated ADR-023 with ServerInternal convention
