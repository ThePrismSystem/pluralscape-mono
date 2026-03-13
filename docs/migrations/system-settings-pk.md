# Migration: system_settings PK Change

**Bean**: db-0vmy
**Status**: Planned — execute before schema ships to production

---

## Background

The `system_settings` table previously used `system_id` as its primary key (a 1:1 FK into `systems`). The schema was updated to:

1. Add a surrogate `id` UUID as the new primary key, with `system_id` demoted to `UNIQUE NOT NULL`.
2. Move `littles_safe_mode_enabled` (a plaintext boolean column) into the `encrypted_data` blob, so it is encrypted at rest under the system's master key alongside other sensitive settings.

The current schema (post-change) is the source of truth in `packages/db/src/schema/pg/system-settings.ts` and the SQLite equivalent. This document covers how to migrate rows from the old shape to the new one.

---

## Pre-Migration State

```sql
-- OLD: system_id was the PK; littles_safe_mode_enabled was a plaintext column
CREATE TABLE system_settings (
  system_id       VARCHAR PRIMARY KEY REFERENCES systems(id) ON DELETE CASCADE,
  locale          VARCHAR(255),
  pin_hash        VARCHAR(512),
  biometric_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  littles_safe_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted_data  BYTEA NOT NULL,
  -- ...timestamps, version
);
```

## Post-Migration State

```sql
-- NEW: surrogate id PK; system_id is UNIQUE NOT NULL; littles_safe_mode_enabled gone
CREATE TABLE system_settings (
  id              VARCHAR PRIMARY KEY,
  system_id       VARCHAR NOT NULL UNIQUE REFERENCES systems(id) ON DELETE CASCADE,
  locale          VARCHAR(255),
  pin_hash        VARCHAR(512),
  biometric_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  encrypted_data  BYTEA NOT NULL,
  -- ...timestamps, version
);
```

---

## Migration Steps (PostgreSQL)

The entire migration must execute inside a single transaction. If any step fails — especially encryption — the whole transaction rolls back and the table is left unchanged.

### Step 1 — Encrypt `littles_safe_mode_enabled` into `encrypted_data`

This step must be performed in application code (not raw SQL) because it requires the system's master key. The migration runner fetches each row, merges `littlesSafeModeEnabled` into the plaintext payload, re-encrypts, and writes the updated blob back.

```
for each row in system_settings:
  plaintext = decrypt(row.encrypted_data, masterKey[row.system_id])
  plaintext.littlesSafeModeEnabled = row.littles_safe_mode_enabled
  row.encrypted_data = encrypt(plaintext, masterKey[row.system_id])
  UPDATE system_settings SET encrypted_data = ? WHERE system_id = row.system_id
```

If decryption or encryption throws for any row, abort and roll back.

**Verification before proceeding**: after updating all blobs, re-read and decrypt every row to confirm `littlesSafeModeEnabled` is present and matches the original plaintext value.

### Step 2 — Add the `id` column

```sql
ALTER TABLE system_settings ADD COLUMN id VARCHAR(128);
UPDATE system_settings SET id = gen_random_uuid()::text WHERE id IS NULL;
ALTER TABLE system_settings ALTER COLUMN id SET NOT NULL;
```

### Step 3 — Swap the primary key

PostgreSQL does not support `ALTER TABLE ... DROP PRIMARY KEY` directly. Use the constraint name:

```sql
-- Drop the old PK (was on system_id)
ALTER TABLE system_settings DROP CONSTRAINT system_settings_pkey;

-- Ensure system_id retains its UNIQUE NOT NULL guarantee
ALTER TABLE system_settings ALTER COLUMN system_id SET NOT NULL;
ALTER TABLE system_settings ADD CONSTRAINT system_settings_system_id_key UNIQUE (system_id);

-- Promote id to PK
ALTER TABLE system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);
```

### Step 4 — Drop `littles_safe_mode_enabled`

Only execute this after Step 1 verification passes.

```sql
ALTER TABLE system_settings DROP COLUMN littles_safe_mode_enabled;
```

---

## Rollback Strategy

Because the migration runs inside a single transaction, a failure at any step triggers an automatic rollback — the table is returned to its pre-migration state with no partial changes.

For a manual rollback after a committed migration:

