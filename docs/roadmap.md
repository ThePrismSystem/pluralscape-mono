# Roadmap

## Milestone: Milestone 1: Data Layer ([ps-vtws](.beans/ps-vtws--milestone-1-data-layer.md))

> Domain types, database schema, encryption primitives, sync protocol design, i18n foundation

### Epic: Background job infrastructure ([infra-m2t5](.beans/infra-m2t5--background-job-infrastructure.md))

> BullMQ (Valkey) for hosted, SQLite-backed in-process queue for self-hosted (ADR 010)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Job queue adapter interface ([infra-18r3](.beans/infra-18r3--job-queue-adapter-interface.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) SQLite in-process job queue ([infra-dzyr](.beans/infra-dzyr--sqlite-in-process-job-queue.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Job retry and dead-letter policies ([infra-egog](.beans/infra-egog--job-retry-and-dead-letter-policies.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Job observability and monitoring ([infra-jdel](.beans/infra-jdel--job-observability-and-monitoring.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) BullMQ Valkey queue adapter ([infra-tt0m](.beans/infra-tt0m--bullmq-valkey-queue-adapter.md))

### Epic: Blob storage strategy ([infra-o80c](.beans/infra-o80c--blob-storage-strategy.md))

> S3-compatible encrypted media storage, MinIO for self-hosted, local filesystem fallback (ADR 009)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Local filesystem storage adapter ([infra-32gr](.beans/infra-32gr--local-filesystem-storage-adapter.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Client-side blob encryption pipeline ([infra-flb8](.beans/infra-flb8--client-side-blob-encryption-pipeline.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Storage adapter interface ([infra-psh9](.beans/infra-psh9--storage-adapter-interface.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Blob quota and lifecycle management ([infra-x9hz](.beans/infra-x9hz--blob-quota-and-lifecycle-management.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) S3 presigned URL adapter ([infra-xotv](.beans/infra-xotv--s3-presigned-url-adapter.md))

### Epic: CRDT sync protocol design and MVP ([sync-mxeg](.beans/sync-mxeg--crdt-sync-protocol-design-and-mvp.md))

> Design and prototype the encrypted CRDT sync protocol before building API routes. Prove the Automerge-over-relay pattern works end-to-end with encrypted data. Covers: document topology design, per-...

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Conflict resolution strategy per entity type ([sync-l0ky](.beans/sync-l0ky--conflict-resolution-strategy-per-entity-type.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Partial replication design ([sync-psx6](.beans/sync-psx6--partial-replication-design.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) CRDT garbage collection and document size management ([sync-qxmb](.beans/sync-qxmb--crdt-garbage-collection-and-document-size-manageme.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) CRDT document topology design ([sync-y3ps](.beans/sync-y3ps--crdt-document-topology-design.md))

### Epic: Database schema documentation ([db-9nf0](.beans/db-9nf0--database-schema-documentation.md))

> Comprehensive database schema documentation including audit and visual diagrams.

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Mermaid ER diagram of database schema ([db-fojn](.beans/db-fojn--mermaid-er-diagram-of-database-schema.md))

### Epic: Encryption layer ([crypto-gd8f](.beans/crypto-gd8f--encryption-layer.md))

> packages/crypto — libsodium wrappers, key derivation, per-bucket keys, three-tier encryption model (ADR 006)

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Implement KeyLifecycleManager for mobile ([crypto-inca](.beans/crypto-inca--implement-keylifecyclemanager-for-mobile.md))
- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Implement Safety Number verification ([crypto-zc67](.beans/crypto-zc67--implement-safety-number-verification.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement rotation API endpoints ([api-koty](.beans/api-koty--implement-rotation-api-endpoints.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement client-side rotation worker ([client-cdhw](.beans/client-cdhw--implement-client-side-rotation-worker.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Signature operations ([crypto-0jcf](.beans/crypto-0jcf--signature-operations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement NativeMemzero JSI module ([crypto-14ct](.beans/crypto-14ct--implement-nativememzero-jsi-module.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Key grant operations ([crypto-cqyz](.beans/crypto-cqyz--key-grant-operations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Platform key storage abstraction ([crypto-mdsw](.beans/crypto-mdsw--platform-key-storage-abstraction.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Per-bucket key management ([crypto-mp96](.beans/crypto-mp96--per-bucket-key-management.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption tier helpers ([crypto-rawi](.beans/crypto-rawi--encryption-tier-helpers.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key generation ([crypto-sa91](.beans/crypto-sa91--recovery-key-generation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement rotation ledger DB schema ([db-xzj3](.beans/db-xzj3--implement-rotation-ledger-db-schema.md))

### Epic: Key recovery protocol ([crypto-89v7](.beans/crypto-89v7--key-recovery-protocol.md))

> Recovery key generation, multi-device key transfer (ADR 011)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Password reset via recovery key ([crypto-gd6i](.beans/crypto-gd6i--password-reset-via-recovery-key.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key encrypted backup ([crypto-j381](.beans/crypto-j381--recovery-key-encrypted-backup.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Multi-device key transfer protocol ([crypto-qiwh](.beans/crypto-qiwh--multi-device-key-transfer-protocol.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key regeneration ([crypto-vgn3](.beans/crypto-vgn3--recovery-key-regeneration.md))

### Epic: Nomenclature system ([ps-iawz](.beans/ps-iawz--nomenclature-system.md))

> Configurable terminology for 8 term categories, UI-only (canonical API terms), stored per-system

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Term resolution utility ([ps-a68h](.beans/ps-a68h--term-resolution-utility.md))

### Epic: Sync protocol design ([sync-xlhb](.beans/sync-xlhb--sync-protocol-design.md))

> packages/sync — Automerge document structure, merge semantics, conflict resolution rules; co-designed with DB schema

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Merge semantics specification ([sync-5jne](.beans/sync-5jne--merge-semantics-specification.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Conflict resolution rules ([sync-80bn](.beans/sync-80bn--conflict-resolution-rules.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption integration for sync ([sync-jr85](.beans/sync-jr85--encryption-integration-for-sync.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Partial replication strategy ([sync-mgcd](.beans/sync-mgcd--partial-replication-strategy.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Automerge integration ([sync-pl87](.beans/sync-pl87--automerge-integration.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Sync protocol messages ([sync-t1rl](.beans/sync-t1rl--sync-protocol-messages.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Document lifecycle management ([sync-tf2p](.beans/sync-tf2p--document-lifecycle-management.md))

### Epic: i18n infrastructure ([ps-7z0s](.beans/ps-7z0s--i18n-infrastructure.md))

> String externalization, translation framework, RTL support, locale formatting — features.md section 11

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Locale formatting utilities ([ps-duny](.beans/ps-duny--locale-formatting-utilities.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) i18n framework setup ([ps-jkpn](.beans/ps-jkpn--i18n-framework-setup.md))

### Miscellaneous

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Pin tRPC to specific RC version ([infra-38x0](.beans/infra-38x0--pin-trpc-to-specific-rc-version.md))

## Milestone: Milestone 2: API Core ([ps-rdqo](.beans/ps-rdqo--milestone-2-api-core.md))

> Authentication, identity management, core CRUD

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Create concrete API specification ([api-g954](.beans/api-g954--create-concrete-api-specification.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Zod and TypeScript type alignment strategy ([types-onob](.beans/types-onob--zod-and-typescript-type-alignment-strategy.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add contract tests between types and Zod schemas ([types-yk6p](.beans/types-yk6p--add-contract-tests-between-types-and-zod-schemas.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Enforce encrypted/decrypted type boundary at compile time ([types-ywkj](.beans/types-ywkj--enforce-encrypteddecrypted-type-boundary-at-compil.md))

## No Milestone

- ![bug](https://img.shields.io/badge/bug-d73a4a?style=flat-square) Validate switches.memberIds against system member IDs at app layer ([db-19ae](.beans/db-19ae--validate-switchesmemberids-against-system-member-i.md))
- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Second-pass zero-knowledge hardening for member-identifying columns ([db-jpjm](.beans/db-jpjm--second-pass-zero-knowledge-hardening-for-member-id.md))
- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Official client SDKs ([ps-pzai](.beans/ps-pzai--official-client-sdks.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Validate ReactNativeSodiumAdapter tests in real RN environment ([crypto-jz77](.beans/crypto-jz77--validate-reactnativesodiumadapter-tests-in-real-rn.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Document systemSettings PK migration strategy ([db-0vmy](.beans/db-0vmy--document-systemsettings-pk-migration-strategy.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Scheduled orphan cleanup job for bucketContentTags ([db-7qzc](.beans/db-7qzc--scheduled-orphan-cleanup-job-for-bucketcontenttags.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Migrate SQLite to SQLCipher for local encryption-at-rest ([db-l49z](.beans/db-l49z--migrate-sqlite-to-sqlcipher-for-local-encryption-a.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Deduplicate type aliases in pg/index.ts and sqlite/index.ts ([db-lrk6](.beans/db-lrk6--deduplicate-type-aliases-in-pgindexts-and-sqlitein.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add CHECK constraints for wakingStart/wakingEnd time format ([db-ncuh](.beans/db-ncuh--add-check-constraints-for-wakingstartwakingend-tim.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Adopt branded ID types in search module interfaces ([db-vn6b](.beans/db-vn6b--adopt-branded-id-types-in-search-module-interfaces.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Refactor versionCheck boilerplate into versioned() helper ([db-z681](.beans/db-z681--refactor-versioncheck-boilerplate-into-versioned-h.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Abstract console methods into structured logging module ([infra-tclx](.beans/infra-tclx--abstract-console-methods-into-structured-logging-m.md))
