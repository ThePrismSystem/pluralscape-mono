import type {
  AccountPurgeRequest,
  AccountPurgeRequestServerMetadata,
  AccountPurgeRequestWire,
} from "./entities/account-purge-request.js";
import type { Account, AccountServerMetadata, AccountWire } from "./entities/account.js";
import type { ApiKey, ApiKeyServerMetadata, ApiKeyWire } from "./entities/api-key.js";
import type {
  AuditLogEntry,
  AuditLogEntryServerMetadata,
  AuditLogEntryWire,
} from "./entities/audit-log-entry.js";
import type { AuthKey, AuthKeyServerMetadata, AuthKeyWire } from "./entities/auth-key.js";
import type {
  CheckInRecord,
  CheckInRecordServerMetadata,
  CheckInRecordWire,
} from "./entities/check-in-record.js";
import type {
  CustomFront,
  CustomFrontEncryptedFields,
  CustomFrontServerMetadata,
  CustomFrontWire,
} from "./entities/custom-front.js";
import type {
  DeviceToken,
  DeviceTokenServerMetadata,
  DeviceTokenWire,
} from "./entities/device-token.js";
import type {
  DeviceTransferRequest,
  DeviceTransferRequestServerMetadata,
  DeviceTransferRequestWire,
} from "./entities/device-transfer-request.js";
import type {
  FieldDefinitionScope,
  FieldDefinitionScopeServerMetadata,
  FieldDefinitionScopeWire,
} from "./entities/field-definition-scope.js";
import type {
  FieldDefinition,
  FieldDefinitionEncryptedFields,
  FieldDefinitionServerMetadata,
  FieldDefinitionWire,
} from "./entities/field-definition.js";
import type {
  FieldValue,
  FieldValueEncryptedFields,
  FieldValueServerMetadata,
  FieldValueWire,
} from "./entities/field-value.js";
import type {
  FrontingComment,
  FrontingCommentEncryptedFields,
  FrontingCommentServerMetadata,
  FrontingCommentWire,
} from "./entities/fronting-comment.js";
import type {
  FrontingSession,
  FrontingSessionEncryptedFields,
  FrontingSessionServerMetadata,
  FrontingSessionWire,
} from "./entities/fronting-session.js";
import type {
  Group,
  GroupEncryptedFields,
  GroupServerMetadata,
  GroupWire,
} from "./entities/group.js";
import type {
  InnerWorldCanvas,
  InnerWorldCanvasEncryptedFields,
  InnerWorldCanvasServerMetadata,
  InnerWorldCanvasWire,
} from "./entities/innerworld-canvas.js";
import type {
  InnerWorldEntity,
  InnerWorldEntityEncryptedFields,
  InnerWorldEntityServerMetadata,
  InnerWorldEntityWire,
} from "./entities/innerworld-entity.js";
import type {
  InnerWorldRegion,
  InnerWorldRegionEncryptedFields,
  InnerWorldRegionServerMetadata,
  InnerWorldRegionWire,
} from "./entities/innerworld-region.js";
import type {
  LifecycleEvent,
  LifecycleEventEncryptedFields,
  LifecycleEventServerMetadata,
  LifecycleEventWire,
} from "./entities/lifecycle-event.js";
import type {
  MemberPhoto,
  MemberPhotoEncryptedFields,
  MemberPhotoServerMetadata,
  MemberPhotoWire,
} from "./entities/member-photo.js";
import type {
  Member,
  MemberEncryptedFields,
  MemberServerMetadata,
  MemberWire,
} from "./entities/member.js";
import type {
  RecoveryKey,
  RecoveryKeyServerMetadata,
  RecoveryKeyWire,
} from "./entities/recovery-key.js";
import type {
  Relationship,
  RelationshipEncryptedFields,
  RelationshipServerMetadata,
  RelationshipWire,
} from "./entities/relationship.js";
import type { Session, SessionServerMetadata, SessionWire } from "./entities/session.js";
import type {
  SystemStructureEntityAssociation,
  SystemStructureEntityAssociationEncryptedFields,
  SystemStructureEntityAssociationServerMetadata,
  SystemStructureEntityAssociationWire,
} from "./entities/structure-entity-association.js";
import type {
  SystemStructureEntityLink,
  SystemStructureEntityLinkServerMetadata,
  SystemStructureEntityLinkWire,
} from "./entities/structure-entity-link.js";
import type {
  SystemStructureEntityMemberLink,
  SystemStructureEntityMemberLinkEncryptedFields,
  SystemStructureEntityMemberLinkServerMetadata,
  SystemStructureEntityMemberLinkWire,
} from "./entities/structure-entity-member-link.js";
import type {
  SystemStructureEntityType,
  SystemStructureEntityTypeEncryptedFields,
  SystemStructureEntityTypeServerMetadata,
  SystemStructureEntityTypeWire,
} from "./entities/structure-entity-type.js";
import type {
  SystemStructureEntity,
  SystemStructureEntityEncryptedFields,
  SystemStructureEntityServerMetadata,
  SystemStructureEntityWire,
} from "./entities/structure-entity.js";
import type {
  SystemSettings,
  SystemSettingsEncryptedFields,
  SystemSettingsServerMetadata,
  SystemSettingsWire,
} from "./entities/system-settings.js";
import type {
  SystemSnapshot,
  SystemSnapshotServerMetadata,
  SystemSnapshotWire,
} from "./entities/system-snapshot.js";
import type {
  System,
  SystemEncryptedFields,
  SystemServerMetadata,
  SystemWire,
} from "./entities/system.js";
import type {
  NomenclatureEncryptedFields,
  NomenclatureServerMetadata,
  NomenclatureSettings,
  NomenclatureWire,
} from "./nomenclature.js";

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
  Account: {
    domain: Account;
    server: AccountServerMetadata;
    wire: AccountWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  System: {
    domain: System;
    server: SystemServerMetadata;
    wire: SystemWire;
    encryptedFields: SystemEncryptedFields;
  };
  MemberPhoto: {
    domain: MemberPhoto;
    server: MemberPhotoServerMetadata;
    wire: MemberPhotoWire;
    encryptedFields: MemberPhotoEncryptedFields;
  };
  Group: {
    domain: Group;
    server: GroupServerMetadata;
    wire: GroupWire;
    encryptedFields: GroupEncryptedFields;
  };
  CustomFront: {
    domain: CustomFront;
    server: CustomFrontServerMetadata;
    wire: CustomFrontWire;
    encryptedFields: CustomFrontEncryptedFields;
  };
  FieldDefinition: {
    domain: FieldDefinition;
    server: FieldDefinitionServerMetadata;
    wire: FieldDefinitionWire;
    encryptedFields: FieldDefinitionEncryptedFields;
  };
  FieldDefinitionScope: {
    domain: FieldDefinitionScope;
    server: FieldDefinitionScopeServerMetadata;
    wire: FieldDefinitionScopeWire;
    // Plaintext entity — no encrypted fields.
    encryptedFields: never;
  };
  FieldValue: {
    domain: FieldValue;
    server: FieldValueServerMetadata;
    wire: FieldValueWire;
    encryptedFields: FieldValueEncryptedFields;
  };
  Relationship: {
    domain: Relationship;
    server: RelationshipServerMetadata;
    wire: RelationshipWire;
    encryptedFields: RelationshipEncryptedFields;
  };
  StructureEntityType: {
    domain: SystemStructureEntityType;
    server: SystemStructureEntityTypeServerMetadata;
    wire: SystemStructureEntityTypeWire;
    encryptedFields: SystemStructureEntityTypeEncryptedFields;
  };
  StructureEntity: {
    domain: SystemStructureEntity;
    server: SystemStructureEntityServerMetadata;
    wire: SystemStructureEntityWire;
    encryptedFields: SystemStructureEntityEncryptedFields;
  };
  FrontingSession: {
    domain: FrontingSession;
    server: FrontingSessionServerMetadata;
    wire: FrontingSessionWire;
    encryptedFields: FrontingSessionEncryptedFields;
  };
  FrontingComment: {
    domain: FrontingComment;
    server: FrontingCommentServerMetadata;
    wire: FrontingCommentWire;
    encryptedFields: FrontingCommentEncryptedFields;
  };
  LifecycleEvent: {
    domain: LifecycleEvent;
    server: LifecycleEventServerMetadata;
    wire: LifecycleEventWire;
    encryptedFields: LifecycleEventEncryptedFields;
  };
  InnerworldRegion: {
    domain: InnerWorldRegion;
    server: InnerWorldRegionServerMetadata;
    wire: InnerWorldRegionWire;
    encryptedFields: InnerWorldRegionEncryptedFields;
  };
  InnerworldEntity: {
    domain: InnerWorldEntity;
    server: InnerWorldEntityServerMetadata;
    wire: InnerWorldEntityWire;
    encryptedFields: InnerWorldEntityEncryptedFields;
  };
  InnerworldCanvas: {
    domain: InnerWorldCanvas;
    server: InnerWorldCanvasServerMetadata;
    wire: InnerWorldCanvasWire;
    encryptedFields: InnerWorldCanvasEncryptedFields;
  };
  SystemSettings: {
    domain: SystemSettings;
    server: SystemSettingsServerMetadata;
    wire: SystemSettingsWire;
    encryptedFields: SystemSettingsEncryptedFields;
  };
  SystemSnapshot: {
    domain: SystemSnapshot;
    server: SystemSnapshotServerMetadata;
    wire: SystemSnapshotWire;
    // Hybrid entity: plaintext metadata + opaque `encryptedData` blob whose
    // decrypted shape (`SnapshotContent`) lives in its own type, not as a
    // keys-subset of `SystemSnapshot`. No `encryptedFields` union.
    encryptedFields: never;
  };
  StructureEntityMemberLink: {
    domain: SystemStructureEntityMemberLink;
    server: SystemStructureEntityMemberLinkServerMetadata;
    wire: SystemStructureEntityMemberLinkWire;
    encryptedFields: SystemStructureEntityMemberLinkEncryptedFields;
  };
  StructureEntityAssociation: {
    domain: SystemStructureEntityAssociation;
    server: SystemStructureEntityAssociationServerMetadata;
    wire: SystemStructureEntityAssociationWire;
    encryptedFields: SystemStructureEntityAssociationEncryptedFields;
  };
  ApiKey: {
    domain: ApiKey;
    server: ApiKeyServerMetadata;
    wire: ApiKeyWire;
    // Plaintext entity at the domain level — server splits domain fields
    // across flat columns + opaque `encryptedData`; no domain-level
    // encryptedFields keys-union exists.
    encryptedFields: never;
  };
  AuthKey: {
    domain: AuthKey;
    server: AuthKeyServerMetadata;
    wire: AuthKeyWire;
    encryptedFields: never;
  };
  DeviceToken: {
    domain: DeviceToken;
    server: DeviceTokenServerMetadata;
    wire: DeviceTokenWire;
    encryptedFields: never;
  };
  RecoveryKey: {
    domain: RecoveryKey;
    server: RecoveryKeyServerMetadata;
    wire: RecoveryKeyWire;
    encryptedFields: never;
  };
  AccountPurgeRequest: {
    domain: AccountPurgeRequest;
    server: AccountPurgeRequestServerMetadata;
    wire: AccountPurgeRequestWire;
    encryptedFields: never;
  };
  DeviceTransferRequest: {
    domain: DeviceTransferRequest;
    server: DeviceTransferRequestServerMetadata;
    wire: DeviceTransferRequestWire;
    encryptedFields: never;
  };
  Session: {
    domain: Session;
    server: SessionServerMetadata;
    wire: SessionWire;
    // Plaintext entity — no encrypted fields in the domain keyset.
    encryptedFields: never;
  };
  StructureEntityLink: {
    domain: SystemStructureEntityLink;
    server: SystemStructureEntityLinkServerMetadata;
    wire: SystemStructureEntityLinkWire;
    // Plaintext entity — no client-side encryption; never needed.
    encryptedFields: never;
  };
  Nomenclature: {
    domain: NomenclatureSettings;
    server: NomenclatureServerMetadata;
    wire: NomenclatureWire;
    encryptedFields: NomenclatureEncryptedFields;
  };
  CheckInRecord: {
    domain: CheckInRecord;
    server: CheckInRecordServerMetadata;
    wire: CheckInRecordWire;
    // Hybrid entity: plaintext domain with optional `encryptedData` blob
    // (server-only column; no keys-subset of `CheckInRecord`).
    encryptedFields: never;
  };
};
