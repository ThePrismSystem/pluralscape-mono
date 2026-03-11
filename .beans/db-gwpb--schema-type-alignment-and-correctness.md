---
# db-gwpb
title: Schema-type alignment and correctness
status: todo
type: feature
created_at: 2026-03-11T19:39:29Z
updated_at: 2026-03-11T19:39:29Z
parent: db-2je4
---

Fix every mismatch between DB schema and canonical types — each is a runtime error waiting to happen in M2 API routes. Includes CI-enforced parity tests.

## Consolidates

db-y7ct, db-uvco, db-38it, db-8h0o, db-h1ns, db-vnfk, db-e3ql, db-grmv, db-t5wu, db-auki

## Tasks

- [ ] Add type parity tests between DB schema and canonical types — CI-enforced (db-y7ct)
- [ ] Fix system_settings PK mismatch with types (db-uvco)
- [ ] Resolve switches.encryptedData column vs Switch type mismatch (db-38it)
- [ ] Fix fronting_comments column naming mismatch (db-8h0o)
- [ ] Fix sessions.deviceInfo type mismatch (db-h1ns)
- [ ] Fix member_photos.sortOrder nullable mismatch (db-vnfk)
- [ ] Fix bucketContentTags.entityType enum type (db-e3ql)
- [ ] Fix bucket_content_tags entity_type wrong enum (db-grmv)
- [ ] Add fronting_reports table (db-t5wu)
- [ ] Fix importJobs.updatedAt nullable inconsistency (db-auki)
