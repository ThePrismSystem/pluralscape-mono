---
# types-flm2
title: Implement types audit gap fixes (all phases)
status: completed
type: task
priority: normal
created_at: 2026-03-09T08:47:50Z
updated_at: 2026-03-09T08:55:30Z
---

Implement all 24 gap fixes from the types-vs-features audit across 3 phases: 6 critical, 13 moderate, 5 minor.

## Summary of Changes

Implemented all 24 gap fixes from the types-vs-features audit:

**Phase 1 (Critical):**

1. Added architectureType, originType, hasCore, discoveryStatus to Subsystem
2. Added hasCore to SystemProfile
3. Added parentId to Channel for category hierarchy
4. Added senderId to BoardMessage
5. Expanded SearchableEntityType with custom-field, chat-message, board-message
6. Added 9 missing Server/Client encryption pairs (CustomFront, JournalEntry, WikiPage, MemberPhoto, Poll, AcknowledgementRequest, SideSystem, Layer, TimerConfig)

**Phase 2 (Moderate):** 7. Added account-purge, bucket-key-rotation, report-generate to JobType 8. Added SystemOverviewReport type 9. Added cryptoKeyId to WebhookConfig 10. Added scopedBucketIds to CryptoApiKey 11. Added littles-safe-mode to BlobPurpose 12. Added thumbnailOfBlobId to BlobMetadata 13. Added id (PollVoteId) and votedAt to PollVote 14. Added createdByMemberId to Poll and AcknowledgementRequest 15. Expanded ExportSection with 5 new sections 16. Expanded WebhookEventType with 8 new event types 17. Added friend-switch-alert to NotificationEventType, added FriendNotificationPreference 18. Added auth.login-failed, auth.password-changed, auth.recovery-key-used to AuditEventType 19. Added FriendNotificationPreference type for friend notification config

**Phase 3 (Minor):** 20. Added allowMultipleVotes and maxVotesPerMember to Poll 21. Changed Switch.memberId to Switch.memberIds (readonly MemberId[]) 22. Added CoFrontingPair and CoFrontingAnalytics types 23. Added onboardingComplete to SystemSettings 24. Added ServerAuditLogEntry/ClientAuditLogEntry encryption pair
