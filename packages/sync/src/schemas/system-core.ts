import type { CrdtAuditFields, CrdtOptionalString, CrdtString } from "./common.js";

// ── system ──────────────────────────────────────────────────────────

/** CRDT representation of the System entity (singleton LWW at document root). */
export interface CrdtSystem extends CrdtAuditFields {
  id: CrdtString;
  name: CrdtString;
  displayName: CrdtOptionalString;
  description: CrdtOptionalString;
  /** JSON-serialized ImageSource | null */
  avatarSource: CrdtOptionalString;
  settingsId: CrdtString;
}

/** CRDT representation of SystemSettings (singleton LWW at document root). */
export interface CrdtSystemSettings extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  /** ThemePreference string */
  theme: CrdtString;
  fontScale: number;
  locale: CrdtOptionalString;
  defaultBucketId: CrdtOptionalString;
  /** JSON-serialized AppLockConfig */
  appLock: CrdtString;
  /** JSON-serialized NotificationPreferences */
  notifications: CrdtString;
  /** JSON-serialized SyncPreferences */
  syncPreferences: CrdtString;
  /** JSON-serialized PrivacyDefaults */
  privacyDefaults: CrdtString;
  /** JSON-serialized LittlesSafeModeConfig */
  littlesSafeMode: CrdtString;
  /** JSON-serialized NomenclatureSettings */
  nomenclature: CrdtString;
  saturationLevelsEnabled: boolean;
  autoCaptureFrontingOnJournal: boolean;
  /** JSON-serialized SnapshotSchedule */
  snapshotSchedule: CrdtString;
  onboardingComplete: boolean;
}

// ── member ──────────────────────────────────────────────────────────

/** CRDT representation of a Member (LWW map, keyed by MemberId). */
export interface CrdtMember extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  /** JSON-serialized string[] */
  pronouns: CrdtString;
  description: CrdtOptionalString;
  /** JSON-serialized ImageSource | null */
  avatarSource: CrdtOptionalString;
  /** JSON-serialized HexColor[] */
  colors: CrdtString;
  /** JSON-serialized SaturationLevel */
  saturationLevel: CrdtString;
  /** JSON-serialized Tag[] */
  tags: CrdtString;
  suppressFriendFrontNotification: boolean;
  boardMessageNotificationOnFront: boolean;
  archived: boolean;
}

/** CRDT representation of a MemberPhoto (LWW map, keyed by MemberPhotoId). */
export interface CrdtMemberPhoto {
  id: CrdtString;
  memberId: CrdtString;
  /** JSON-serialized ImageSource */
  imageSource: CrdtString;
  sortOrder: number;
  caption: CrdtOptionalString;
  archived: boolean;
}

// ── group ────────────────────────────────────────────────────────────

/** CRDT representation of a Group (LWW map, keyed by GroupId). */
export interface CrdtGroup extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  parentGroupId: CrdtOptionalString;
  /** JSON-serialized ImageSource | null */
  imageSource: CrdtOptionalString;
  color: CrdtOptionalString;
  emoji: CrdtOptionalString;
  sortOrder: number;
  archived: boolean;
}

// ── structure ────────────────────────────────────────────────────────

/** CRDT representation of a Subsystem (LWW map, keyed by SubsystemId). */
export interface CrdtSubsystem extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  parentSubsystemId: CrdtOptionalString;
  /** JSON-serialized ArchitectureType | null */
  architectureType: CrdtOptionalString;
  hasCore: boolean;
  /** DiscoveryStatus string */
  discoveryStatus: CrdtString;
  color: CrdtOptionalString;
  /** JSON-serialized ImageSource | null */
  imageSource: CrdtOptionalString;
  emoji: CrdtOptionalString;
  archived: boolean;
}

/** CRDT representation of a SideSystem (LWW map, keyed by SideSystemId). */
export interface CrdtSideSystem extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  color: CrdtOptionalString;
  /** JSON-serialized ImageSource | null */
  imageSource: CrdtOptionalString;
  emoji: CrdtOptionalString;
  archived: boolean;
}

/** CRDT representation of a Layer (LWW map, keyed by LayerId). */
export interface CrdtLayer extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  /** LayerAccessType string: "open" | "gatekept" */
  accessType: CrdtString;
  /** JSON-serialized MemberId[] */
  gatekeeperMemberIds: CrdtString;
  color: CrdtOptionalString;
  /** JSON-serialized ImageSource | null */
  imageSource: CrdtOptionalString;
  emoji: CrdtOptionalString;
  archived: boolean;
}

/** CRDT representation of a Relationship (LWW map, keyed by RelationshipId). */
export interface CrdtRelationship {
  id: CrdtString;
  systemId: CrdtString;
  sourceMemberId: CrdtString;
  targetMemberId: CrdtString;
  /** RelationshipType string */
  type: CrdtString;
  label: CrdtOptionalString;
  bidirectional: boolean;
  createdAt: number;
  archived: boolean;
}

// ── custom front ─────────────────────────────────────────────────────

/** CRDT representation of a CustomFront (LWW map, keyed by CustomFrontId). */
export interface CrdtCustomFront extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  color: CrdtOptionalString;
  emoji: CrdtOptionalString;
  archived: boolean;
}

// ── custom fields ────────────────────────────────────────────────────

/** CRDT representation of a FieldDefinition (LWW map, keyed by FieldDefinitionId). */
export interface CrdtFieldDefinition extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  /** FieldType string */
  fieldType: CrdtString;
  /** JSON-serialized string[] | null */
  options: CrdtOptionalString;
  required: boolean;
  sortOrder: number;
  archived: boolean;
}

