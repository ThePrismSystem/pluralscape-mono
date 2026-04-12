---
# ps-owbo
title: "F-010: listCollections return type widening"
status: completed
type: task
priority: low
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-11T21:32:04Z
parent: ps-n0tq
---

api-source.ts listCollections() returns string[] not SpCollectionName[]. Intentional for unknown-collection detection. No action needed.

## Summary of Changes

Enriched the inline comment on `file-source.listCollections()` to explain that the `string[]` return type is intentional: the whole point of the method is to let the engine detect collection names the importer does not recognise (so it can emit `dropped-collection` warnings). Narrowing to `SpCollectionName[]` would require filtering unknown names out here, defeating the purpose. No functional change.
