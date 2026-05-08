# Roadmap

## Milestone: Milestone 14: Self-Hosted ([ps-qcfr](.beans/ps-qcfr--milestone-13-self-hosted.md))

> Two-tier self-hosted deployment (minimal single binary + full Docker Compose)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) SQLite schema codegen from PG (Phase B) ([db-k19k](.beans/db-k19k--sqlite-schema-codegen-from-pg-phase-b.md))

## Milestone: Milestone 15: Polish and Launch ([ps-9u4w](.beans/ps-9u4w--milestone-10-polish-and-launch.md))

> Security audit, performance, beta testing

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Push co-fronting breakdown aggregation into DB ([api-4hfa](.beans/api-4hfa--push-co-fronting-breakdown-aggregation-into-db.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Bucket rotation full lifecycle E2E tests ([api-7spq](.beans/api-7spq--bucket-rotation-full-lifecycle-e2e-tests.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Test coverage: snapshot.service.ts has zero tests ([api-k6as](.beans/api-k6as--test-coverage-snapshotservicets-has-zero-tests.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Test coverage: key-grant.service.ts has zero tests ([api-lr6o](.beans/api-lr6o--test-coverage-key-grantservicets-has-zero-tests.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add deferred tRPC router integration test cases (cross-tenant writes, OCC conflicts, dependent-conflicts) ([api-m78h](.beans/api-m78h--add-deferred-trpc-router-integration-test-cases-cr.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) E2E coverage for timer-configs CRUD ([api-qnn6](.beans/api-qnn6--e2e-coverage-for-timer-configs-crud.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Test coverage: innerworld-region.service.ts needs integration tests ([api-rdko](.beans/api-rdko--test-coverage-innerworld-regionservicets-needs-int.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Two-factor device transfer (remove code from QR) ([api-v2ar](.beans/api-v2ar--two-factor-device-transfer-remove-code-from-qr.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) OpenAPI reconciliation: constraint-aware and full deep comparison ([api-yxvn](.beans/api-yxvn--openapi-reconciliation-constraint-aware-and-full-d.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Drop messages_system_id_idx after partitioning is stable ([db-1aw7](.beans/db-1aw7--drop-messages-system-id-idx-after-partitioning-is.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Versioned Drizzle migration for PARTITION BY ([db-bqd3](.beans/db-bqd3--versioned-drizzle-migration-for-partition-by.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) audit_log retention/drop job in packages/rotation-worker ([db-d2ht](.beans/db-d2ht--audit-log-retentiondrop-job-in-packagesrotation-wo.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Explore Drizzle schema codegen from @pluralscape/types domain types ([db-mpbv](.beans/db-mpbv--explore-drizzle-schema-codegen-from-pluralscapetyp.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Schedule audit log PII cleanup as recurring job ([infra-gvgo](.beans/infra-gvgo--schedule-audit-log-pii-cleanup-as-recurring-job.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Branch coverage gap cleanup — raise low-branch business-logic files ([ps-0rdy](.beans/ps-0rdy--branch-coverage-gap-cleanup-raise-low-branch-busin.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) E2E test coverage expansion ([ps-jrsj](.beans/ps-jrsj--e2e-test-coverage-expansion.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Evaluate upgrading mobile-shr0 architecture from (B) single worker to (A) two-worker full hoist ([ps-pn2y](.beans/ps-pn2y--evaluate-upgrading-mobile-shr0-architecture-from-b.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Consolidate E2E test apps under unified naming or directory structure ([ps-vwn0](.beans/ps-vwn0--consolidate-e2e-test-apps-under-unified-naming-or.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Brand fleet expansion: Member.name, Member.pronouns, Group.name, Channel.name ([types-f3fk](.beans/types-f3fk--brand-fleet-expansion-membername-memberpronouns-gr.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Brand JournalEntry.title and WikiPage.title ([types-x37g](.beans/types-x37g--brand-journalentrytitle-and-wikipagetitle.md))

## Milestone: Milestone 10: UI/UX Design ([ps-9cca](.beans/ps-9cca--milestone-10-uiux-design.md))

> Stitch-generated HTML mockups for every screen family, establishing visual language, interaction patterns, and layout decisions

### Epic: Onboarding & auth screen designs ([ps-nwju](.beans/ps-nwju--onboarding-auth-screen-designs.md))

> Login, registration, recovery key backup, device transfer, initial setup wizard

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Account settings UI: audit log IP tracking opt-in ([mobile-zxe4](.beans/mobile-zxe4--account-settings-ui-audit-log-ip-tracking-opt-in.md))

### Miscellaneous

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Mobile: UI/UX design for bucket-key decrypt failure diagnostics ([mobile-5bi3](.beans/mobile-5bi3--mobile-uiux-design-for-bucket-key-decrypt-failure.md))

## Milestone: Milestone 11: UI/UX Buildout ([ps-vq2h](.beans/ps-vq2h--milestone-11-uiux-buildout.md))

> Translate Stitch HTML mockups into React Native/Expo components with placeholder data

### Epic: Simply Plural import wizard UI ([ps-9uqg](.beans/ps-9uqg--simply-plural-import-wizard-ui.md))

> User-facing wizard for the SP import flow built on top of the ps-nrg4 data layer.

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Import wizard dedup against existing Pluralscape buckets ([ps-405v](.beans/ps-405v--import-wizard-dedup-against-existing-pluralscape-b.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Harden SP import wizard against phishing baseUrl ([ps-aj1j](.beans/ps-aj1j--harden-sp-import-wizard-against-phishing-baseurl.md))

### Miscellaneous

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Handle OPFS quota exhaustion gracefully (SQLITE_FULL UX + recovery) ([ps-gexi](.beans/ps-gexi--handle-opfs-quota-exhaustion-gracefully-sqlite-ful.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Unpin fast-xml-parser once AWS SDK regression fixed ([ps-47tc](.beans/ps-47tc--unpin-fast-xml-parser-once-aws-sdk-regression-fixe.md))

## Milestone: Milestone 12: Data Interpolation ([ps-8coo](.beans/ps-8coo--milestone-12-data-interpolation.md))

> Wire every screen to its real data hooks, replacing placeholder data with live API data

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Implement token refresh with retry for tRPC client ([mobile-txcx](.beans/mobile-txcx--implement-token-refresh-with-retry-for-trpc-client.md))
- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Implement sync conflict persistence with E2E encryption ([sync-qj9u](.beans/sync-qj9u--implement-sync-conflict-persistence-with-e2e-encry.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Validate ReactNativeSodiumAdapter tests in real RN environment ([crypto-jz77](.beans/crypto-jz77--validate-reactnativesodiumadapter-tests-in-real-rn.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Measure mobile bundle impact of @pluralscape/import-sp subpath imports ([mobile-1242](.beans/mobile-1242--measure-mobile-bundle-impact-of-pluralscapeimport.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Mobile: instrument bucket-key decrypt failure counters ([mobile-fk47](.beans/mobile-fk47--mobile-instrument-bucket-key-decrypt-failure-count.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add real-SQLite smoke test for expo-sqlite-driver ([mobile-l0fq](.beans/mobile-l0fq--add-real-sqlite-smoke-test-for-expo-sqlite-driver.md))

## Milestone: Milestone 13: Ancillary Features ([ps-lksz](.beans/ps-lksz--milestone-13-ancillary-features.md))

> Self-contained features (data export, PluralKit bridge, Littles Safe Mode, fronting history reports) built end-to-end as vertical slices

### Epic: PluralKit bridge ([ps-zs93](.beans/ps-zs93--pluralkit-bridge.md))

> Ongoing sync configuration, status dashboard, conflict resolution UI

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encrypt PK API token client-side with master key ([client-cde3](.beans/client-cde3--encrypt-pk-api-token-client-side-with-master-key.md))

## No Milestone

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Comprehensive docs refresh ([ps-t8xa](.beans/ps-t8xa--comprehensive-docs-refresh.md))
