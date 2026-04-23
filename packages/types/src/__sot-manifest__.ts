import type {
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
  MemberServerMetadata,
  MemberWire,
} from "./encryption.js";
import type { AuditLogEntry } from "./entities/audit-log-entry.js";
import type { Member } from "./entities/member.js";

/**
 * Registry of every domain entity that participates in the types-as-SoT
 * parity gates. Each entry carries the canonical triple:
 *
 * - `domain` — the full decrypted domain shape (`<Entity>`)
 * - `server` — the server-visible Drizzle row shape (`<Entity>ServerMetadata`)
 * - `wire`   — the JSON-serialized HTTP shape (`<Entity>Wire`)
 *
 * Completeness checks in `packages/db` and `packages/validation` assert that
 * every Drizzle table and every Zod schema maps to a manifest entry, so
 * silently dropping an entity during fleet work fails CI.
 *
 * Phase 1 (pilot): Member + AuditLogEntry. Fleet (Phase 2) fills the rest.
 */
export type SotEntityManifest = {
  Member: { domain: Member; server: MemberServerMetadata; wire: MemberWire };
  AuditLogEntry: {
    domain: AuditLogEntry;
    server: AuditLogEntryServerMetadata;
    wire: AuditLogEntryWire;
  };
};