/** CRDT representation of a FieldValue (LWW map, keyed by FieldValueId). */
export interface CrdtFieldValue extends CrdtAuditFields {
  id: CrdtString;
  fieldDefinitionId: CrdtString;
  memberId: CrdtString;
  /** JSON-serialized FieldValueUnion */
  value: CrdtString;
}

// ── innerworld ───────────────────────────────────────────────────────

/**
 * CRDT representation of an InnerWorldEntity (LWW map, keyed by InnerWorldEntityId).
 * Flattened from the discriminated union — discriminator-specific fields are null
 * when not applicable to the entity type.
 */
export interface CrdtInnerWorldEntity extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  /** InnerWorldEntityType string */
  entityType: CrdtString;
  positionX: number;
  positionY: number;
  /** JSON-serialized VisualProperties */
  visual: CrdtString;
  regionId: CrdtOptionalString;
  archived: boolean;
  // Discriminator-specific fields (null when not applicable)
  /** "member" type only — linked MemberId */
  linkedMemberId: CrdtOptionalString;
  /** "subsystem" type only — linked SubsystemId */
  linkedSubsystemId: CrdtOptionalString;
  /** "side-system" type only — linked SideSystemId */
  linkedSideSystemId: CrdtOptionalString;
  /** "layer" type only — linked LayerId */
  linkedLayerId: CrdtOptionalString;
  /** "landmark" type only */
  name: CrdtOptionalString;
  /** "landmark" type only */
  description: CrdtOptionalString;
}

/** CRDT representation of an InnerWorldRegion (LWW map, keyed by InnerWorldRegionId). */
export interface CrdtInnerWorldRegion extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  name: CrdtString;
  description: CrdtOptionalString;
  parentRegionId: CrdtOptionalString;
  /** JSON-serialized VisualProperties */
  visual: CrdtString;
  /** JSON-serialized { x: number; y: number }[] */
  boundaryData: CrdtString;
  /** LayerAccessType string: "open" | "gatekept" */
  accessType: CrdtString;
  /** JSON-serialized MemberId[] */
  gatekeeperMemberIds: CrdtString;
  archived: boolean;
}

// ── timer ────────────────────────────────────────────────────────────

/** CRDT representation of a TimerConfig (LWW map, keyed by TimerId). */
export interface CrdtTimer extends CrdtAuditFields {
  id: CrdtString;
  systemId: CrdtString;
  intervalMinutes: number | null;
  wakingHoursOnly: boolean | null;
  wakingStart: CrdtOptionalString;
  wakingEnd: CrdtOptionalString;
  promptText: CrdtString;
  enabled: boolean;
  archived: boolean;
}

// ── lifecycle events ─────────────────────────────────────────────────

/**
 * CRDT representation of a LifecycleEvent (append-only list in system-core).
 * Event-specific fields are serialized into `payload` to keep the list element
 * type uniform across all event types.
 */
export interface CrdtLifecycleEvent {
  id: CrdtString;
  systemId: CrdtString;
  /** LifecycleEventType string */
  eventType: CrdtString;
  occurredAt: number;
  recordedAt: number;
  notes: CrdtOptionalString;
  /** JSON-serialized event-specific fields (sourceMemberId, resultMemberIds, etc.) */
  payload: CrdtString;
}

// ── document ─────────────────────────────────────────────────────────

/**
 * Automerge document schema for the system-core document.
 *
 * Contains the structural definition of a system — member profiles, groups,
 * subsystems, layers, relationships, custom fronts, field definitions, settings,
 * innerworld, timers, junctions, and lifecycle events.
 *
 * Encryption key: Master key
 * Naming: system-core-{systemId}
 */
export interface SystemCoreDocument {
  // Singleton entities (one per document)
  system: CrdtSystem;
  systemSettings: CrdtSystemSettings;

  // Entity maps (keyed by entity ID) — LWW per field
  members: Record<string, CrdtMember>;
  memberPhotos: Record<string, CrdtMemberPhoto>;
  groups: Record<string, CrdtGroup>;
  subsystems: Record<string, CrdtSubsystem>;
  sideSystems: Record<string, CrdtSideSystem>;
  layers: Record<string, CrdtLayer>;
  relationships: Record<string, CrdtRelationship>;
  customFronts: Record<string, CrdtCustomFront>;
  fieldDefinitions: Record<string, CrdtFieldDefinition>;
  fieldValues: Record<string, CrdtFieldValue>;
  innerWorldEntities: Record<string, CrdtInnerWorldEntity>;
  innerWorldRegions: Record<string, CrdtInnerWorldRegion>;
  timers: Record<string, CrdtTimer>;

  /**
   * Junction maps (compound key "{id1}_{id2}" → true).
   * Add-wins semantics: concurrent add+remove results in the junction being present.
   */
  /** Key format: "{groupId}_{memberId}" */
  groupMemberships: Record<string, true>;
  /** Key format: "{subsystemId}_{memberId}" */
  subsystemMemberships: Record<string, true>;
  /** Key format: "{sideSystemId}_{memberId}" */
  sideSystemMemberships: Record<string, true>;
  /** Key format: "{layerId}_{memberId}" */
  layerMemberships: Record<string, true>;
  /** Key format: "{subsystemId}_{layerId}" */
  subsystemLayerLinks: Record<string, true>;
  /** Key format: "{subsystemId}_{sideSystemId}" */
  subsystemSideSystemLinks: Record<string, true>;
  /** Key format: "{sideSystemId}_{layerId}" */
  sideSystemLayerLinks: Record<string, true>;

  /** Append-only lifecycle event log */
  lifecycleEvents: CrdtLifecycleEvent[];
}
