import * as Automerge from "@automerge/automerge";

import { fromDoc } from "../../factories/document-factory.js";

import type { BucketProjectionDocument } from "../../schemas/bucket.js";
import type { ChatDocument } from "../../schemas/chat.js";
import type { FrontingDocument } from "../../schemas/fronting.js";
import type { JournalDocument } from "../../schemas/journal.js";
import type { NoteDocument } from "../../schemas/notes.js";
import type { PrivacyConfigDocument } from "../../schemas/privacy-config.js";
import type { SystemCoreDocument } from "../../schemas/system-core.js";

/**
 * Shared fixtures for schemas test files.
 *
 * Each `make*Doc()` returns a fresh Automerge document for the given schema
 * type. Test files import only the factories they need.
 */

/** Wraps a string as an Automerge ImmutableString. */
export const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

export function makeSystemCoreDoc(): Automerge.Doc<SystemCoreDocument> {
  return fromDoc<SystemCoreDocument>({
    system: {
      id: s("sys_test"),
      name: s("Test System"),
      displayName: null,
      description: null,
      avatarSource: null,
      settingsId: s("ss_test"),
      createdAt: 1000,
      updatedAt: 1000,
    },
    systemSettings: {
      id: s("ss_test"),
      systemId: s("sys_test"),
      theme: s("system"),
      fontScale: 1,
      locale: null,
      defaultBucketId: null,
      appLock: s(
        '{"pinEnabled":false,"biometricEnabled":false,"lockTimeout":5,"backgroundGraceSeconds":60}',
      ),
      notifications: s(
        '{"pushEnabled":false,"emailEnabled":false,"switchReminders":true,"checkInReminders":true}',
      ),
      syncPreferences: s('{"syncEnabled":true,"syncOnCellular":false}'),
      privacyDefaults: s('{"defaultBucketForNewContent":null,"friendRequestPolicy":"code-only"}'),
      littlesSafeMode: s('{"enabled":false}'),
      nomenclature: s("{}"),
      saturationLevelsEnabled: false,
      autoCaptureFrontingOnJournal: false,
      snapshotSchedule: s('{"enabled":false}'),
      onboardingComplete: false,
      createdAt: 1000,
      updatedAt: 1000,
    },
    members: {},
    memberPhotos: {},
    groups: {},
    structureEntityTypes: {},
    structureEntities: {},
    relationships: {},
    customFronts: {},
    fieldDefinitions: {},
    fieldValues: {},
    innerWorldEntities: {},
    innerWorldRegions: {},
    timers: {},
    webhookConfigs: {},
    frontingReports: {},
    groupMemberships: {},
    structureEntityLinks: {},
    structureEntityMemberLinks: {},
    structureEntityAssociations: {},
    lifecycleEvents: {},
  });
}

export function makeFrontingDoc(): Automerge.Doc<FrontingDocument> {
  return fromDoc({
    sessions: {},
    comments: {},
    checkInRecords: {},
  });
}

export function makeChatDoc(): Automerge.Doc<ChatDocument> {
  return fromDoc<ChatDocument>({
    channel: {
      id: s("ch_test"),
      systemId: s("sys_test"),
      name: s("general"),
      type: s("channel"),
      parentId: null,
      sortOrder: 0,
      archived: false,
      createdAt: 1000,
      updatedAt: 1000,
    },
    boardMessages: {},
    polls: {},
    pollOptions: {},
    acknowledgements: {},
    messages: [],
    votes: [],
  });
}

export function makeJournalDoc(): Automerge.Doc<JournalDocument> {
  return fromDoc({
    entries: {},
    wikiPages: {},
  });
}

export function makeNoteDoc(): Automerge.Doc<NoteDocument> {
  return fromDoc({
    notes: {},
  });
}

export function makePrivacyConfigDoc(): Automerge.Doc<PrivacyConfigDocument> {
  return fromDoc({
    buckets: {},
    contentTags: {},
    friendConnections: {},
    friendCodes: {},
    keyGrants: {},
  });
}

export function makeBucketDoc(): Automerge.Doc<BucketProjectionDocument> {
  return fromDoc<BucketProjectionDocument>({
    members: {},
    memberPhotos: {},
    groups: {},
    customFronts: {},
    fieldDefinitions: {},
    fieldValues: {},
    frontingSessions: {},
    notes: {},
    journalEntries: {},
    channels: {},
    messages: [],
    dashboardSnapshot: null,
  });
}
