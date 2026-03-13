# ADR 022: System Structure Snapshots

## Status

Accepted

## Context

Systems evolve over time — members are discovered, structures change, relationships shift. Users (and their therapists) want to see what the system looked like at a specific point in time. There is no current mechanism to capture a frozen view of system state. The app has an offline-first, E2E encrypted architecture — snapshots must respect the zero-knowledge model.

## Decision

- Introduce system snapshots: point-in-time captures of system structure state
- Two trigger modes: manual (user-initiated) and scheduled (configurable: daily, weekly, or disabled)
- Snapshot content scope: members (text-only, no images), subsystems, side systems, layers, relationships, memberships, cross-structure links, groups, innerworld regions and entities
- Explicitly excluded from snapshots: fronting history, messages, journal entries, notes, photos (these are too large and change too frequently)
- Snapshots are view-only — no revert capability in v1 (future extensibility is preserved)
- Storage: new `system_snapshots` table with `id`, `systemId`, trigger type, `encryptedData` (T1), `createdAt`
- Snapshot content is serialized as a `SnapshotContent` JSON blob, encrypted with the system's T1 master key
- Name and description fields live inside the encrypted blob (T1 — server cannot read snapshot names)
- Scheduled snapshots use the existing background job infrastructure (BullMQ for hosted, SQLite-backed for self-hosted)
- Client-side creation: client pulls all relevant data, serializes to `SnapshotContent`, encrypts, uploads
- No CRDT sync for snapshots — they are local-only immutable records
- Setting: `snapshotSchedule` on SystemSettings (default: `"disabled"`)

## Consequences

- Storage grows linearly with snapshot count — but snapshots are text-only (no images), so each is relatively small
- Scheduled snapshots require the background job system to be running
- Snapshot data may become stale if the snapshot format changes — version the `SnapshotContent` schema if needed later
- No revert capability means users cannot roll back to a previous state — but they can compare current state to any snapshot
- Future features (revert, diff between snapshots) are possible without schema changes
- Snapshot creation is a client-side operation — the server never sees the plaintext content
- For self-hosted minimal tier: snapshots are created when the app is open (no background scheduling without Valkey)
