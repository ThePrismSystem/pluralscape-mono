/**
 * Shared test factories for mobile hook tests.
 *
 * Each factory returns a fully-formed <Entity>Raw fixture and accepts a
 * Partial override object. Encryption is performed with TEST_MASTER_KEY so
 * the raw fixture's encryptedData blob round-trips through the hook's
 * decryption path in tests.
 */
import { encryptAcknowledgementInput } from "@pluralscape/data/transforms/acknowledgement";
import { encryptBoardMessageInput } from "@pluralscape/data/transforms/board-message";
import { encryptChannelInput } from "@pluralscape/data/transforms/channel";
import {
  encryptFieldDefinitionInput,
  encryptFieldValueInput,
} from "@pluralscape/data/transforms/custom-field";
import { encryptCustomFrontInput } from "@pluralscape/data/transforms/custom-front";
import { encryptFrontingCommentInput } from "@pluralscape/data/transforms/fronting-comment";
import { encryptFrontingReportInput } from "@pluralscape/data/transforms/fronting-report";
import { encryptFrontingSessionInput } from "@pluralscape/data/transforms/fronting-session";
import { encryptGroupInput } from "@pluralscape/data/transforms/group";
import { encryptCanvasUpdate } from "@pluralscape/data/transforms/innerworld-canvas";
import { encryptInnerWorldEntityInput } from "@pluralscape/data/transforms/innerworld-entity";
import { encryptInnerWorldRegionInput } from "@pluralscape/data/transforms/innerworld-region";
import { encryptLifecycleEventInput } from "@pluralscape/data/transforms/lifecycle-event";
import { encryptMemberInput } from "@pluralscape/data/transforms/member";
import { encryptMessageInput } from "@pluralscape/data/transforms/message";
import { encryptNoteInput } from "@pluralscape/data/transforms/note";
import { encryptPollInput, encryptPollVoteInput } from "@pluralscape/data/transforms/poll";
import { encryptRelationshipInput } from "@pluralscape/data/transforms/relationship";
import { encryptSnapshotInput } from "@pluralscape/data/transforms/snapshot";
import { encryptStructureEntityInput } from "@pluralscape/data/transforms/structure-entity";
import { encryptStructureEntityTypeInput } from "@pluralscape/data/transforms/structure-entity-type";
import {
  encryptNomenclatureUpdate,
  encryptSystemSettingsUpdate,
} from "@pluralscape/data/transforms/system-settings";
import { encryptTimerConfigInput } from "@pluralscape/data/transforms/timer-check-in";
import { brandId } from "@pluralscape/types";

import { TEST_MASTER_KEY, TEST_SYSTEM_ID } from "../hooks/__tests__/helpers/test-crypto.js";

export { TEST_MASTER_KEY, TEST_SYSTEM_ID };

import type { FieldDefinitionRaw, FieldValueRaw } from "@pluralscape/data/transforms/custom-field";
import type { FrontingReportRaw } from "@pluralscape/data/transforms/fronting-report";
import type {
  LifecycleEventEncryptedPayload,
  LifecycleEventRaw,
} from "@pluralscape/data/transforms/lifecycle-event";
import type { PollVoteServerWire } from "@pluralscape/data/transforms/poll";
import type { SnapshotRaw } from "@pluralscape/data/transforms/snapshot";
import type { NomenclatureSettingsWire } from "@pluralscape/data/transforms/system-settings";
import type {
  CheckInRecordRaw,
  TimerConfigServerWire,
} from "@pluralscape/data/transforms/timer-check-in";
import type {
  AcknowledgementId,
  AcknowledgementRequestWire,
  BoardMessageId,
  BoardMessageWire,
  ChannelId,
  ChannelWire,
  ChatMessageWire,
  CheckInRecordId,
  CustomFrontId,
  CustomFrontWire,
  FieldDefinitionId,
  FieldValueId,
  FrontingCommentId,
  FrontingCommentWire,
  FrontingReportId,
  FrontingSessionId,
  FrontingSessionWire,
  GroupId,
  GroupWire,
  InnerWorldCanvasWire,
  InnerWorldEntityEncryptedInput,
  InnerWorldEntityId,
  InnerWorldEntityWire,
  InnerWorldRegionId,
  InnerWorldRegionWire,
  LifecycleEventId,
  MemberId,
  MemberWire,
  MessageId,
  EncryptedBase64,
  NoteId,
  NoteWire,
  PollId,
  PollOptionId,
  PollVoteId,
  PollWire,
  RelationshipId,
  RelationshipType,
  RelationshipWire,
  SnapshotContent,
  SystemSettingsId,
  SystemSettingsWire,
  SystemSnapshotId,
  SystemStructureEntityId,
  SystemStructureEntityTypeId,
  SystemStructureEntityTypeWire,
  SystemStructureEntityWire,
  TimerId,
  UnixMillis,
  VisualProperties,
} from "@pluralscape/types";
export const NOW = 1_700_000_000_000 as UnixMillis;

