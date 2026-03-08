# Roadmap

## Milestone: Milestone 1: Data Layer ([ps-vtws](../.beans/ps-vtws--milestone-1-data-layer.md))

> Domain types, database schema, encryption primitives, sync protocol design, i18n foundation

### Epic: Background job infrastructure ([infra-m2t5](../.beans/infra-m2t5--background-job-infrastructure.md))

> BullMQ (Valkey) for hosted, SQLite-backed in-process queue for self-hosted (ADR 010)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Job queue adapter interface ([infra-18r3](../.beans/infra-18r3--job-queue-adapter-interface.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) SQLite in-process job queue ([infra-dzyr](../.beans/infra-dzyr--sqlite-in-process-job-queue.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Job retry and dead-letter policies ([infra-egog](../.beans/infra-egog--job-retry-and-dead-letter-policies.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Job observability and monitoring ([infra-jdel](../.beans/infra-jdel--job-observability-and-monitoring.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) BullMQ Valkey queue adapter ([infra-tt0m](../.beans/infra-tt0m--bullmq-valkey-queue-adapter.md))

### Epic: Blob storage strategy ([infra-o80c](../.beans/infra-o80c--blob-storage-strategy.md))

> S3-compatible encrypted media storage, MinIO for self-hosted, local filesystem fallback (ADR 009)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Local filesystem storage adapter ([infra-32gr](../.beans/infra-32gr--local-filesystem-storage-adapter.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Client-side blob encryption pipeline ([infra-flb8](../.beans/infra-flb8--client-side-blob-encryption-pipeline.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Storage adapter interface ([infra-psh9](../.beans/infra-psh9--storage-adapter-interface.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Blob quota and lifecycle management ([infra-x9hz](../.beans/infra-x9hz--blob-quota-and-lifecycle-management.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) S3 presigned URL adapter ([infra-xotv](../.beans/infra-xotv--s3-presigned-url-adapter.md))

### Epic: Database schema ([db-2je4](../.beans/db-2je4--database-schema.md))

> packages/db — Drizzle schema for PostgreSQL + SQLite, co-designed with CRDT sync requirements

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Blob metadata table ([db-1dza](../.beans/db-1dza--blob-metadata-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Timer and check-in tables ([db-1icu](../.beans/db-1icu--timer-and-check-in-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Journal and wiki tables ([db-2e2s](../.beans/db-2e2s--journal-and-wiki-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) API key tables ([db-3h1c](../.beans/db-3h1c--api-key-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Common views and query helpers ([db-43uo](../.beans/db-43uo--common-views-and-query-helpers.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) RLS and dialect-specific features ([db-771z](../.beans/db-771z--rls-and-dialect-specific-features.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Privacy bucket tables ([db-7er7](../.beans/db-7er7--privacy-bucket-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Fronting tables ([db-82q2](../.beans/db-82q2--fronting-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Littles safe mode content table ([db-85zd](../.beans/db-85zd--littles-safe-mode-content-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Nomenclature settings table ([db-8su3](../.beans/db-8su3--nomenclature-settings-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Drizzle project setup ([db-9f6f](../.beans/db-9f6f--drizzle-project-setup.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) PluralKit bridge sync state table ([db-btrp](../.beans/db-btrp--pluralkit-bridge-sync-state-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Push notification tables ([db-f70u](../.beans/db-f70u--push-notification-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) SQLite fallback job queue table ([db-fe5s](../.beans/db-fe5s--sqlite-fallback-job-queue-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Client-side FTS5 search index schema ([db-fvx4](../.beans/db-fvx4--client-side-fts5-search-index-schema.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Core tables ([db-i2gl](../.beans/db-i2gl--core-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Communication tables ([db-ju0q](../.beans/db-ju0q--communication-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) System structure tables ([db-k37y](../.beans/db-k37y--system-structure-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Security audit log table ([db-k9sr](../.beans/db-k9sr--security-audit-log-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Member lifecycle events table ([db-kk2l](../.beans/db-kk2l--member-lifecycle-events-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Webhook configuration tables ([db-nodl](../.beans/db-nodl--webhook-configuration-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Groups and folders tables ([db-puza](../.beans/db-puza--groups-and-folders-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Import and export tracking tables ([db-rcgj](../.beans/db-rcgj--import-and-export-tracking-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Account and auth tables ([db-s6p9](../.beans/db-s6p9--account-and-auth-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Custom fields tables ([db-tu5g](../.beans/db-tu5g--custom-fields-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) System settings table ([db-va9l](../.beans/db-va9l--system-settings-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Innerworld tables ([db-vfhd](../.beans/db-vfhd--innerworld-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Sync metadata tables ([db-xj5n](../.beans/db-xj5n--sync-metadata-tables.md))

### Epic: Database schema documentation ([db-9nf0](../.beans/db-9nf0--database-schema-documentation.md))

> Comprehensive database schema documentation including audit and visual diagrams.

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Full database schema audit ([db-0yyh](../.beans/db-0yyh--full-database-schema-audit.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Mermaid ER diagram of database schema ([db-fojn](../.beans/db-fojn--mermaid-er-diagram-of-database-schema.md))

### Epic: Domain types ([types-im7i](../.beans/types-im7i--domain-types.md))

> packages/types — system, member, fronting, chat, privacy bucket, etc.

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Custom field types ([types-0jjx](../.beans/types-0jjx--custom-field-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Member lifecycle event types ([types-296i](../.beans/types-296i--member-lifecycle-event-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Fronting analytics and reporting types ([types-2xfo](../.beans/types-2xfo--fronting-analytics-and-reporting-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) i18n and locale types ([types-3ni9](../.beans/types-3ni9--i18n-and-locale-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Blob metadata types ([types-41na](../.beans/types-41na--blob-metadata-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Communication types ([types-8klm](../.beans/types-8klm--communication-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) WebSocket and SSE event types ([types-aab2](../.beans/types-aab2--websocket-and-sse-event-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption tier type annotations ([types-ae5n](../.beans/types-ae5n--encryption-tier-type-annotations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Shared utility types and ID system ([types-av6x](../.beans/types-av6x--shared-utility-types-and-id-system.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Group and folder types ([types-c2eu](../.beans/types-c2eu--group-and-folder-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Core identity types ([types-fid9](../.beans/types-fid9--core-identity-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Nomenclature types and defaults ([types-g5oo](../.beans/types-g5oo--nomenclature-types-and-defaults.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Push notification types ([types-gey6](../.beans/types-gey6--push-notification-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) PluralKit bridge types ([types-gnx5](../.beans/types-gnx5--pluralkit-bridge-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Fronting and switching types ([types-itej](../.beans/types-itej--fronting-and-switching-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Innerworld and spatial types ([types-iz5j](../.beans/types-iz5j--innerworld-and-spatial-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Security audit log types ([types-j2h3](../.beans/types-j2h3--security-audit-log-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Littles Safe Mode config types ([types-jawp](../.beans/types-jawp--littles-safe-mode-config-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Import and export types ([types-lzek](../.beans/types-lzek--import-and-export-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Sync and CRDT types ([types-m7dm](../.beans/types-m7dm--sync-and-crdt-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Webhook configuration types ([types-m97b](../.beans/types-m97b--webhook-configuration-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Background job types ([types-omwn](../.beans/types-omwn--background-job-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Account and auth types ([types-ov9h](../.beans/types-ov9h--account-and-auth-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Search types ([types-p1hp](../.beans/types-p1hp--search-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) System settings types ([types-p24v](../.beans/types-p24v--system-settings-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Journal and wiki types ([types-puxp](../.beans/types-puxp--journal-and-wiki-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Privacy bucket types ([types-qryr](../.beans/types-qryr--privacy-bucket-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) System structure and relationship types ([types-rwnq](../.beans/types-rwnq--system-structure-and-relationship-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) API key types ([types-xay7](../.beans/types-xay7--api-key-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Timer and check-in types ([types-xmsf](../.beans/types-xmsf--timer-and-check-in-types.md))

### Epic: Encryption layer ([crypto-gd8f](../.beans/crypto-gd8f--encryption-layer.md))

> packages/crypto — libsodium wrappers, key derivation, per-bucket keys, three-tier encryption model (ADR 006)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Signature operations ([crypto-0jcf](../.beans/crypto-0jcf--signature-operations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Master key derivation ([crypto-afug](../.beans/crypto-afug--master-key-derivation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Key grant operations ([crypto-cqyz](../.beans/crypto-cqyz--key-grant-operations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) libsodium cross-platform bindings ([crypto-d2tj](../.beans/crypto-d2tj--libsodium-cross-platform-bindings.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Identity keypair generation ([crypto-l3hj](../.beans/crypto-l3hj--identity-keypair-generation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Platform key storage abstraction ([crypto-mdsw](../.beans/crypto-mdsw--platform-key-storage-abstraction.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Per-bucket key management ([crypto-mp96](../.beans/crypto-mp96--per-bucket-key-management.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption tier helpers ([crypto-rawi](../.beans/crypto-rawi--encryption-tier-helpers.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key generation ([crypto-sa91](../.beans/crypto-sa91--recovery-key-generation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Symmetric encryption/decryption ([crypto-xbjk](../.beans/crypto-xbjk--symmetric-encryptiondecryption.md))

### Epic: Key recovery protocol ([crypto-89v7](../.beans/crypto-89v7--key-recovery-protocol.md))

> Recovery key generation, multi-device key transfer (ADR 011)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Password reset via recovery key ([crypto-gd6i](../.beans/crypto-gd6i--password-reset-via-recovery-key.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key encrypted backup ([crypto-j381](../.beans/crypto-j381--recovery-key-encrypted-backup.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Multi-device key transfer protocol ([crypto-qiwh](../.beans/crypto-qiwh--multi-device-key-transfer-protocol.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key regeneration ([crypto-vgn3](../.beans/crypto-vgn3--recovery-key-regeneration.md))

### Epic: Nomenclature system ([ps-iawz](../.beans/ps-iawz--nomenclature-system.md))

> Configurable terminology for 8 term categories, UI-only (canonical API terms), stored per-system

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Term resolution utility ([ps-a68h](../.beans/ps-a68h--term-resolution-utility.md))

### Epic: Sync protocol design ([sync-xlhb](../.beans/sync-xlhb--sync-protocol-design.md))

> packages/sync — Automerge document structure, merge semantics, conflict resolution rules; co-designed with DB schema

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Document topology design ([sync-2xog](../.beans/sync-2xog--document-topology-design.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Merge semantics specification ([sync-5jne](../.beans/sync-5jne--merge-semantics-specification.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Conflict resolution rules ([sync-80bn](../.beans/sync-80bn--conflict-resolution-rules.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption integration for sync ([sync-jr85](../.beans/sync-jr85--encryption-integration-for-sync.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Partial replication strategy ([sync-mgcd](../.beans/sync-mgcd--partial-replication-strategy.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Automerge integration ([sync-pl87](../.beans/sync-pl87--automerge-integration.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Sync protocol messages ([sync-t1rl](../.beans/sync-t1rl--sync-protocol-messages.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Document lifecycle management ([sync-tf2p](../.beans/sync-tf2p--document-lifecycle-management.md))

### Epic: Test framework setup ([ps-jvnm](../.beans/ps-jvnm--test-framework-setup.md))

> Vitest configuration, coverage thresholds, CI enforcement

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Vitest workspace configuration ([ps-6r0l](../.beans/ps-6r0l--vitest-workspace-configuration.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Test factories and fixtures ([ps-7msx](../.beans/ps-7msx--test-factories-and-fixtures.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Coverage configuration ([ps-mv06](../.beans/ps-mv06--coverage-configuration.md))

### Epic: i18n infrastructure ([ps-7z0s](../.beans/ps-7z0s--i18n-infrastructure.md))

> String externalization, translation framework, RTL support, locale formatting — features.md section 11

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Locale formatting utilities ([ps-duny](../.beans/ps-duny--locale-formatting-utilities.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) i18n framework setup ([ps-jkpn](../.beans/ps-jkpn--i18n-framework-setup.md))

## No Milestone

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Official client SDKs ([ps-pzai](../.beans/ps-pzai--official-client-sdks.md))
