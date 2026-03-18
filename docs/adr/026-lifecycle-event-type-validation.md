# ADR 026: Lifecycle Event Type-Specific Validation

## Status

Accepted

## Context

Lifecycle events track significant changes in a plural system: member splits,
fusions, dormancy transitions, structure moves, and more. The API accepts 13
distinct event types, each with different reference requirements (e.g., a split
needs a source member and result members; a structure-move needs from/to
structure IDs).

Because the detailed event data lives inside `encryptedData` (E2E encrypted),
the server cannot validate that the encrypted payload matches the declared event
type. This creates a gap where a client could submit, for example, a "split"
event with no member references, and the server would accept it.

The core tension is between the zero-knowledge encryption model (server cannot
read encrypted data) and the need for server-side referential integrity and
queryability.

### Options Considered

**Option A: Client-side validation only**

Keep all type-specific data in `encryptedData`. Rely on the client Zod schemas
to validate before submission. The server validates only the envelope (event
type string, occurred-at timestamp, encrypted data blob size).

- Pros: simplest server implementation, strict zero-knowledge
- Cons: no server-side integrity guarantee, no ability to query events by
  referenced member/structure, silent corruption if a client bug skips
  validation

**Option B: Plaintext metadata column with per-type schemas (chosen)**

Add a `plaintext_metadata` JSONB column to the `lifecycle_events` table
containing non-sensitive reference IDs (member IDs, structure IDs, entity IDs,
region IDs). These IDs are system-internal identifiers, not user-generated
content, and do not violate the zero-knowledge contract. Define per-event-type
Zod schemas that validate the metadata shape matches the declared event type.

- Pros: server can validate referential consistency, enables queries like "find
  all events for member X", metadata contains only opaque IDs (not user content)
- Cons: slight information leakage (server knows which members are referenced in
  which events), additional schema to maintain

**Option C: DB-layer CHECK constraints**

Use PostgreSQL CHECK constraints or triggers to validate the JSONB shape per
event type.

- Pros: defense in depth at the data layer
- Cons: complex CHECK expressions, hard to maintain across 13 event types,
  duplicates application-level validation, no benefit for SQLite self-hosted
  deployments

**Option D: Both API-layer and DB-layer validation**

Combine Options B and C.

- Pros: maximum safety
- Cons: high maintenance burden for 13 event types across two validation layers,
  not justified for append-only immutable records

## Decision

Adopt **Option B**: plaintext metadata column with API-layer per-type Zod
validation.

### Implementation Details

1. **Database**: `plaintext_metadata` JSONB column on `lifecycle_events` (PG) and
   equivalent TEXT/JSON column (SQLite). Nullable for backward compatibility.

2. **Validation schemas** (in `@pluralscape/validation`):
   - Each event type maps to a dedicated Zod schema defining required reference
     IDs (e.g., split requires `memberIds` with 2+ entries, discovery requires
     exactly 1 `memberIds` entry)
   - `validateLifecycleMetadata(eventType, metadata)` dispatches to the correct
     per-type schema
   - The envelope schema (`CreateLifecycleEventBodySchema`) validates the
     overall shape; the service layer calls `validateLifecycleMetadata` for
     type-specific rules

3. **Reference ID categories**:
   - `memberIds`: member references (split, fusion, merge, dormancy, etc.)
   - `structureIds`: subsystem/side-system/layer references (structure-move,
     subsystem-formation)
   - `entityIds`: innerworld entity references (innerworld-move)
   - `regionIds`: innerworld region references (innerworld-move)

4. **Referential integrity**: soft-checked via validation only. No FK constraints
   on the JSONB fields, since the IDs reference entities that may be archived or
   deleted after the event is recorded. Lifecycle events are append-only and
   immutable; they serve as a historical record.

## Consequences

### Easier

- Server can reject malformed events at creation time rather than silently
  accepting corrupt data
- Enables server-side queries filtering events by referenced member, structure,
  or region
- Audit trail is more trustworthy since reference IDs are validated against
  declared event type

### Harder

- Adding a new event type requires updating both the TypeScript type union and
  the corresponding Zod metadata schema
- Minor information leakage: server learns which opaque IDs are associated with
  which events (acceptable trade-off since IDs alone reveal no user content)
- Self-hosted SQLite deployments get the same validation via the API layer but
  lack the JSONB query operators available in PostgreSQL
