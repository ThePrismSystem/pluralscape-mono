# Roadmap

## Milestone: Milestone 1: Data Layer ([ps-vtws](.beans/ps-vtws--milestone-1-data-layer.md))

> Domain types, database schema, encryption primitives, sync protocol design, i18n foundation

### Epic: Database schema ([db-2je4](.beans/db-2je4--database-schema.md))

> packages/db — Drizzle schema for PostgreSQL + SQLite, co-designed with CRDT sync requirements

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Blob metadata table ([db-1dza](.beans/db-1dza--blob-metadata-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Timer and check-in tables ([db-1icu](.beans/db-1icu--timer-and-check-in-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Journal and wiki tables ([db-2e2s](.beans/db-2e2s--journal-and-wiki-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) API key tables ([db-3h1c](.beans/db-3h1c--api-key-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) RLS and dialect-specific features ([db-771z](.beans/db-771z--rls-and-dialect-specific-features.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Privacy bucket tables ([db-7er7](.beans/db-7er7--privacy-bucket-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Fronting tables ([db-82q2](.beans/db-82q2--fronting-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Nomenclature settings table ([db-8su3](.beans/db-8su3--nomenclature-settings-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Drizzle project setup ([db-9f6f](.beans/db-9f6f--drizzle-project-setup.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Core tables ([db-i2gl](.beans/db-i2gl--core-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Communication tables ([db-ju0q](.beans/db-ju0q--communication-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) System structure tables ([db-k37y](.beans/db-k37y--system-structure-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Security audit log table ([db-k9sr](.beans/db-k9sr--security-audit-log-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Member lifecycle events table ([db-kk2l](.beans/db-kk2l--member-lifecycle-events-table.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Webhook configuration tables ([db-nodl](.beans/db-nodl--webhook-configuration-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Groups and folders tables ([db-puza](.beans/db-puza--groups-and-folders-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Account and auth tables ([db-s6p9](.beans/db-s6p9--account-and-auth-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Custom fields tables ([db-tu5g](.beans/db-tu5g--custom-fields-tables.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Innerworld tables ([db-vfhd](.beans/db-vfhd--innerworld-tables.md))

### Epic: Domain types ([types-im7i](.beans/types-im7i--domain-types.md))

> packages/types — system, member, fronting, chat, privacy bucket, etc.

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Flesh out system structure types and polyfragmented modeling ([ps-qvj0](.beans/ps-qvj0--flesh-out-system-structure-types-and-polyfragmente.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Custom field types ([types-0jjx](.beans/types-0jjx--custom-field-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Member lifecycle event types ([types-296i](.beans/types-296i--member-lifecycle-event-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Blob metadata types ([types-41na](.beans/types-41na--blob-metadata-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Communication types ([types-8klm](.beans/types-8klm--communication-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption tier type annotations ([types-ae5n](.beans/types-ae5n--encryption-tier-type-annotations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Shared utility types and ID system ([types-av6x](.beans/types-av6x--shared-utility-types-and-id-system.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Group and folder types ([types-c2eu](.beans/types-c2eu--group-and-folder-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Core identity types ([types-fid9](.beans/types-fid9--core-identity-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Fronting and switching types ([types-itej](.beans/types-itej--fronting-and-switching-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Innerworld and spatial types ([types-iz5j](.beans/types-iz5j--innerworld-and-spatial-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Security audit log types ([types-j2h3](.beans/types-j2h3--security-audit-log-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Webhook configuration types ([types-m97b](.beans/types-m97b--webhook-configuration-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Timer and check-in types ([types-nsfu](.beans/types-nsfu--timer-and-check-in-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Journal and wiki types ([types-puxp](.beans/types-puxp--journal-and-wiki-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Privacy bucket types ([types-qryr](.beans/types-qryr--privacy-bucket-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) System structure and relationship types ([types-rwnq](.beans/types-rwnq--system-structure-and-relationship-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) API key types ([types-xay7](.beans/types-xay7--api-key-types.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Timer and check-in types ([types-xmsf](.beans/types-xmsf--timer-and-check-in-types.md))

### Epic: Encryption layer ([crypto-gd8f](.beans/crypto-gd8f--encryption-layer.md))

> packages/crypto — libsodium wrappers, key derivation, per-bucket keys, three-tier encryption model (ADR 006)

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Signature operations ([crypto-0jcf](.beans/crypto-0jcf--signature-operations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Master key derivation ([crypto-afug](.beans/crypto-afug--master-key-derivation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Key grant operations ([crypto-cqyz](.beans/crypto-cqyz--key-grant-operations.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) libsodium cross-platform bindings ([crypto-d2tj](.beans/crypto-d2tj--libsodium-cross-platform-bindings.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Identity keypair generation ([crypto-l3hj](.beans/crypto-l3hj--identity-keypair-generation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Platform key storage abstraction ([crypto-mdsw](.beans/crypto-mdsw--platform-key-storage-abstraction.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Per-bucket key management ([crypto-mp96](.beans/crypto-mp96--per-bucket-key-management.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption tier helpers ([crypto-rawi](.beans/crypto-rawi--encryption-tier-helpers.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Recovery key generation ([crypto-sa91](.beans/crypto-sa91--recovery-key-generation.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Symmetric encryption/decryption ([crypto-xbjk](.beans/crypto-xbjk--symmetric-encryptiondecryption.md))

### Epic: Nomenclature system ([ps-iawz](.beans/ps-iawz--nomenclature-system.md))

> Configurable terminology for 8 term categories, UI-only (canonical API terms), stored per-system

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Term resolution utility ([ps-a68h](.beans/ps-a68h--term-resolution-utility.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Nomenclature types and defaults ([types-g5oo](.beans/types-g5oo--nomenclature-types-and-defaults.md))

### Epic: Sync protocol design ([sync-xlhb](.beans/sync-xlhb--sync-protocol-design.md))

> packages/sync — Automerge document structure, merge semantics, conflict resolution rules; co-designed with DB schema

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Document topology design ([sync-2xog](.beans/sync-2xog--document-topology-design.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Merge semantics specification ([sync-5jne](.beans/sync-5jne--merge-semantics-specification.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Conflict resolution rules ([sync-80bn](.beans/sync-80bn--conflict-resolution-rules.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Encryption integration for sync ([sync-jr85](.beans/sync-jr85--encryption-integration-for-sync.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Partial replication strategy ([sync-mgcd](.beans/sync-mgcd--partial-replication-strategy.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Automerge integration ([sync-pl87](.beans/sync-pl87--automerge-integration.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Sync protocol messages ([sync-t1rl](.beans/sync-t1rl--sync-protocol-messages.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Document lifecycle management ([sync-tf2p](.beans/sync-tf2p--document-lifecycle-management.md))

### Epic: Test framework setup ([ps-jvnm](.beans/ps-jvnm--test-framework-setup.md))

> Vitest configuration, coverage thresholds, CI enforcement

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Vitest workspace configuration ([ps-6r0l](.beans/ps-6r0l--vitest-workspace-configuration.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Test factories and fixtures ([ps-7msx](.beans/ps-7msx--test-factories-and-fixtures.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Coverage configuration ([ps-mv06](.beans/ps-mv06--coverage-configuration.md))

### Epic: i18n infrastructure ([ps-7z0s](.beans/ps-7z0s--i18n-infrastructure.md))

> String externalization, translation framework, RTL support, locale formatting — features.md section 11

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Locale formatting utilities ([ps-duny](.beans/ps-duny--locale-formatting-utilities.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) i18n framework setup ([ps-jkpn](.beans/ps-jkpn--i18n-framework-setup.md))

## No Milestone

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Official client SDKs ([ps-pzai](.beans/ps-pzai--official-client-sdks.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add test coverage CI enforcement ([ps-m426](.beans/ps-m426--add-test-coverage-ci-enforcement.md))
