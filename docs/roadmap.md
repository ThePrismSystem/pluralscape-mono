# Roadmap

## Milestone: Milestone 2: API Core ([ps-rdqo](.beans/ps-rdqo--milestone-2-api-core.md))

> Authentication, identity management, core CRUD

- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement rotation API endpoints ([api-koty](.beans/api-koty--implement-rotation-api-endpoints.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement client-side rotation worker ([client-cdhw](.beans/client-cdhw--implement-client-side-rotation-worker.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add contract tests between types and Zod schemas ([types-yk6p](.beans/types-yk6p--add-contract-tests-between-types-and-zod-schemas.md))

## No Milestone

- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Second-pass zero-knowledge hardening for member-identifying columns ([db-jpjm](.beans/db-jpjm--second-pass-zero-knowledge-hardening-for-member-id.md))
- ![feature](https://img.shields.io/badge/feature-0e8a16?style=flat-square) Official client SDKs ([ps-pzai](.beans/ps-pzai--official-client-sdks.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Address PR review findings for ServerSafe type boundary ([types-3y2i](.beans/types-3y2i--address-pr-review-findings-for-serversafe-type-bou.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Throttle sessions.lastActive updates to reduce write amplification ([api-1clw](.beans/api-1clw--throttle-sessionslastactive-updates-to-reduce-writ.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Document webhook secret rotation procedure ([api-4pl2](.beans/api-4pl2--document-webhook-secret-rotation-procedure.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Audit and fix N+1 query patterns in API routes ([api-628l](.beans/api-628l--audit-and-fix-n1-query-patterns-in-api-routes.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Restructure error handler to new ApiErrorResponse format ([api-77rx](.beans/api-77rx--restructure-error-handler-to-new-apierrorresponse.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Validate switches.memberIds belong to same system at write time ([api-gt2o](.beans/api-gt2o--validate-switchesmemberids-belong-to-same-system-a.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Wire per-category rate limit middleware ([api-le53](.beans/api-le53--wire-per-category-rate-limit-middleware.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Enforce pagination cursor TTL expiry ([api-pfbj](.beans/api-pfbj--enforce-pagination-cursor-ttl-expiry.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add jitterFraction 0.2 to default retry policies ([api-u3jt](.beans/api-u3jt--add-jitterfraction-02-to-default-retry-policies.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement auth middleware when first authenticated route is added ([api-xmuv](.beans/api-xmuv--implement-auth-middleware-when-first-authenticated.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Validate ReactNativeSodiumAdapter tests in real RN environment ([crypto-jz77](.beans/crypto-jz77--validate-reactnativesodiumadapter-tests-in-real-rn.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Drop messages_system_id_idx after partitioning is stable ([db-1aw7](.beans/db-1aw7--drop-messages-system-id-idx-after-partitioning-is.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Review switches table partitioning needs ([db-6lhh](.beans/db-6lhh--review-switches-table-partitioning-needs.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Implement webhook delivery cleanup ([db-nh34](.beans/db-nh34--implement-webhook-delivery-cleanup.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Schedule audit log PII cleanup as recurring job ([infra-gvgo](.beans/infra-gvgo--schedule-audit-log-pii-cleanup-as-recurring-job.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Abstract console methods into structured logging module ([infra-tclx](.beans/infra-tclx--abstract-console-methods-into-structured-logging-m.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Adopt domain-specific constants file pattern across codebase ([ps-coog](.beans/ps-coog--adopt-domain-specific-constants-file-pattern-acros.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Audit and remove deprecated code, re-exports, and compat shims ([ps-tthd](.beans/ps-tthd--audit-and-remove-deprecated-code-re-exports-and-co.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add Sha256Hex branded type for blob_metadata.checksum ([types-aqmu](.beans/types-aqmu--add-sha256hex-branded-type-for-blob-metadatachecks.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Define concrete payload types for all 15 JobPayloadMap entries ([types-vnhp](.beans/types-vnhp--define-concrete-payload-types-for-all-15-jobpayloa.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add branded types for keyVersion and displayKey ([crypto-249b](.beans/crypto-249b--add-branded-types-for-keyversion-and-displaykey.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Add cache max size / LRU eviction to BucketKeyCache ([crypto-o5dr](.beans/crypto-o5dr--add-cache-max-size-lru-eviction-to-bucketkeycache.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Re-evaluate audit_log.detail encryption tier (T1 vs T3) ([db-kcmt](.beans/db-kcmt--re-evaluate-audit-logdetail-encryption-tier-t1-vs.md))
- ![task](https://img.shields.io/badge/task-1d76db?style=flat-square) Introduce branded protocol IDs ([sync-5gdu](.beans/sync-5gdu--introduce-branded-protocol-ids.md))
