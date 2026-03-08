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

JournalPage, JournalBlock, and WikiPage types for block-based rich text editor.

## Scope

- `JournalEntry`: id (JournalEntryId), systemId, title, blocks (JournalBlock[]), tags (string[] — for organization/categorization), frontingSessionId (FrontingSessionId | null — links to who was fronting when written), authorMemberId (nullable), archived (boolean), archivedAt (UnixMillis | null), createdAt, updatedAt
- `JournalBlock`: discriminated union on type:
  - `ParagraphBlock`: type 'paragraph', content (string)
  - `HeadingBlock`: type 'heading', content (string), level (1-6)
  - `ListBlock`: type 'list', items (string[]), ordered (boolean)
  - `QuoteBlock`: type 'quote', content (string)
  - `CodeBlock`: type 'code', content (string), language (string | null)
  - `ImageBlock`: type 'image', blobId (BlobId), caption (string | null)
  - `DividerBlock`: type 'divider'
  - `MemberLinkBlock`: type 'member-link', memberId (MemberId), displayText
  - `EntityLinkBlock`: type 'entity-link', entityType (EntityType), entityId (string), displayText
    All variants share: id, children (JournalBlock[] — nested)
- `WikiPage`: id (WikiPageId), systemId, title, slug (URL-safe), blocks (JournalBlock[]), linkedFromPages (WikiPageId[]), archived (boolean), archivedAt (UnixMillis | null), createdAt, updatedAt
- `EntityLink`: { entityType: EntityType, entityId: string, displayText: string }

## Acceptance Criteria

- [ ] JournalEntry with tags and frontingSessionId
- [ ] JournalBlock as discriminated union per block type
- [ ] JournalBlock supports nesting (recursive children)
- [ ] WikiPage with archived/archivedAt
- [ ] EntityLink for member/entity hyperlinking
- [ ] Unit tests for block nesting and entity link construction

## References

- features.md section 7 (Journaling)
