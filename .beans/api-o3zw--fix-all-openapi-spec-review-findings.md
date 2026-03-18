---
# api-o3zw
title: Fix all OpenAPI spec review findings
status: completed
type: task
priority: normal
created_at: 2026-03-18T18:13:20Z
updated_at: 2026-03-18T18:24:22Z
---

Fix all critical, important, and suggestion-level issues from PR #182 review

## Summary of Changes

Fixed all critical, important, and suggestion-level findings from the OpenAPI spec PR review:

- Added dedicated MemberResponse/CustomFrontResponse/SideSystemResponse schemas
- Removed incorrect nullable on RelationshipResponse member IDs
- Added format constraints (pattern, contentEncoding, format: int64) across all schemas
- Added global security default with security: [] on public endpoints
- Added descriptions to all ~120 operations with rate limit tiers
- Added descriptions to all inline path/query parameters
- Defined typed AuditLogEntry schema, GroupTreeNode, StructureMembershipResponse, SetupStatusResponse, BiometricEnrollResponse, BiometricVerifyResponse
- Fixed bare type: object responses with proper schemas
- Fixed AuditLogQuery to camelCase, PlaintextNomenclature to camelCase
- Removed sortOrder from PlaintextGroup/PlaintextMemberPhoto required (T3 field)
- Fixed CanvasResponse to compose with EncryptedEntity via allOf
- Added encryptionTier to BlobResponse
- Added PaginationMeta.required: [nextCursor, hasMore]
- Added x-tagGroups for Redocly documentation navigation
- Fixed bean literal newline
- Added examples to common schema fields
