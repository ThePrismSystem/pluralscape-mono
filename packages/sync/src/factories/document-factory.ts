import * as Automerge from "@automerge/automerge";

import {
  DEFAULT_BACKGROUND_GRACE_SECONDS,
  DEFAULT_FONT_SCALE,
  DEFAULT_LOCK_TIMEOUT_MINUTES,
} from "../sync.constants.js";

import type { SyncDocumentType } from "../document-types.js";
import type { BucketProjectionDocument } from "../schemas/bucket.js";
import type { ChatDocument } from "../schemas/chat.js";
import type { FrontingDocument } from "../schemas/fronting.js";
import type { JournalDocument } from "../schemas/journal.js";
import type { PrivacyConfigDocument } from "../schemas/privacy-config.js";
import type { SystemCoreDocument } from "../schemas/system-core.js";

// ── helper ────────────────────────────────────────────────────────────

/**
 * Cast helper for Automerge.from().
 *
 * Automerge.from() expects `Record<string, unknown>`, which specific document
 * interfaces don't satisfy (they lack an explicit index signature). The
 * double-cast (T → unknown → Record) preserves compile-time type safety on
 * the input while satisfying Automerge's runtime signature. The return is
 * cast back to `Automerge.Doc<T>` to restore the correct type.
 */
export function fromDoc<T>(init: T): Automerge.Doc<T> {
  const asUnknown: unknown = init;
  return Automerge.from(asUnknown as Record<string, unknown>) as Automerge.Doc<T>;
}

const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

// ── per-type factories ────────────────────────────────────────────────

/**
 * Creates an empty system-core document.
 *
 * The system and systemSettings singletons are initialized with placeholder
 * values. Callers must issue a change() to populate them with real data.
 */
export function createSystemCoreDocument(): Automerge.Doc<SystemCoreDocument> {
  return fromDoc<SystemCoreDocument>({
    system: {
      id: s(""),
      name: s(""),
      displayName: null,
      description: null,
      avatarSource: null,
      settingsId: s(""),
      createdAt: 0,
      updatedAt: 0,
    },
    systemSettings: {
      id: s(""),
      systemId: s(""),
      theme: s("system"),
      fontScale: DEFAULT_FONT_SCALE,
      locale: null,
      defaultBucketId: null,
      appLock: s(
        JSON.stringify({
          pinEnabled: false,
          biometricEnabled: false,
          lockTimeout: DEFAULT_LOCK_TIMEOUT_MINUTES,
          backgroundGraceSeconds: DEFAULT_BACKGROUND_GRACE_SECONDS,
        }),
      ),
      notifications: s(
        JSON.stringify({
          pushEnabled: false,
          emailEnabled: false,
          switchReminders: true,
          checkInReminders: true,
        }),
      ),
      syncPreferences: s(JSON.stringify({ syncEnabled: true, syncOnCellular: false })),
      privacyDefaults: s(
        JSON.stringify({ defaultBucketForNewContent: null, friendRequestPolicy: "code-only" }),
      ),
      littlesSafeMode: s(JSON.stringify({ enabled: false })),
      nomenclature: s("{}"),
      saturationLevelsEnabled: false,
      autoCaptureFrontingOnJournal: false,
      snapshotSchedule: s(JSON.stringify({ enabled: false })),
      onboardingComplete: false,
      createdAt: 0,
      updatedAt: 0,
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
    groupMemberships: {},
    structureEntityLinks: {},
    structureEntityMemberLinks: {},
    structureEntityAssociations: {},
    lifecycleEvents: {},
  });
}

/** Creates an empty fronting document. */
export function createFrontingDocument(): Automerge.Doc<FrontingDocument> {
  return fromDoc<FrontingDocument>({
    sessions: {},
    comments: {},
    checkInRecords: {},
  });
}

/**
 * Creates an empty chat document.
 *
 * The channel singleton is initialized with placeholder values. Callers
 * must issue a change() to set the real channel ID, name, and metadata.
 */
export function createChatDocument(): Automerge.Doc<ChatDocument> {
  return fromDoc<ChatDocument>({
    channel: {
      id: s(""),
      systemId: s(""),
      name: s(""),
      type: s("channel"),
      parentId: null,
      sortOrder: 0,
      archived: false,
      createdAt: 0,
      updatedAt: 0,
    },
    boardMessages: {},
    polls: {},
    pollOptions: {},
    acknowledgements: {},
    messages: [],
    votes: [],
  });
}

/** Creates an empty journal document. */
export function createJournalDocument(): Automerge.Doc<JournalDocument> {
  return fromDoc<JournalDocument>({
    entries: {},
    wikiPages: {},
    notes: {},
  });
}

/** Creates an empty privacy-config document. */
export function createPrivacyConfigDocument(): Automerge.Doc<PrivacyConfigDocument> {
  return fromDoc<PrivacyConfigDocument>({
    buckets: {},
    contentTags: {},
    friendConnections: {},
    friendCodes: {},
    keyGrants: {},
  });
}

/** Creates an empty bucket projection document. */
export function createBucketDocument(): Automerge.Doc<BucketProjectionDocument> {
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
  });
}

// ── generic factory ───────────────────────────────────────────────────

/**
 * Creates an empty Automerge document for the given sync document type.
 *
 * Returns a typed document that can be immediately used with
 * EncryptedSyncSession<T>. Singletons (system, channel) are initialized
 * with placeholder values and must be populated via a subsequent change().
 */
export function createDocument(
  type: SyncDocumentType,
):
  | Automerge.Doc<SystemCoreDocument>
  | Automerge.Doc<FrontingDocument>
  | Automerge.Doc<ChatDocument>
  | Automerge.Doc<JournalDocument>
  | Automerge.Doc<PrivacyConfigDocument>
  | Automerge.Doc<BucketProjectionDocument> {
  switch (type) {
    case "system-core":
      return createSystemCoreDocument();
    case "fronting":
      return createFrontingDocument();
    case "chat":
      return createChatDocument();
    case "journal":
      return createJournalDocument();
    case "privacy-config":
      return createPrivacyConfigDocument();
    case "bucket":
      return createBucketDocument();
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown document type: ${String(_exhaustive)}`);
    }
  }
}