```sql
BEGIN;

-- Restore the column with values from encrypted_data (requires app-layer decrypt)
ALTER TABLE system_settings ADD COLUMN littles_safe_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE;
-- (Application code re-reads blobs and populates the column here)

-- Remove the surrogate PK
ALTER TABLE system_settings DROP CONSTRAINT system_settings_pkey;
ALTER TABLE system_settings DROP COLUMN id;

-- Restore system_id as PK
ALTER TABLE system_settings DROP CONSTRAINT system_settings_system_id_key;
ALTER TABLE system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (system_id);

COMMIT;
```

After a manual rollback, any FK references to `system_settings.id` (introduced in dependent tables post-migration) must also be reverted before this script will succeed.

---

## Verification Steps

Run these checks after the migration commits, before closing the deployment window:

1. **Row count**: `SELECT COUNT(*) FROM system_settings` — must equal pre-migration count.
2. **PK is `id`**: query `information_schema.table_constraints` to confirm `system_settings_pkey` covers `id`.
3. **`system_id` unique constraint**: confirm `system_settings_system_id_key` exists.
4. **No NULL ids**: `SELECT COUNT(*) FROM system_settings WHERE id IS NULL` — must be 0.
5. **Column dropped**: `SELECT littles_safe_mode_enabled FROM system_settings LIMIT 1` must return an error (column does not exist).
6. **Blob integrity** (application-level): decrypt a sample of `encrypted_data` blobs and assert `littlesSafeModeEnabled` is present with a boolean value.

---

## SQLite Considerations

SQLite does not support `ALTER TABLE ... DROP COLUMN` on older versions (added in 3.35.0, 2021-03), and does not support dropping or adding constraints at all. The migration for SQLite (used by the mobile client and self-hosted single-binary tier) must use the table-recreation pattern:

```sql
-- 1. Create the new table
CREATE TABLE system_settings_new (
  id              TEXT PRIMARY KEY,
  system_id       TEXT NOT NULL UNIQUE REFERENCES systems(id) ON DELETE CASCADE,
  locale          TEXT,
  pin_hash        TEXT,
  biometric_enabled INTEGER NOT NULL DEFAULT 0,
  encrypted_data  BLOB NOT NULL,
  -- ...timestamps, version columns
);

-- 2. Copy rows (encrypted_data already updated by Step 1 above)
INSERT INTO system_settings_new
  SELECT
    (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
     substr(lower(hex(randomblob(2))),2) || '-' ||
     substr('89ab', abs(random()) % 4 + 1, 1) ||
     substr(lower(hex(randomblob(2))),2) || '-' ||
     lower(hex(randomblob(6)))) AS id,
    system_id, locale, pin_hash, biometric_enabled, encrypted_data
    -- ...timestamps, version
  FROM system_settings;

-- 3. Drop old table and rename
DROP TABLE system_settings;
ALTER TABLE system_settings_new RENAME TO system_settings;
```

> **Note**: SQLite's `randomblob`-based UUID generation is shown for illustration. In practice, the migration runner should generate UUIDs in application code and bind them as parameters rather than generating them in SQL.

SQLite migrations run entirely client-side on the device. The encryption step (Step 1) is performed by the app before the DDL changes, using the device-local master key. There is no server coordination required — each device migrates independently on first launch after the app update.

---

## Self-Hosted Deployment Impact

Self-hosted operators running the **full Docker Compose tier** use PostgreSQL — the standard migration steps above apply. The Drizzle migration runner executes automatically on container startup.

Self-hosted operators running the **single-binary (minimal) tier** use SQLite — the table-recreation path above applies. Because the binary manages the SQLite file directly, no operator action is required beyond upgrading the binary.

**Pre-upgrade checklist for self-hosted operators**:

- Back up the database before upgrading (`pg_dump` for PG, copy the `.db` file for SQLite).
- The migration is non-destructive until Step 4 (column drop). If the upgrade is interrupted between Steps 3 and 4, the next startup will detect the incomplete state and re-run from Step 1.
- There is no downtime requirement — the migration runs inside a transaction and the old schema remains readable until the transaction commits.

**Zero-knowledge note**: The server-side migration runner does not have access to system master keys. Step 1 (encrypt `littlesSafeModeEnabled`) must be triggered by the client on first authenticated connection after the upgrade. The server-side migration (Steps 2–4) can run independently of client availability, leaving `littles_safe_mode_enabled` in place until the client has confirmed blob migration for each row.
