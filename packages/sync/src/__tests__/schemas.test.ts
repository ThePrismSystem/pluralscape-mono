import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";

import { fromDoc } from "../factories/document-factory.js";

import type { BucketProjectionDocument } from "../schemas/bucket.js";
import type { ChatDocument } from "../schemas/chat.js";
import type { FrontingDocument } from "../schemas/fronting.js";
import type { JournalDocument } from "../schemas/journal.js";
import type { PrivacyConfigDocument } from "../schemas/privacy-config.js";
import type { SystemCoreDocument } from "../schemas/system-core.js";

// ── helpers ──────────────────────────────────────────────────────────

const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

function makeSystemCoreDoc(): Automerge.Doc<SystemCoreDocument> {
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
    groupMemberships: {},
    structureEntityLinks: {},
    structureEntityMemberLinks: {},
    structureEntityAssociations: {},
    lifecycleEvents: [],
  });
}

function makeFrontingDoc(): Automerge.Doc<FrontingDocument> {
  return fromDoc<FrontingDocument>({
    sessions: {},
    comments: {},
    checkInRecords: {},
  });
}

function makeChatDoc(): Automerge.Doc<ChatDocument> {
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

function makeJournalDoc(): Automerge.Doc<JournalDocument> {
  return fromDoc<JournalDocument>({
    entries: {},
    wikiPages: {},
    notes: {},
  });
}

function makePrivacyConfigDoc(): Automerge.Doc<PrivacyConfigDocument> {
  return fromDoc<PrivacyConfigDocument>({
    buckets: {},
    contentTags: {},
    friendConnections: {},
    friendCodes: {},
    keyGrants: {},
  });
}

function makeBucketDoc(): Automerge.Doc<BucketProjectionDocument> {
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

// ── SystemCoreDocument ───────────────────────────────────────────────

describe("SystemCoreDocument schema", () => {
  it("initializes with empty maps and lists", () => {
    const doc = makeSystemCoreDoc();
    expect(Object.keys(doc.members)).toHaveLength(0);
    expect(Object.keys(doc.groups)).toHaveLength(0);
    expect(doc.lifecycleEvents).toHaveLength(0);
    expect(Object.keys(doc.groupMemberships)).toHaveLength(0);
  });

  it("reads singleton fields as ImmutableString", () => {
    const doc = makeSystemCoreDoc();
    expect(doc.system.name.val).toBe("Test System");
    expect(doc.system.displayName).toBeNull();
    expect(doc.systemSettings.theme.val).toBe("system");
  });

  it("adds and reads a member via map CRUD", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_test"),
        name: s("Luna"),
        pronouns: s('["she/her"]'),
        description: s("Host"),
        avatarSource: null,
        colors: s('["#8B5CF6"]'),
        saturationLevel: s('{"kind":"known","level":"highly-elaborated"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 2000,
        updatedAt: 2000,
      };
    });
    expect(doc.members["mem_1"]?.name.val).toBe("Luna");
    expect(doc.members["mem_1"]?.description?.val).toBe("Host");
  });

  it("updates a member field with LWW semantics", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_test"),
        name: s("Original"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    doc = Automerge.change(doc, (d) => {
      const member = d.members["mem_1"];
      if (member) {
        member.name = s("Updated");
        member.updatedAt = 2000;
      }
    });
    expect(doc.members["mem_1"]?.name.val).toBe("Updated");
  });

  it("appends lifecycle events to the append-only list", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.lifecycleEvents.push({
        id: s("le_1"),
        systemId: s("sys_test"),
        eventType: s("discovery"),
        occurredAt: 1000,
        recordedAt: 1001,
        notes: null,
        payload: s('{"memberId":"mem_1"}'),
      });
    });
    doc = Automerge.change(doc, (d) => {
      d.lifecycleEvents.push({
        id: s("le_2"),
        systemId: s("sys_test"),
        eventType: s("split"),
        occurredAt: 2000,
        recordedAt: 2001,
        notes: s("Split during stressful week"),
        payload: s('{"sourceMemberId":"mem_1","resultMemberIds":["mem_2","mem_3"]}'),
      });
    });
    expect(doc.lifecycleEvents).toHaveLength(2);
    expect(doc.lifecycleEvents[0]?.eventType.val).toBe("discovery");
    expect(doc.lifecycleEvents[1]?.eventType.val).toBe("split");
  });

  it("adds junction map entries with compound keys", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.groupMemberships["g1_m1"] = true;
      d.groupMemberships["g1_m2"] = true;
      d.structureEntityMemberLinks["se1_m1"] = true;
    });
    expect(doc.groupMemberships["g1_m1"]).toBe(true);
    expect(doc.groupMemberships["g1_m2"]).toBe(true);
    expect(doc.structureEntityMemberLinks["se1_m1"]).toBe(true);
    expect(Object.keys(doc.groupMemberships)).toHaveLength(2);
  });

  it("saves and loads via Automerge binary serialization", () => {
    let doc = makeSystemCoreDoc();
    doc = Automerge.change(doc, (d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_test"),
        name: s("Kai"),
        pronouns: s('["they/them"]'),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"highly-elaborated"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<SystemCoreDocument>(bytes);
    expect(loaded.members["mem_1"]?.name.val).toBe("Kai");
    expect(loaded.system.name.val).toBe("Test System");
    expect(loaded.lifecycleEvents).toHaveLength(0);
  });
});

