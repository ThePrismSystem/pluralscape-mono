/**
 * Miscellaneous entity test factories: notes, relationships, snapshots, lifecycle events,
 * timers, check-ins, system settings, nomenclature, fields.
 *
 * Covers: makeRawNote, makeRawRelationship, makeRawSnapshot, makeRawLifecycleEvent,
 *         makeRawTimer, makeRawCheckIn, makeRawSystemSettings, makeRawNomenclature,
 *         makeRawFieldDefinition, makeRawFieldValue
 * Companion files: shared.ts, member.ts, fronting.ts, comms.ts, structure-innerworld.ts
 */
import {
  encryptFieldDefinitionInput,
  encryptFieldValueInput,
} from "@pluralscape/data/transforms/custom-field";
import { encryptAndEncodeT1 } from "@pluralscape/data/transforms/decode-blob";
import { encryptNoteInput } from "@pluralscape/data/transforms/note";
import { encryptRelationshipInput } from "@pluralscape/data/transforms/relationship";
import { encryptSnapshotInput } from "@pluralscape/data/transforms/snapshot";
import {
  encryptNomenclatureUpdate,
  encryptSystemSettingsUpdate,
} from "@pluralscape/data/transforms/system-settings";
import { encryptTimerConfigInput } from "@pluralscape/data/transforms/timer-check-in";
import { brandId, brandValue } from "@pluralscape/types";

import { NOW, TEST_MASTER_KEY, TEST_SYSTEM_ID } from "./shared.js";

import type { SnapshotRaw } from "@pluralscape/data/transforms/snapshot";
import type { NomenclatureSettingsWire } from "@pluralscape/data/transforms/system-settings";
import type {
  CheckInRecordRaw,
  TimerConfigServerWire,
} from "@pluralscape/data/transforms/timer-check-in";
import type {
  CheckInRecordId,
  FieldDefinitionLabel,
  FieldDefinitionWire,
  FieldValueWire,
  LifecycleEventWire,
  NoteContent,
  NoteTitle,
  NoteWire,
  RelationshipType,
  RelationshipWire,
  SnapshotContent,
  SystemSettingsId,
  SystemSettingsWire,
  SystemSnapshotId,
  TimerId,
} from "@pluralscape/types";

/** Interval in minutes between timer check-in prompts. */
const TIMER_INTERVAL_MINUTES = 60;

const FACTORY_SETTINGS_ID = brandId<SystemSettingsId>("ss-1");

function makeSnapshotContent(): SnapshotContent {
  return {
    name: "Test Snapshot",
    description: null,
    members: [],
    structureEntityTypes: [],
    structureEntities: [],
    structureEntityLinks: [],
    structureEntityMemberLinks: [],
    structureEntityAssociations: [],
    relationships: [],
    groups: [],
    innerworldRegions: [],
    innerworldEntities: [],
  };
}

function makeSystemSettingsPayload(settingsId: SystemSettingsId = FACTORY_SETTINGS_ID) {
  return {
    id: settingsId,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    theme: "dark" as const,
    fontScale: 1.0,
    locale: null,
    defaultBucketId: null,
    appLock: {
      pinEnabled: false,
      biometricEnabled: false,
      lockTimeout: 5,
      backgroundGraceSeconds: 30,
    },
    notifications: {
      pushEnabled: true,
      emailEnabled: false,
      switchReminders: false,
      checkInReminders: false,
    },
    syncPreferences: {
      syncEnabled: true,
      syncOnCellular: false,
    },
    privacyDefaults: {
      defaultBucketForNewContent: null,
      friendRequestPolicy: "open" as const,
    },
    littlesSafeMode: {
      enabled: false,
      allowedContentIds: [],
      simplifiedUIFlags: {
        largeButtons: false,
        iconDriven: false,
        noDeletion: false,
        noSettings: false,
        noAnalytics: false,
      },
    },
    nomenclature: {
      collective: "System",
      individual: "Member",
      fronting: "Fronting",
      switching: "Switch",
      "co-presence": "Co-fronting",
      "internal-space": "Headspace",
      "primary-fronter": "Host",
      structure: "System Structure",
      dormancy: "Dormancy",
      body: "Body",
      amnesia: "Amnesia",
      saturation: "Saturation",
    },
    saturationLevelsEnabled: true,
    autoCaptureFrontingOnJournal: false,
    snapshotSchedule: "disabled" as const,
    onboardingComplete: false,
  };
}

