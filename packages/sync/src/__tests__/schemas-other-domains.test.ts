import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";

import {
  makeBucketDoc,
  makeJournalDoc,
  makeNoteDoc,
  makePrivacyConfigDoc,
  s,
} from "./helpers/schema-fixtures.js";
import {
  asBucketId,
  asFriendConnectionId,
  asJournalEntryId,
  asKeyGrantId,
  asMemberId,
  asNoteId,
} from "./test-crypto-helpers.js";

import type { BucketProjectionDocument } from "../schemas/bucket.js";
import type { JournalDocument } from "../schemas/journal.js";
import type { NoteDocument } from "../schemas/notes.js";
import type { PrivacyConfigDocument } from "../schemas/privacy-config.js";

// ── JournalDocument ──────────────────────────────────────────────────

describe("JournalDocument schema", () => {
  it("initializes with empty maps", () => {
    const doc = makeJournalDoc();
    expect(Object.keys(doc.entries)).toHaveLength(0);
    expect(Object.keys(doc.wikiPages)).toHaveLength(0);
  });

  it("adds a journal entry with mutable content (append-lww)", () => {
    let doc = makeJournalDoc();
    doc = Automerge.change(doc, (d) => {
      d.entries[asJournalEntryId("je_1")] = {
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
    expect(doc.entries[asJournalEntryId("je_1")]?.title.val).toBe("My first entry");

    doc = Automerge.change(doc, (d) => {
      const entry = d.entries[asJournalEntryId("je_1")];
      if (entry) {
        entry.title = s("Updated title");
        entry.updatedAt = 2000;
      }
    });
    expect(doc.entries[asJournalEntryId("je_1")]?.title.val).toBe("Updated title");
  });

  it("saves and loads via binary serialization", () => {
    let doc = makeJournalDoc();
    doc = Automerge.change(doc, (d) => {
      d.entries[asJournalEntryId("je_1")] = {
        id: s("je_1"),
        systemId: s("sys_test"),
        author: null,
        frontingSessionId: null,
        title: s("Roundtrip entry"),
        blocks: s("[]"),
        tags: s("[]"),
        linkedEntities: s("[]"),
        frontingSnapshots: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<JournalDocument>(bytes);
    expect(loaded.entries[asJournalEntryId("je_1")]?.title.val).toBe("Roundtrip entry");
  });
});

// ── NoteDocument ────────────────────────────────────────────────────

describe("NoteDocument schema", () => {
  it("initializes with empty notes map", () => {
    const doc = makeNoteDoc();
    expect(Object.keys(doc.notes)).toHaveLength(0);
  });

  it("adds and reads a note", () => {
    let doc = makeNoteDoc();
    doc = Automerge.change(doc, (d) => {
      d.notes[asNoteId("note_1")] = {
        id: s("note_1"),
        systemId: s("sys_test"),
        authorEntityType: s("member"),
        authorEntityId: s("mem_1"),
        title: s("My note"),
        content: s("Note content"),
        backgroundColor: s("#FFEB3B"),
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    expect(doc.notes[asNoteId("note_1")]?.title.val).toBe("My note");
    expect(doc.notes[asNoteId("note_1")]?.authorEntityType?.val).toBe("member");
    expect(doc.notes[asNoteId("note_1")]?.backgroundColor?.val).toBe("#FFEB3B");
  });

  it("saves and loads via binary serialization", () => {
    let doc = makeNoteDoc();
    doc = Automerge.change(doc, (d) => {
      d.notes[asNoteId("note_1")] = {
        id: s("note_1"),
        systemId: s("sys_test"),
        authorEntityType: null,
        authorEntityId: null,
        title: s("Quick note"),
        content: s("Reminder"),
        backgroundColor: null,
        archived: false,
        createdAt: 1000,
        updatedAt: 1000,
      };
    });
    const bytes = Automerge.save(doc);
    const loaded = Automerge.load<NoteDocument>(bytes);
    expect(loaded.notes[asNoteId("note_1")]?.title.val).toBe("Quick note");
    expect(loaded.notes[asNoteId("note_1")]?.authorEntityType).toBeNull();
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
      d.friendConnections[asFriendConnectionId("fc_1")] = {
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
      const fc = d.friendConnections[asFriendConnectionId("fc_1")];
      if (fc) {
        fc.assignedBuckets[asBucketId("bkt_1")] = true;
      }
    });
    expect(
      doc.friendConnections[asFriendConnectionId("fc_1")]?.assignedBuckets[asBucketId("bkt_1")],
    ).toBe(true);
    expect(
      Object.keys(doc.friendConnections[asFriendConnectionId("fc_1")]?.assignedBuckets ?? {}),
    ).toHaveLength(1);
  });

  it("adds a key grant and mutates revokedAt (append-lww)", () => {
    let doc = makePrivacyConfigDoc();
    doc = Automerge.change(doc, (d) => {
      d.keyGrants[asKeyGrantId("kg_1")] = {
        id: s("kg_1"),
        bucketId: s("bkt_1"),
        friendAccountId: s("acc_2"),
        encryptedBucketKey: s("base64encodedkey=="),
        keyVersion: 1,
        createdAt: 1000,
        revokedAt: null,
      };
    });
    expect(doc.keyGrants[asKeyGrantId("kg_1")]?.revokedAt).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const kg = d.keyGrants[asKeyGrantId("kg_1")];
      if (kg) kg.revokedAt = 9999;
    });
    expect(doc.keyGrants[asKeyGrantId("kg_1")]?.revokedAt).toBe(9999);
  });

  it("saves and loads via binary serialization", () => {
    let doc = makePrivacyConfigDoc();
    doc = Automerge.change(doc, (d) => {
      d.buckets[asBucketId("bkt_1")] = {
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
    expect(loaded.buckets[asBucketId("bkt_1")]?.name.val).toBe("Friends");
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
      d.members[asMemberId("mem_1")] = {
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
    expect(loaded.members[asMemberId("mem_1")]?.name.val).toBe("Projected Member");
  });
});