// ── FrontingDocument ─────────────────────────────────────────────────

describe("FrontingDocument schema", () => {
  it("initializes with empty collections", () => {
    const doc = makeFrontingDoc();
    expect(Object.keys(doc.sessions)).toHaveLength(0);
    expect(Object.keys(doc.checkInRecords)).toHaveLength(0);
  });

  it("adds a fronting session and updates endTime (append-lww)", () => {
    let doc = makeFrontingDoc();
    doc = Automerge.change(doc, (d) => {
      d.sessions["fs_1"] = {
        id: s("fs_1"),
        systemId: s("sys_test"),
        memberId: s("mem_1"),
        startTime: 1000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(doc.sessions["fs_1"]?.endTime).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const session = d.sessions["fs_1"];
      if (session) {
        session.endTime = 2000;
        session.updatedAt = 2000;
      }
    });
    expect(doc.sessions["fs_1"]?.endTime).toBe(2000);
  });

  it("sets and updates outtrigger and outtriggerSentiment fields", () => {
    let doc = makeFrontingDoc();
    doc = Automerge.change(doc, (d) => {
      d.sessions["fs_ot"] = {
        id: s("fs_ot"),
        systemId: s("sys_test"),
        memberId: s("mem_1"),
        startTime: 3000,
        endTime: null,
        comment: null,
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: null,
        outtriggerSentiment: null,
        archived: false,
        createdAt: 3000,
        updatedAt: 3000,
      };
    });
    expect(doc.sessions["fs_ot"]?.outtrigger).toBeNull();
    expect(doc.sessions["fs_ot"]?.outtriggerSentiment).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const session = d.sessions["fs_ot"];
      if (session) {
        session.outtrigger = s("stress from work");
        session.outtriggerSentiment = s("negative");
        session.updatedAt = 3500;
      }
    });
    expect(doc.sessions["fs_ot"]?.outtrigger?.val).toBe("stress from work");
    expect(doc.sessions["fs_ot"]?.outtriggerSentiment?.val).toBe("negative");

    doc = Automerge.change(doc, (d) => {
      const session = d.sessions["fs_ot"];
      if (session) {
        session.outtriggerSentiment = s("neutral");
        session.updatedAt = 4000;
      }
    });
    expect(doc.sessions["fs_ot"]?.outtriggerSentiment?.val).toBe("neutral");
  });

  it("adds and responds to a check-in record (mutable fields)", () => {
    let doc = makeFrontingDoc();
    doc = Automerge.change(doc, (d) => {
      d.checkInRecords["cr_1"] = {
        id: s("cr_1"),
        timerConfigId: s("t_1"),
        systemId: s("sys_test"),
        scheduledAt: 1000,
        respondedByMemberId: null,
        respondedAt: null,
        dismissed: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(doc.checkInRecords["cr_1"]?.respondedByMemberId).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const record = d.checkInRecords["cr_1"];
      if (record) {
        record.respondedByMemberId = s("mem_1");
        record.respondedAt = 1100;
        record.updatedAt = 1100;
      }
    });
    expect(doc.checkInRecords["cr_1"]?.respondedByMemberId?.val).toBe("mem_1");
    expect(doc.checkInRecords["cr_1"]?.respondedAt).toBe(1100);
  });

  it("saves and loads via binary serialization with session data", () => {
    let doc = makeFrontingDoc();
    doc = Automerge.change(doc, (d) => {
      d.sessions["fs_rt"] = {
        id: s("fs_rt"),
        systemId: s("sys_test"),
        memberId: s("mem_1"),
        startTime: 5000,
        endTime: 6000,
        comment: s("round-trip test"),
        customFrontId: null,
        structureEntityId: null,
        positionality: null,
        outtrigger: s("felt triggered by noise"),
        outtriggerSentiment: s("negative"),
        archived: false,
        createdAt: 5000,
        updatedAt: 6000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<FrontingDocument>(bytes);
    expect(Object.keys(loaded.sessions)).toHaveLength(1);
    const session = loaded.sessions["fs_rt"];
    expect(session?.id.val).toBe("fs_rt");
    expect(session?.startTime).toBe(5000);
    expect(session?.endTime).toBe(6000);
    expect(session?.comment?.val).toBe("round-trip test");
    expect(session?.outtrigger?.val).toBe("felt triggered by noise");
    expect(session?.outtriggerSentiment?.val).toBe("negative");
    expect(Object.keys(loaded.checkInRecords)).toHaveLength(0);
  });
});

// ── ChatDocument ─────────────────────────────────────────────────────

describe("ChatDocument schema", () => {
  it("initializes with channel singleton and empty collections", () => {
    const doc = makeChatDoc();
    expect(doc.channel.name.val).toBe("general");
    expect(doc.messages).toHaveLength(0);
    expect(Object.keys(doc.boardMessages)).toHaveLength(0);
  });

  it("appends messages to the append-only list with editOf for edits", () => {
    let doc = makeChatDoc();
    doc = Automerge.change(doc, (d) => {
      d.messages.push({
        id: s("msg_1"),
        channelId: s("ch_test"),
        systemId: s("sys_test"),
        senderId: s("mem_1"),
        content: s("Original content"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1000,
        editOf: null,
        archived: false,
      });
    });
    doc = Automerge.change(doc, (d) => {
      d.messages.push({
        id: s("msg_2"),
        channelId: s("ch_test"),
        systemId: s("sys_test"),
        senderId: s("mem_1"),
        content: s("Edited content"),
        attachments: s("[]"),
        mentions: s("[]"),
        replyToId: null,
        timestamp: 1100,
        editOf: s("msg_1"),
        archived: false,
      });
    });
    expect(doc.messages).toHaveLength(2);
    expect(doc.messages[0]?.editOf).toBeNull();
    expect(doc.messages[1]?.editOf?.val).toBe("msg_1");
  });

  it("adds board message and mutates pinned field (append-lww)", () => {
    let doc = makeChatDoc();
    doc = Automerge.change(doc, (d) => {
      d.boardMessages["bm_1"] = {
        id: s("bm_1"),
        systemId: s("sys_test"),
        senderId: s("mem_1"),
        content: s("Board post"),
        pinned: false,
        sortOrder: 100,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(doc.boardMessages["bm_1"]?.pinned).toBe(false);

    doc = Automerge.change(doc, (d) => {
      const bm = d.boardMessages["bm_1"];
      if (bm) bm.pinned = true;
    });
    expect(doc.boardMessages["bm_1"]?.pinned).toBe(true);
  });

  it("saves and loads via binary serialization", () => {
    let doc = makeChatDoc();
    doc = Automerge.change(doc, (d) => {
      d.channel.name = s("announcements");
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<ChatDocument>(bytes);
    expect(loaded.channel.name.val).toBe("announcements");
  });
});

// ── JournalDocument ──────────────────────────────────────────────────

describe("JournalDocument schema", () => {
  it("initializes with empty maps", () => {
    const doc = makeJournalDoc();
    expect(Object.keys(doc.entries)).toHaveLength(0);
    expect(Object.keys(doc.wikiPages)).toHaveLength(0);
    expect(Object.keys(doc.notes)).toHaveLength(0);
  });

  it("adds a journal entry with mutable content (append-lww)", () => {
    let doc = makeJournalDoc();
    doc = Automerge.change(doc, (d) => {
      d.entries["je_1"] = {
        id: s("je_1"),
        systemId: s("sys_test"),
        author: s('{"entityType":"member","entityId":"mem_1"}'),
        frontingSessionId: null,
        title: s("My first entry"),
        blocks: s('[{"type":"paragraph","content":"Hello world","children":[]}]'),
        tags: s('["daily"]'),
        linkedEntities: s("[]"),
        frontingSnapshots: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(doc.entries["je_1"]?.title.val).toBe("My first entry");

    doc = Automerge.change(doc, (d) => {
      const entry = d.entries["je_1"];
      if (entry) {
        entry.title = s("Updated title");
        entry.updatedAt = 2000;
      }
    });
    expect(doc.entries["je_1"]?.title.val).toBe("Updated title");
  });

  it("saves and loads via binary serialization", () => {
    let doc = makeJournalDoc();
    doc = Automerge.change(doc, (d) => {
      d.notes["note_1"] = {
        id: s("note_1"),
        systemId: s("sys_test"),
        memberId: null,
        title: s("Quick note"),
        content: s("Reminder"),
        backgroundColor: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<JournalDocument>(bytes);
    expect(loaded.notes["note_1"]?.title.val).toBe("Quick note");
  });
});

// ── PrivacyConfigDocument ─────────────────────────────────────────────

describe("PrivacyConfigDocument schema", () => {
  it("initializes with empty maps", () => {
    const doc = makePrivacyConfigDoc();
    expect(Object.keys(doc.buckets)).toHaveLength(0);
    expect(Object.keys(doc.keyGrants)).toHaveLength(0);
  });

  it("adds a friend connection with nested assignedBuckets map", () => {
    let doc = makePrivacyConfigDoc();
    doc = Automerge.change(doc, (d) => {
      d.friendConnections["fc_1"] = {
        id: s("fc_1"),
        accountId: s("acc_1"),
        friendAccountId: s("acc_2"),
        status: s("accepted"),
        assignedBuckets: {},
        visibility: s(
          '{"showMembers":true,"showGroups":false,"showStructure":false,"allowFrontingNotifications":true}',
        ),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    doc = Automerge.change(doc, (d) => {
      const fc = d.friendConnections["fc_1"];
      if (fc) {
        fc.assignedBuckets["bkt_1"] = true;
      }
    });
    expect(doc.friendConnections["fc_1"]?.assignedBuckets["bkt_1"]).toBe(true);
    expect(Object.keys(doc.friendConnections["fc_1"]?.assignedBuckets ?? {})).toHaveLength(1);
  });

  it("adds a key grant and mutates revokedAt (append-lww)", () => {
    let doc = makePrivacyConfigDoc();
    doc = Automerge.change(doc, (d) => {
      d.keyGrants["kg_1"] = {
        id: s("kg_1"),
        bucketId: s("bkt_1"),
        friendAccountId: s("acc_2"),
        encryptedBucketKey: s("base64encodedkey=="),
        keyVersion: 1,
        createdAt: 1000,
        revokedAt: null,
      };
    });
    expect(doc.keyGrants["kg_1"]?.revokedAt).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const kg = d.keyGrants["kg_1"];
      if (kg) kg.revokedAt = 9999;
    });
    expect(doc.keyGrants["kg_1"]?.revokedAt).toBe(9999);
  });

  it("saves and loads via binary serialization", () => {
    let doc = makePrivacyConfigDoc();
    doc = Automerge.change(doc, (d) => {
      d.buckets["bkt_1"] = {
        id: s("bkt_1"),
        systemId: s("sys_test"),
        name: s("Friends"),
        description: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<PrivacyConfigDocument>(bytes);
    expect(loaded.buckets["bkt_1"]?.name.val).toBe("Friends");
  });
});

// ── BucketProjectionDocument ──────────────────────────────────────────

describe("BucketProjectionDocument schema", () => {
  it("initializes with empty maps and message list", () => {
    const doc = makeBucketDoc();
    expect(Object.keys(doc.members)).toHaveLength(0);
    expect(doc.messages).toHaveLength(0);
  });

  it("saves and loads via binary serialization", () => {
    let doc = makeBucketDoc();
    doc = Automerge.change(doc, (d) => {
      d.members["mem_1"] = {
        id: s("mem_1"),
        systemId: s("sys_test"),
        name: s("Projected Member"),
        pronouns: s("[]"),
        description: null,
        avatarSource: null,
        colors: s("[]"),
        saturationLevel: s('{"kind":"known","level":"fragment"}'),
        tags: s("[]"),
        suppressFriendFrontNotification: false,
        boardMessageNotificationOnFront: false,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<BucketProjectionDocument>(bytes);
    expect(loaded.members["mem_1"]?.name.val).toBe("Projected Member");
  });
});
