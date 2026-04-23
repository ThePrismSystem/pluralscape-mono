import type {
  AuditLogEntry,
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
} from "./entities/audit-log-entry.js";
import type { CustomFront, CustomFrontEncryptedFields } from "./entities/custom-front.js";
import type {
  FieldDefinition,
  FieldDefinitionEncryptedFields,
} from "./entities/field-definition.js";
import type { Group, GroupEncryptedFields } from "./entities/group.js";
import type { MemberPhoto, MemberPhotoEncryptedFields } from "./entities/member-photo.js";
import type {
  Member,
  MemberEncryptedFields,
  MemberServerMetadata,
  MemberWire,
} from "./entities/member.js";
import type { System, SystemEncryptedFields } from "./entities/system.js";

/**
 * Registry of every domain entity that participates in the types-as-SoT
 * parity gates. Each entry carries the canonical triple:
 *
 * - `domain` — the full decrypted domain shape (`<Entity>`)
 * - `server` — the server-visible Drizzle row shape (`<Entity>ServerMetadata`)
 * - `wire`   — the JSON-serialized HTTP shape (`<Entity>Wire`)
 * - `encryptedFields` — keys-union of encrypted fields
 *
 * Completeness checks in `packages/db` and `packages/validation` assert that
 * every Drizzle table and every Zod schema maps to a manifest entry, so
 * silently dropping an entity during fleet work fails CI.
 *
 * Phase 1 (pilot): Member + AuditLogEntry carry the full triple (domain +
 * server + wire + encryptedFields). Fleet (Phase 2) currently populates
 * only `domain` + `encryptedFields` per entity; `server` / `wire` are
 * filled in when each entity's ServerMetadata/Wire types land.
 */
export type SotEntityManifest = {
  Member: {
    domain: Member;
    server: MemberServerMetadata;
    wire: MemberWire;
    encryptedFields: MemberEncryptedFields;
  };
  AuditLogEntry: {
    domain: AuditLogEntry;
    server: AuditLogEntryServerMetadata;
    wire: AuditLogEntryWire;
    // Plaintext wire — no encrypted fields.
    encryptedFields: never;
  };
  System: {
    domain: System;
    encryptedFields: SystemEncryptedFields;
  };
  MemberPhoto: {
    domain: MemberPhoto;
    encryptedFields: MemberPhotoEncryptedFields;
  };
  Group: {
    domain: Group;
    encryptedFields: GroupEncryptedFields;
  };
  CustomFront: {
    domain: CustomFront;
    encryptedFields: CustomFrontEncryptedFields;
  };
  FieldDefinition: {
    domain: FieldDefinition;
    encryptedFields: FieldDefinitionEncryptedFields;
  };
};