export function makeRawFieldDefinition(
  id: string,
  overrides?: Partial<FieldDefinitionWire>,
): FieldDefinitionWire {
  const encrypted = encryptFieldDefinitionInput(
    {
      name: brandValue<FieldDefinitionLabel>(`Field ${id}`),
      description: "A test field",
      options: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    fieldType: "text",
    required: false,
    sortOrder: 0,
    archived: false,
    archivedAt: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawFieldValue(id: string, overrides?: Partial<FieldValueWire>): FieldValueWire {
  const encrypted = encryptFieldValueInput({ fieldType: "text", value: "hello" }, TEST_MASTER_KEY);
  return {
    id,
    fieldDefinitionId: "fd-1",
    memberId: "m-1",
    structureEntityId: null,
    groupId: null,
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawLifecycleEvent(
  id: string,
  eventType: string,
  payload: unknown,
  plaintextMetadata: LifecycleEventWire["plaintextMetadata"],
  overrides?: Partial<LifecycleEventWire>,
): LifecycleEventWire {
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    eventType: eventType as LifecycleEventWire["eventType"],
    occurredAt: NOW,
    recordedAt: NOW,
    updatedAt: NOW,
    encryptedData: encryptAndEncodeT1(payload, TEST_MASTER_KEY),
    plaintextMetadata,
    version: 1,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}

export function makeRawNote(id: string, overrides?: Partial<NoteWire>): NoteWire {
  const encrypted = encryptNoteInput(
    {
      title: brandValue<NoteTitle>("Note"),
      content: brandValue<NoteContent>("Body"),
      backgroundColor: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id,
    systemId: TEST_SYSTEM_ID,
    authorEntityType: null,
    authorEntityId: null,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawRelationship(
  id: string,
  opts?: { encryptedData?: string },
  overrides?: Partial<RelationshipWire>,
): RelationshipWire {
  const encryptedData =
    opts?.encryptedData ?? encryptRelationshipInput({}, TEST_MASTER_KEY).encryptedData;

  return {
    id,
    systemId: TEST_SYSTEM_ID,
    sourceMemberId: "m-1",
    targetMemberId: "m-2",
    type: "sibling" as RelationshipType,
    bidirectional: true,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    archived: false,
    archivedAt: null,
    encryptedData,
    ...overrides,
  };
}

export function makeRawSnapshot(id: string, overrides?: Partial<SnapshotRaw>): SnapshotRaw {
  const content = makeSnapshotContent();
  const encrypted = encryptSnapshotInput(content, TEST_MASTER_KEY);
  return {
    id: brandId<SystemSnapshotId>(id),
    systemId: TEST_SYSTEM_ID,
    snapshotTrigger: "manual",
    createdAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawSystemSettings(overrides?: Partial<SystemSettingsWire>): SystemSettingsWire {
  const settings = makeSystemSettingsPayload();
  const encrypted = encryptSystemSettingsUpdate(settings, 1, TEST_MASTER_KEY);
  return {
    id: FACTORY_SETTINGS_ID,
    systemId: TEST_SYSTEM_ID,
    locale: null,
    pinHash: null,
    biometricEnabled: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawNomenclature(
  overrides?: Partial<NomenclatureSettingsWire>,
): NomenclatureSettingsWire {
  const nomenclature = {
    collective: "System",
    individual: "Member",
    fronting: "Fronting",
    switching: "Switch",
    "co-presence": "Co-fronting",
    "internal-space": "Headspace",
    "primary-fronter": "Host",
    structure: "System Structure",
    dormancy: "Dormancy",
    body: "Body",
    amnesia: "Amnesia",
    saturation: "Saturation",
  };
  const encrypted = encryptNomenclatureUpdate(nomenclature, 1, TEST_MASTER_KEY);
  return {
    systemId: TEST_SYSTEM_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawTimer(
  id: string,
  overrides?: Partial<TimerConfigServerWire>,
): TimerConfigServerWire {
  const encrypted = encryptTimerConfigInput({ promptText: "How are you?" }, TEST_MASTER_KEY);
  return {
    id: brandId<TimerId>(id),
    systemId: TEST_SYSTEM_ID,
    enabled: true,
    intervalMinutes: TIMER_INTERVAL_MINUTES,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawCheckIn(
  id: string,
  overrides?: Partial<CheckInRecordRaw>,
): CheckInRecordRaw {
  return {
    id: brandId<CheckInRecordId>(id),
    timerConfigId: brandId<TimerId>("tmr-1"),
    systemId: TEST_SYSTEM_ID,
    scheduledAt: NOW,
    respondedByMemberId: null,
    respondedAt: null,
    dismissed: false,
    archived: false,
    archivedAt: null,
    ...overrides,
  };
}