// ── Acknowledgement ──────────────────────────────────────────────────

export function makeRawAcknowledgement(
  id: string,
  overrides?: Partial<AcknowledgementRequestWire>,
): AcknowledgementRequestWire {
  const encrypted = encryptAcknowledgementInput(
    {
      message: "Please read",
      targetMemberId: brandId<MemberId>("m-1"),
      confirmedAt: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<AcknowledgementId>(id),
    systemId: TEST_SYSTEM_ID,
    createdByMemberId: null,
    confirmed: false,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

// ── Board Message ────────────────────────────────────────────────────

export function makeRawBoardMessage(
  id: string,
  overrides?: Partial<BoardMessageWire>,
): BoardMessageWire {
  const encrypted = encryptBoardMessageInput(
    { content: "Board post", senderId: brandId<MemberId>("m-1") },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<BoardMessageId>(id),
    systemId: TEST_SYSTEM_ID,
    pinned: false,
    sortOrder: 0,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

// ── Channel ──────────────────────────────────────────────────────────

export function makeRawChannel(id: string, overrides?: Partial<ChannelWire>): ChannelWire {
  const encrypted = encryptChannelInput({ name: "general" }, TEST_MASTER_KEY);
  return {
    id: brandId<ChannelId>(id),
    systemId: TEST_SYSTEM_ID,
    type: "channel",
    parentId: null,
    sortOrder: 0,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

// ── Custom Fields ────────────────────────────────────────────────────

export function makeRawFieldDefinition(
  id: string,
  overrides?: Partial<FieldDefinitionRaw>,
): FieldDefinitionRaw {
  const encrypted = encryptFieldDefinitionInput(
    { name: `Field ${id}`, description: "A test field", options: null },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<FieldDefinitionId>(id),
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

export function makeRawFieldValue(id: string, overrides?: Partial<FieldValueRaw>): FieldValueRaw {
  const encrypted = encryptFieldValueInput({ fieldType: "text", value: "hello" }, TEST_MASTER_KEY);
  return {
    id: brandId<FieldValueId>(id),
    fieldDefinitionId: brandId<FieldDefinitionId>("fd-1"),
    memberId: brandId<MemberId>("m-1"),
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

// ── Custom Front ─────────────────────────────────────────────────────

export function makeRawCustomFront(
  id: string,
  overrides?: Partial<CustomFrontWire>,
): CustomFrontWire {
  const encrypted = encryptCustomFrontInput(
    {
      name: `Front ${id}`,
      description: "A test front",
      color: null,
      emoji: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<CustomFrontId>(id),
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── Fronting Comment ─────────────────────────────────────────────────

export function makeRawFrontingComment(
  id: string,
  sessionId: FrontingSessionId = brandId<FrontingSessionId>("fs-1"),
  overrides?: Partial<FrontingCommentWire>,
): FrontingCommentWire {
  const encrypted = encryptFrontingCommentInput({ content: `Comment ${id}` }, TEST_MASTER_KEY);
  return {
    id: brandId<FrontingCommentId>(id),
    frontingSessionId: brandId<FrontingSessionId>(sessionId),
    systemId: TEST_SYSTEM_ID,
    memberId: brandId<MemberId>("m-1"),
    customFrontId: null,
    structureEntityId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  } as FrontingCommentWire;
}

// ── Fronting Report ──────────────────────────────────────────────────

const REPORT_START = 1_699_900_000_000 as UnixMillis;
const REPORT_END = 1_700_000_000_000 as UnixMillis;

export function makeRawFrontingReport(
  id: string,
  overrides?: Partial<FrontingReportRaw>,
): FrontingReportRaw {
  const encrypted = encryptFrontingReportInput(
    {
      dateRange: { start: REPORT_START, end: REPORT_END },
      memberBreakdowns: [],
      chartData: [],
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<FrontingReportId>(id),
    systemId: TEST_SYSTEM_ID,
    format: "html",
    generatedAt: NOW,
    version: 1,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── Fronting Session ─────────────────────────────────────────────────

export function makeRawFrontingSession(
  id: string,
  overrides?: Partial<FrontingSessionWire>,
): FrontingSessionWire {
  const encrypted = encryptFrontingSessionInput(
    {
      comment: `Session ${id}`,
      positionality: "close",
      outtrigger: null,
      outtriggerSentiment: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<FrontingSessionId>(id),
    systemId: TEST_SYSTEM_ID,
    memberId: brandId<MemberId>("m-1"),
    customFrontId: null,
    structureEntityId: null,
    startTime: NOW,
    endTime: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    encryptedData: encrypted.encryptedData as EncryptedBase64,
    ...overrides,
  } as FrontingSessionWire;
}

// ── Group ────────────────────────────────────────────────────────────

export function makeRawGroup(id: string, overrides?: Partial<GroupWire>): GroupWire {
  const encrypted = encryptGroupInput(
    {
      name: `Group ${id}`,
      description: "A test group",
      imageSource: null,
      color: null,
      emoji: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<GroupId>(id),
    systemId: TEST_SYSTEM_ID,
    parentGroupId: null,
    sortOrder: 0,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── Innerworld Canvas ────────────────────────────────────────────────

export function makeRawCanvas(overrides?: Partial<InnerWorldCanvasWire>): InnerWorldCanvasWire {
  const encrypted = encryptCanvasUpdate(
    {
      viewportX: 0,
      viewportY: 0,
      zoom: 1,
      dimensions: { width: 1000, height: 800 },
    },
    1,
    TEST_MASTER_KEY,
  );
  return {
    systemId: TEST_SYSTEM_ID,
    encryptedData: encrypted.encryptedData,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// ── Innerworld Entity ────────────────────────────────────────────────

const DEFAULT_VISUAL: VisualProperties = {
  color: null,
  icon: null,
  size: null,
  opacity: null,
  imageSource: null,
  externalUrl: null,
};

export function makeRawInnerworldEntity(
  id: string,
  payload: InnerWorldEntityEncryptedInput,
  overrides?: Partial<InnerWorldEntityWire>,
): InnerWorldEntityWire {
  const encrypted = encryptInnerWorldEntityInput(payload, TEST_MASTER_KEY);
  return {
    id: brandId<InnerWorldEntityId>(id),
    systemId: TEST_SYSTEM_ID,
    regionId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

export { DEFAULT_VISUAL as INNERWORLD_DEFAULT_VISUAL };

// ── Innerworld Region ────────────────────────────────────────────────

export function makeRawInnerworldRegion(
  id: string,
  overrides?: Partial<InnerWorldRegionWire>,
): InnerWorldRegionWire {
  const encrypted = encryptInnerWorldRegionInput(
    {
      name: `Region ${id}`,
      description: "A test region",
      boundaryData: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      visual: DEFAULT_VISUAL,
      gatekeeperMemberIds: [],
      accessType: "open",
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<InnerWorldRegionId>(id),
    systemId: TEST_SYSTEM_ID,
    parentRegionId: null,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── Lifecycle Event ──────────────────────────────────────────────────

export function makeRawLifecycleEvent(
  id: string,
  eventType: string,
  payload: LifecycleEventEncryptedPayload,
  plaintextMetadata: LifecycleEventRaw["plaintextMetadata"],
  overrides?: Partial<LifecycleEventRaw>,
): LifecycleEventRaw {
  const encrypted = encryptLifecycleEventInput(payload, TEST_MASTER_KEY);
  return {
    id: brandId<LifecycleEventId>(id),
    systemId: TEST_SYSTEM_ID,
    eventType: eventType as LifecycleEventRaw["eventType"],
    occurredAt: NOW,
    recordedAt: NOW,
    updatedAt: NOW,
    plaintextMetadata,
    version: 1,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── Member ───────────────────────────────────────────────────────────

export function makeRawMember(id: string, overrides?: Partial<MemberWire>): MemberWire {
  const encrypted = encryptMemberInput(
    {
      name: `Member ${id}`,
      pronouns: ["they/them"],
      description: "A test member",
      avatarSource: null,
      colors: [],
      saturationLevel: { kind: "known", level: "highly-elaborated" },
      tags: [],
      suppressFriendFrontNotification: false,
      boardMessageNotificationOnFront: false,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<MemberId>(id),
    systemId: TEST_SYSTEM_ID,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── Message ──────────────────────────────────────────────────────────

export function makeRawMessage(
  id: string,
  channelId: ChannelId = brandId<ChannelId>("ch-1"),
  overrides?: Partial<ChatMessageWire>,
): ChatMessageWire {
  const encrypted = encryptMessageInput(
    {
      content: "hello",
      attachments: [],
      mentions: [],
      senderId: brandId<MemberId>("m-1"),
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<MessageId>(id),
    channelId,
    systemId: TEST_SYSTEM_ID,
    replyToId: null,
    timestamp: NOW,
    editedAt: null,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

// ── Note ─────────────────────────────────────────────────────────────

export function makeRawNote(id: string, overrides?: Partial<NoteWire>): NoteWire {
  const encrypted = encryptNoteInput(
    { title: "Note", content: "Body", backgroundColor: null },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<NoteId>(id),
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

// ── Poll ─────────────────────────────────────────────────────────────

export function makeRawPoll(id: string, overrides?: Partial<PollWire>): PollWire {
  const encrypted = encryptPollInput(
    {
      title: `Poll ${id}`,
      description: null,
      options: [
        {
          id: brandId<PollOptionId>("opt-1"),
          label: "Yes",
          voteCount: 0,
          color: null,
          emoji: null,
        },
      ],
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<PollId>(id),
    systemId: TEST_SYSTEM_ID,
    createdByMemberId: null,
    kind: "standard",
    status: "open",
    closedAt: null,
    endsAt: null,
    allowMultipleVotes: false,
    maxVotesPerMember: 1,
    allowAbstain: false,
    allowVeto: false,
    version: 1,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

export function makeRawPollVote(
  id: string,
  pollId: string,
  overrides?: Partial<PollVoteServerWire>,
): PollVoteServerWire {
  const encrypted = encryptPollVoteInput({ comment: "My comment" }, TEST_MASTER_KEY);
  return {
    id: brandId<PollVoteId>(id),
    pollId: brandId<PollId>(pollId),
    optionId: brandId<PollOptionId>("opt-1"),
    voter: { entityType: "member" as const, entityId: brandId<MemberId>("mem-voter") },
    isVeto: false,
    votedAt: NOW,
    archived: false,
    archivedAt: null,
    createdAt: NOW,
    ...encrypted,
    ...overrides,
  };
}

// ── Relationship ─────────────────────────────────────────────────────

export function makeRawRelationship(
  id: string,
  opts?: { encryptedData?: string },
  overrides?: Partial<RelationshipWire>,
): RelationshipWire {
  // Default to a standard (non-custom) relationship: blob is `{}`
  const encryptedData =
    opts?.encryptedData ?? encryptRelationshipInput({}, TEST_MASTER_KEY).encryptedData;

  return {
    id: brandId<RelationshipId>(id),
    systemId: TEST_SYSTEM_ID,
    sourceMemberId: brandId<MemberId>("m-1"),
    targetMemberId: brandId<MemberId>("m-2"),
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

// ── Snapshot ─────────────────────────────────────────────────────────

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

// ── Structure Entity ─────────────────────────────────────────────────

export function makeRawStructureEntity(
  id: string,
  entityTypeId: SystemStructureEntityTypeId = brandId<SystemStructureEntityTypeId>("stet_default"),
  overrides?: Partial<SystemStructureEntityWire>,
): SystemStructureEntityWire {
  const encrypted = encryptStructureEntityInput(
    {
      name: `Entity ${id}`,
      description: "A test entity",
      emoji: null,
      color: null,
      imageSource: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<SystemStructureEntityId>(id),
    systemId: TEST_SYSTEM_ID,
    entityTypeId,
    sortOrder: 0,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── Structure Entity Type ────────────────────────────────────────────

export function makeRawStructureEntityType(
  id: string,
  overrides?: Partial<SystemStructureEntityTypeWire>,
): SystemStructureEntityTypeWire {
  const encrypted = encryptStructureEntityTypeInput(
    {
      name: `Type ${id}`,
      description: "A test entity type",
      emoji: null,
      color: null,
      imageSource: null,
    },
    TEST_MASTER_KEY,
  );
  return {
    id: brandId<SystemStructureEntityTypeId>(id),
    systemId: TEST_SYSTEM_ID,
    sortOrder: 0,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    archived: false,
    archivedAt: null,
    ...encrypted,
    ...overrides,
  };
}

// ── System Settings ──────────────────────────────────────────────────

const FACTORY_SETTINGS_ID = brandId<SystemSettingsId>("ss-1");

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

// ── Timer / Check-In ─────────────────────────────────────────────────

/** Interval in minutes between timer check-in prompts. */
const TIMER_INTERVAL_MINUTES = 60;

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
