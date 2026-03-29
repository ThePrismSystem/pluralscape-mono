# Roadmap

## Milestone: Milestone 10: Polish and Launch ([ps-9u4w](.beans/ps-9u4w--milestone-10-polish-and-launch.md))

> Security audit, performance, beta testing

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Drop messages_system_id_idx after partitioning is stable ([db-1aw7](.beans/db-1aw7--drop-messages-system-id-idx-after-partitioning-is.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Schedule audit log PII cleanup as recurring job ([infra-gvgo](.beans/infra-gvgo--schedule-audit-log-pii-cleanup-as-recurring-job.md))

## Milestone: Milestone 9: Self-Hosted ([ps-qcfr](.beans/ps-qcfr--milestone-9-self-hosted.md))

> Two-tier self-hosted deployment (minimal single binary + full Docker Compose)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Two-factor device transfer (remove code from QR) ([api-v2ar](.beans/api-v2ar--two-factor-device-transfer-remove-code-from-qr.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) SQLite schema codegen from PG (Phase B) ([db-k19k](.beans/db-k19k--sqlite-schema-codegen-from-pg-phase-b.md))

## Milestone: Milestone 7: Data Portability ([ps-n8uk](.beans/ps-n8uk--milestone-7-data-portability.md))

> Import from SP/PK, export, API surface

### Epic: Email & webhook audit findings ([api-kjyg](.beans/api-kjyg--email-webhook-audit-findings.md))

> Audit findings from comprehensive review of email infrastructure (api-7xw0) and webhook system (api-9wze). Covers security, performance, code quality, testing, simplification, and database concerns.

- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Add RLS context to findPendingDeliveries query ([api-2yua](.beans/api-2yua--add-rls-context-to-findpendingdeliveries-query.md))
- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Sanitize error messages in webhook test endpoint ([api-77fq](.beans/api-77fq--sanitize-error-messages-in-webhook-test-endpoint.md))
- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Enforce HTTPS for webhook URLs in all environments ([api-e0mf](.beans/api-e0mf--enforce-https-for-webhook-urls-in-all-environments.md))
- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Add max-size bound to QueryCache ([api-slhr](.beans/api-slhr--add-max-size-bound-to-querycache.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add per-endpoint rate limiting for webhook delivery ([api-2zfx](.beans/api-2zfx--add-per-endpoint-rate-limiting-for-webhook-deliver.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add E2E tests for rotate-secret, test/ping, OCC conflict ([api-3ekp](.beans/api-3ekp--add-e2e-tests-for-rotate-secret-testping-occ-confl.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Replace thin parseQuery wrappers with generic parseQueryOrThrow ([api-4q45](.beans/api-4q45--replace-thin-parsequery-wrappers-with-generic-pars.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Rename or inline isTemplateVars type guard in email-worker ([api-5psv](.beans/api-5psv--rename-or-inline-istemplatevars-type-guard-in-emai.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Extract shared sendSignedWebhookRequest helper ([api-773d](.beans/api-773d--extract-shared-sendsignedwebhookrequest-helper.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Replace as never casts in webhook-config-enhancements tests ([api-8t52](.beans/api-8t52--replace-as-never-casts-in-webhook-config-enhanceme.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Extract shared parsePaginatedQuery helper for list routes ([api-9z5n](.beans/api-9z5n--extract-shared-parsepaginatedquery-helper-for-list.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Replace loose Record<string, unknown> with strict types ([api-au0i](.beans/api-au0i--replace-loose-recordstring-unknown-with-strict-typ.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Zero webhook HMAC secret buffer after use ([api-cnxi](.beans/api-cnxi--zero-webhook-hmac-secret-buffer-after-use.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add mutual exclusion CHECK for encryptedData vs payloadData ([api-dpg2](.beans/api-dpg2--add-mutual-exclusion-check-for-encrypteddata-vs-pa.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add CHECK constraint on webhookConfigs.eventTypes JSONB ([api-euhs](.beans/api-euhs--add-check-constraint-on-webhookconfigseventtypes-j.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Eliminate double DNS resolution in webhook delivery ([api-f39h](.beans/api-f39h--eliminate-double-dns-resolution-in-webhook-deliver.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Consolidate delivery status enum to single source ([api-f57k](.beans/api-f57k--consolidate-delivery-status-enum-to-single-source.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Extract markDeliveryFailed helper in delivery worker ([api-f7gz](.beans/api-f7gz--extract-markdeliveryfailed-helper-in-delivery-work.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add composite index on (system_id, id DESC) for delivery list ([api-goa3](.beans/api-goa3--add-composite-index-on-system-id-id-desc-for-deliv.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add missing SMTP error code tests ([api-i0pw](.beans/api-i0pw--add-missing-smtp-error-code-tests.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Consider one-time-read pattern for webhook secret responses ([api-kbf3](.beans/api-kbf3--consider-one-time-read-pattern-for-webhook-secret.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Remove unused archivable columns from webhookDeliveries ([api-mth5](.beans/api-mth5--remove-unused-archivable-columns-from-webhookdeliv.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add route tests for webhook-delivery get and delete ([api-opf4](.beans/api-opf4--add-route-tests-for-webhook-delivery-get-and-delet.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Remove duplicated pure-function tests from integration suite ([api-svf0](.beans/api-svf0--remove-duplicated-pure-function-tests-from-integra.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Simplify email adapter test factories to constructor-based DI ([api-tmuj](.beans/api-tmuj--simplify-email-adapter-test-factories-to-construct.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Validate email format before hashing/encrypting ([api-vc80](.beans/api-vc80--validate-email-format-before-hashingencrypting.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add composite index on (system_id, event_type) for deliveries ([api-zor7](.beans/api-zor7--add-composite-index-on-system-id-event-type-for-de.md))

### Epic: Email infrastructure ([api-7xw0](.beans/api-7xw0--email-infrastructure.md))

> Email sending infrastructure: provider integration, templating, job-based delivery queue. Foundation for transactional emails (recovery key alerts, account notifications).

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Email template system ([api-hvep](.beans/api-hvep--email-template-system.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Resend adapter ([api-s5hq](.beans/api-s5hq--resend-adapter.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) License audit for resend and nodemailer dependencies ([api-tc7x](.beans/api-tc7x--license-audit-for-resend-and-nodemailer-dependenci.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) SMTP adapter (Nodemailer) ([api-w1ia](.beans/api-w1ia--smtp-adapter-nodemailer.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) @pluralscape/email package — interface, errors, stub, contract tests ([api-zeh1](.beans/api-zeh1--pluralscapeemail-package-interface-errors-stub-con.md))

### Epic: Public REST API audit ([api-e7gt](.beans/api-e7gt--public-rest-api.md))

> Comprehensive, airtight audit of the public REST API before launch. Covers spec accuracy, code quality, feature completeness, in-depth security, API consistency, and E2E test coverage. Pre-release ...

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) E2E test coverage expansion ([api-2qy8](.beans/api-2qy8--e2e-test-coverage-expansion.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) OpenAPI spec reconciliation ([api-398w](.beans/api-398w--openapi-spec-reconciliation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Security audit: rate limiting, headers, and CORS ([api-3b2d](.beans/api-3b2d--security-audit-rate-limiting-headers-and-cors.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Security audit: input validation and error handling ([api-69ul](.beans/api-69ul--security-audit-input-validation-and-error-handling.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Feature completeness audit ([api-g475](.beans/api-g475--feature-completeness-audit.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) API consistency normalization ([api-ibn2](.beans/api-ibn2--api-consistency-normalization.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Security audit: authentication and authorization ([api-sojx](.beans/api-sojx--security-audit-authentication-and-authorization.md))

### Epic: User-configurable webhooks ([api-9wze](.beans/api-9wze--user-configurable-webhooks.md))

> User-configurable webhook endpoints for all supported events (encrypted payloads)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Wire identity webhook events (9 events) ([api-q642](.beans/api-q642--wire-identity-webhook-events-9-events.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Wire friend webhook events (4 events) ([api-smlf](.beans/api-smlf--wire-friend-webhook-events-4-events.md))

## Milestone: Milestone 8: Client App ([ps-7j8n](.beans/ps-7j8n--milestone-8-client-app.md))

> Full-featured cross-platform UI (web, iOS, Android via Expo)

### Epic: PluralKit import ([client-f61z](.beans/client-f61z--pluralkit-import.md))

> Client-side: parse PK JSON v2 export — 5-char hids, ISO 8601, members/switches/groups only

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Convert PluralKit switches to fronting sessions on import ([client-jusn](.beans/client-jusn--convert-pluralkit-switches-to-fronting-sessions-on.md))

### Miscellaneous

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Pass timestamp query param on message single-entity API calls ([client-ensq](.beans/client-ensq--pass-timestamp-query-param-on-message-single-entit.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Validate ReactNativeSodiumAdapter tests in real RN environment ([crypto-jz77](.beans/crypto-jz77--validate-reactnativesodiumadapter-tests-in-real-rn.md))

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
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Update docs for M7 work completed so far ([ps-15fk](.beans/ps-15fk--update-docs-for-m7-work-completed-so-far.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) M4 comprehensive audit ([ps-6u44](.beans/ps-6u44--m4-comprehensive-audit.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add structure entity service with HAS_DEPENDENTS checking ([api-l9ar](.beans/api-l9ar--add-structure-entity-service-with-has-dependents-c.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Structure-entity deletion must check note dependencies ([api-m3up](.beans/api-m3up--structure-entity-deletion-must-check-note-dependen.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Bucket rotation full lifecycle E2E tests ([api-7spq](.beans/api-7spq--bucket-rotation-full-lifecycle-e2e-tests.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Use branded ID keys in CRDT sync schema Record types ([sync-sqfo](.beans/sync-sqfo--use-branded-id-keys-in-crdt-sync-schema-record-typ.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Shared brandId<T> utility for Drizzle inferSelect to branded ID casts ([types-jmk7](.beans/types-jmk7--shared-brandidt-utility-for-drizzle-inferselect-to.md))
