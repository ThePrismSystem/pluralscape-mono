---
# types-puxp
title: Journal and wiki types
status: todo
type: task
priority: normal
created_at: 2026-03-08T14:03:31Z
updated_at: 2026-03-08T14:22:02Z
parent: types-im7i
blocked_by:
  - types-av6x
---

JournalPage, JournalBlock, and WikiPage types for block-based rich text editor

## Scope

- `JournalEntry`: id (JournalEntryId), systemId, title, blocks (JournalBlock[]), createdAt, updatedAt, authorMemberId (nullable)
- `JournalBlock`: id, type (BlockType), content (string), children (JournalBlock[] — nested), metadata (block-type-specific)
- `BlockType`: 'paragraph' | 'heading' | 'list' | 'quote' | 'code' | 'image' | 'divider' | 'member-link' | 'entity-link'
- `WikiPage`: id (WikiPageId), systemId, title, slug (URL-safe), blocks (JournalBlock[]), linkedFromPages (WikiPageId[]), createdAt, updatedAt
- `EntityLink`: { entityType: EntityType, entityId: string, displayText: string } — for hyperlinked member names and other entities
- Replaces basic Notes for power users; Notes remain for simple use (features.md section 7)
- Rich text blocks support nested structure for complex content

## Acceptance Criteria

- [ ] JournalEntry type with block array
- [ ] JournalBlock supports nesting (recursive children)
- [ ] All 9 block types defined
- [ ] WikiPage with slug and backlinks
- [ ] EntityLink for member/entity hyperlinking
- [ ] Block metadata varies by type (type-safe discriminated union)
- [ ] Unit tests for block nesting and entity link construction

## References

- features.md section 7 (Journaling)

## Audit Findings (002)

- JournalEntry missing `tags`/`categories` for organization
- JournalEntry missing link to fronting session (who was fronting when written)
- WikiPage missing `archived`/`archivedAt` field
