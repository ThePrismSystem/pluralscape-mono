import * as Automerge from "@automerge/automerge";
import { describe, expect, it } from "vitest";

import { makeChatDoc, makeFrontingDoc, s } from "./helpers/schema-fixtures.js";
import { asBoardMessageId, asCheckInRecordId, asFrontingSessionId } from "./test-crypto-helpers.js";

import type { ChatDocument } from "../schemas/chat.js";
import type { FrontingDocument } from "../schemas/fronting.js";

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
      d.sessions[asFrontingSessionId("fs_1")] = {
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
    expect(doc.sessions[asFrontingSessionId("fs_1")]?.endTime).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const session = d.sessions[asFrontingSessionId("fs_1")];
      if (session) {
        session.endTime = 2000;
        session.updatedAt = 2000;
      }
    });
    expect(doc.sessions[asFrontingSessionId("fs_1")]?.endTime).toBe(2000);
  });

  it("sets and updates outtrigger and outtriggerSentiment fields", () => {
    let doc = makeFrontingDoc();
    doc = Automerge.change(doc, (d) => {
      d.sessions[asFrontingSessionId("fs_ot")] = {
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
    expect(doc.sessions[asFrontingSessionId("fs_ot")]?.outtrigger).toBeNull();
    expect(doc.sessions[asFrontingSessionId("fs_ot")]?.outtriggerSentiment).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const session = d.sessions[asFrontingSessionId("fs_ot")];
      if (session) {
        session.outtrigger = s("stress from work");
        session.outtriggerSentiment = s("negative");
        session.updatedAt = 3500;
      }
    });
    expect(doc.sessions[asFrontingSessionId("fs_ot")]?.outtrigger?.val).toBe("stress from work");
    expect(doc.sessions[asFrontingSessionId("fs_ot")]?.outtriggerSentiment?.val).toBe("negative");

    doc = Automerge.change(doc, (d) => {
      const session = d.sessions[asFrontingSessionId("fs_ot")];
      if (session) {
        session.outtriggerSentiment = s("neutral");
        session.updatedAt = 4000;
      }
    });
    expect(doc.sessions[asFrontingSessionId("fs_ot")]?.outtriggerSentiment?.val).toBe("neutral");
  });

  it("adds and responds to a check-in record (mutable fields)", () => {
    let doc = makeFrontingDoc();
    doc = Automerge.change(doc, (d) => {
      d.checkInRecords[asCheckInRecordId("cr_1")] = {
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
    expect(doc.checkInRecords[asCheckInRecordId("cr_1")]?.respondedByMemberId).toBeNull();

    doc = Automerge.change(doc, (d) => {
      const record = d.checkInRecords[asCheckInRecordId("cr_1")];
      if (record) {
        record.respondedByMemberId = s("mem_1");
        record.respondedAt = 1100;
        record.updatedAt = 1100;
      }
    });
    expect(doc.checkInRecords[asCheckInRecordId("cr_1")]?.respondedByMemberId?.val).toBe("mem_1");
    expect(doc.checkInRecords[asCheckInRecordId("cr_1")]?.respondedAt).toBe(1100);
  });

  it("saves and loads via binary serialization with session data", () => {
    let doc = makeFrontingDoc();
    doc = Automerge.change(doc, (d) => {
      d.sessions[asFrontingSessionId("fs_rt")] = {
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
    const session = loaded.sessions[asFrontingSessionId("fs_rt")];
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
      d.boardMessages[asBoardMessageId("bm_1")] = {
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
    expect(doc.boardMessages[asBoardMessageId("bm_1")]?.pinned).toBe(false);

    doc = Automerge.change(doc, (d) => {
      const bm = d.boardMessages[asBoardMessageId("bm_1")];
      if (bm) bm.pinned = true;
    });
    expect(doc.boardMessages[asBoardMessageId("bm_1")]?.pinned).toBe(true);
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
