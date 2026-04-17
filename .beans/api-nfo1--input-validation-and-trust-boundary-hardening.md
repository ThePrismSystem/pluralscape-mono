---
# api-nfo1
title: Input validation and trust boundary hardening
status: completed
type: task
priority: low
created_at: 2026-04-16T06:58:05Z
updated_at: 2026-04-17T05:46:34Z
parent: ps-0enb
---

Low-severity validation and trust boundary findings from comprehensive audit.

## Findings

- [ ] [VAL-S-L1] TagContentBodySchema validates entityId with no prefix/format check
- [ ] [VAL-S-L2] unixTimestampQueryParam silently returns undefined for invalid strings
- [ ] [VAL-S-L3] PasswordResetViaRecoveryKeySchema bypasses format validation via .transform()
- [ ] [VAL-T-L1] FrontingSessionQuerySchema and webhook.ts handle timestamps inconsistently
- [ ] [VAL-T-L2] AnalyticsQuerySchema third .refine() is redundant
- [ ] [VAL-P-L1] RELATIONSHIP_TYPE_QUERY_VALUES duplicates union from types
- [ ] [VAL-P-L2] CreateWebhookConfigBodySchema uses inline prefix check
- [ ] [API-T-L1] entity-pubsub.ts:35 JSON.parse() with no runtime validation
- [ ] [API-S-L1] ALLOWED_ORIGINS has no wildcard/format validation
- [ ] [EMAIL-S-L1] from and replyTo fields are caller-controlled with no validation

## Summary of Changes

Completed via PR #457 (`fix(api): security, validation, and trust boundary hardening`).

- Entity ID format check in TagContentBodySchema
- Reject invalid timestamps in `unixTimestampQueryParam`
- Deduplicated relationship types; use shared branded ID validator for webhook `cryptoKeyId`
- Validate email `from`/`replyTo` format
