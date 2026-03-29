# Roadmap

## Milestone: Milestone 7: Data Portability ([ps-n8uk](.beans/ps-n8uk--milestone-7-data-portability.md))

> Import from SP/PK, export, API surface

### Epic: PluralKit import ([client-f61z](.beans/client-f61z--pluralkit-import.md))

> Client-side: parse PK JSON v2 export — 5-char hids, ISO 8601, members/switches/groups only

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Convert PluralKit switches to fronting sessions on import ([client-jusn](.beans/client-jusn--convert-pluralkit-switches-to-fronting-sessions-on.md))

### Miscellaneous

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key regeneration email confirmation ([api-nk7m](.beans/api-nk7m--recovery-key-regeneration-email-confirmation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Two-factor device transfer (remove code from QR) ([api-v2ar](.beans/api-v2ar--two-factor-device-transfer-remove-code-from-qr.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) SQLite schema codegen from PG (Phase B) ([db-k19k](.beans/db-k19k--sqlite-schema-codegen-from-pg-phase-b.md))

## Milestone: Milestone 8: Client App ([ps-7j8n](.beans/ps-7j8n--milestone-8-client-app.md))

> Full-featured cross-platform UI (web, iOS, Android via Expo)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Pass timestamp query param on message single-entity API calls ([client-ensq](.beans/client-ensq--pass-timestamp-query-param-on-message-single-entit.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Validate ReactNativeSodiumAdapter tests in real RN environment ([crypto-jz77](.beans/crypto-jz77--validate-reactnativesodiumadapter-tests-in-real-rn.md))

## Milestone: Milestone 10: Polish and Launch ([ps-9u4w](.beans/ps-9u4w--milestone-10-polish-and-launch.md))

> Security audit, performance, beta testing

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Drop messages_system_id_idx after partitioning is stable ([db-1aw7](.beans/db-1aw7--drop-messages-system-id-idx-after-partitioning-is.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Schedule audit log PII cleanup as recurring job ([infra-gvgo](.beans/infra-gvgo--schedule-audit-log-pii-cleanup-as-recurring-job.md))

## Milestone: Milestone 6: Privacy and Social ([ps-6itw](.beans/ps-6itw--milestone-6-privacy-and-social.md))

> Privacy engine, friend network, external access

### Epic: Friend network ([api-rl9o](.beans/api-rl9o--friend-network.md))

> Friend codes, connection management, bucket assignment. Account-level operations per ADR 021.

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Friend network E2E tests and OpenAPI ([api-ghp5](.beans/api-ghp5--friend-network-e2e-tests-and-openapi.md))

## No Milestone

### Epic: M4 audit remediation ([ps-4ioj](.beans/ps-4ioj--m4-audit-remediation.md))

> Address must-fix and should-fix findings from the M4 comprehensive audit. 12 items: 4 critical/high data integrity + security, 8 should-fix performance/quality/testing.

- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Fix SQLite getCurrentFrontingComments join missing systemId ([db-vguh](.beans/db-vguh--fix-sqlite-getcurrentfrontingcomments-join-missing.md))
- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Fix poll-vote fieldName mismatch in CRDT strategies ([sync-uxaf](.beans/sync-uxaf--fix-poll-vote-fieldname-mismatch-in-crdt-strategie.md))
- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Fix WebhookConfig.secret typed as EncryptedString ([types-yp3m](.beans/types-yp3m--fix-webhookconfigsecret-typed-as-encryptedstring.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add webhook-delivery-cleanup unit test ([api-3rtc](.beans/api-3rtc--add-webhook-delivery-cleanup-unit-test.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add next_check_in_at column to optimize timer scheduling ([api-4kp6](.beans/api-4kp6--add-next-check-in-at-column-to-optimize-timer-sche.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Batch webhook delivery cleanup deletes ([api-7yk0](.beans/api-7yk0--batch-webhook-delivery-cleanup-deletes.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Reduce over-mocking in webhook-dispatcher unit test ([api-ao1s](.beans/api-ao1s--reduce-over-mocking-in-webhook-dispatcher-unit-tes.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add fronting-report.service integration test ([api-bn0u](.beans/api-bn0u--add-fronting-reportservice-integration-test.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add missing webhook route-level tests ([api-d8jg](.beans/api-d8jg--add-missing-webhook-route-level-tests.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add webhook secret rotation endpoint ([api-f6jg](.beans/api-f6jg--add-webhook-secret-rotation-endpoint.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add per-system webhook config limit ([api-g3xl](.beans/api-g3xl--add-per-system-webhook-config-limit.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add max date span validation for custom analytics ranges ([api-h9xu](.beans/api-h9xu--add-max-date-span-validation-for-custom-analytics.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Use EncryptedBlob type in fronting-report mapper ([api-l5fo](.beans/api-l5fo--use-encryptedblob-type-in-fronting-report-mapper.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add analytics result caching ([api-q6fu](.beans/api-q6fu--add-analytics-result-caching.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Move duplicate MS_PER_DAY to shared import ([api-q6l1](.beans/api-q6l1--move-duplicate-ms-per-day-to-shared-import.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add lifecycle-event.service integration test ([api-sumw](.beans/api-sumw--add-lifecycle-eventservice-integration-test.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add analytics and fronting-report route-level tests ([api-v3zs](.beans/api-v3zs--add-analytics-and-fronting-report-route-level-test.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Refactor deriveMasterKey backward-compat shim ([crypto-nea9](.beans/crypto-nea9--refactor-derivemasterkey-backward-compat-shim.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add partial index for check-in-generate query pattern ([db-ab1h](.beans/db-ab1h--add-partial-index-for-check-in-generate-query-patt.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add M4 tables to RLS integration test ([db-afev](.beans/db-afev--add-m4-tables-to-rls-integration-test.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add LIMIT to view query helpers ([db-cwqh](.beans/db-cwqh--add-limit-to-view-query-helpers.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Remove encryptedMasterKey nullable/legacy pattern ([db-z6rp](.beans/db-z6rp--remove-encryptedmasterkey-nullablelegacy-pattern.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add post-merge validation for fronting-comment author constraint ([sync-ht2e](.beans/sync-ht2e--add-post-merge-validation-for-fronting-comment-aut.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Handle comment/check-in migration in time-split ([sync-wh96](.beans/sync-wh96--handle-commentcheck-in-migration-in-time-split.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Deduplicate webhook event types across packages ([types-26v8](.beans/types-26v8--deduplicate-webhook-event-types-across-packages.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add sessionStartTime to FrontingComment type or document omission ([types-jf54](.beans/types-jf54--add-sessionstarttime-to-frontingcomment-type-or-do.md))

### Miscellaneous

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Account settings UI: audit log IP tracking opt-in ([mobile-zxe4](.beans/mobile-zxe4--account-settings-ui-audit-log-ip-tracking-opt-in.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Fix friend dashboard review issues ([api-a2x5](.beans/api-a2x5--fix-friend-dashboard-review-issues.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Fix friend dashboard review issues ([api-wk6u](.beans/api-wk6u--fix-friend-dashboard-review-issues.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) M4 comprehensive audit ([ps-6u44](.beans/ps-6u44--m4-comprehensive-audit.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add structure entity service with HAS_DEPENDENTS checking ([api-l9ar](.beans/api-l9ar--add-structure-entity-service-with-has-dependents-c.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Structure-entity deletion must check note dependencies ([api-m3up](.beans/api-m3up--structure-entity-deletion-must-check-note-dependen.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Remove stale TODO comments referencing completed sync-80bn ([sync-lyhs](.beans/sync-lyhs--remove-stale-todo-comments-referencing-completed-s.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Remove stale TODO comments referencing completed sync-80bn ([sync-rga8](.beans/sync-rga8--remove-stale-todo-comments-referencing-completed-s.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Bucket rotation full lifecycle E2E tests ([api-7spq](.beans/api-7spq--bucket-rotation-full-lifecycle-e2e-tests.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Use branded ID keys in CRDT sync schema Record types ([sync-sqfo](.beans/sync-sqfo--use-branded-id-keys-in-crdt-sync-schema-record-typ.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Shared brandId<T> utility for Drizzle inferSelect to branded ID casts ([types-jmk7](.beans/types-jmk7--shared-brandidt-utility-for-drizzle-inferselect-to.md))
