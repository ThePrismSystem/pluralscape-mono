/**
 * Row transform tests for communication entities: channels, messages, board messages,
 * polls, acknowledgements, relationships, privacy buckets, and friend connections.
 *
 * Covers: rowToChannel, rowToMessage, rowToBoardMessage, rowToPoll,
 *         rowToAcknowledgement, rowToRelationship, rowToPrivacyBucket,
 *         rowToFriendConnection
 * Companion files: row-transforms-primitives.test.ts,
 *                  row-transforms-member-fronting.test.ts,
 *                  row-transforms-structure-innerworld.test.ts,
 *                  row-transforms-misc.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  rowToAcknowledgement,
  rowToBoardMessage,
  rowToChannel,
  rowToFriendConnection,
  rowToMessage,
  rowToPoll,
  rowToPrivacyBucket,
  rowToRelationship,
} from "../row-transforms/index.js";

// ── rowToChannel ──────────────────────────────────────────────────────────────

describe("rowToChannel", () => {
  function baseChannelRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "chan-1",
      system_id: "sys-1",
      name: "general",
      type: "text",
      parent_id: null,
      sort_order: 0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps channel row", () => {
    const row: Record<string, unknown> = {
      id: "chan-1",
      system_id: "sys-1",
      name: "General",
      type: "text",
      parent_id: null,
      sort_order: 0.5,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToChannel(row);

    expect(result.id).toBe("chan-1");
    expect(result.name).toBe("General");
    expect(result.type).toBe("text");
    expect(result.parentId).toBeNull();
    expect(result.sortOrder).toBe(0.5);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("maps a non-archived channel row", () => {
    const result = rowToChannel(baseChannelRow());
    expect(result.id).toBe("chan-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.name).toBe("general");
    expect(result.type).toBe("text");
    expect(result.parentId).toBeNull();
    expect(result.sortOrder).toBe(0);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("returns archived channel when archived = 1", () => {
    const result = rowToChannel(baseChannelRow({ archived: 1, updated_at: 1_700_000_999_000 }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_999_000);
    }
  });

  it("populates parentId when present", () => {
    const result = rowToChannel(baseChannelRow({ parent_id: "chan-parent" }));
    expect(result.parentId).toBe("chan-parent");
  });
});

// ── rowToMessage ──────────────────────────────────────────────────────────────

describe("rowToMessage", () => {
  it("maps a chat message row with JSON arrays", () => {
    const row: Record<string, unknown> = {
      id: "msg-1",
      channel_id: "chan-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "Hello world",
      attachments: '["blob-1"]',
      mentions: '["mem-2"]',
      reply_to_id: null,
      timestamp: 1_700_000_000_000,
      edited_at: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToMessage(row);

    expect(result.id).toBe("msg-1");
    expect(result.channelId).toBe("chan-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.senderId).toBe("mem-1");
    expect(result.content).toBe("Hello world");
    expect(result.attachments).toEqual(["blob-1"]);
    expect(result.mentions).toEqual(["mem-2"]);
    expect(result.replyToId).toBeNull();
    expect(result.timestamp).toBe(1_700_000_000_000);
    expect(result.editedAt).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});

describe("rowToMessage edge branches", () => {
  it("falls back to created_at when updated_at is missing", () => {
    const row: Record<string, unknown> = {
      id: "msg-fallback",
      channel_id: "chan-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "Hi",
      attachments: "[]",
      mentions: "[]",
      reply_to_id: null,
      timestamp: 1_700_000_000_000,
      edited_at: null,
      archived: 0,
      created_at: 1_700_000_111_000,
      updated_at: null,
    };
    const result = rowToMessage(row);
    expect(result.updatedAt).toBe(1_700_000_111_000);
  });

  it("returns archived message when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "msg-arch",
      channel_id: "chan-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "old",
      attachments: "[]",
      mentions: "[]",
      reply_to_id: null,
      timestamp: 1_700_000_000_000,
      edited_at: 1_700_000_000_500,
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_222_000,
    };
    const result = rowToMessage(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_222_000);
    }
  });

  it("populates replyToId when present", () => {
    const row: Record<string, unknown> = {
      id: "msg-reply",
      channel_id: "chan-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "Yes",
      attachments: "[]",
      mentions: "[]",
      reply_to_id: "msg-original",
      timestamp: 1_700_000_000_000,
      edited_at: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };
    const result = rowToMessage(row);
    expect(result.replyToId).toBe("msg-original");
  });
});

// ── rowToBoardMessage ─────────────────────────────────────────────────────────

describe("rowToBoardMessage", () => {
  function baseBoardRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "bm-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "Welcome",
      pinned: 0,
      sort_order: 0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps board message row with boolean pinned", () => {
    const row: Record<string, unknown> = {
      id: "bm-1",
      system_id: "sys-1",
      sender_id: "mem-1",
      content: "Welcome!",
      pinned: 1,
      sort_order: 1.0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToBoardMessage(row);

    expect(result.id).toBe("bm-1");
    expect(result.senderId).toBe("mem-1");
    expect(result.content).toBe("Welcome!");
    expect(result.pinned).toBe(true);
    expect(result.sortOrder).toBe(1.0);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("maps a non-archived board message row", () => {
    const result = rowToBoardMessage(baseBoardRow());
    expect(result.id).toBe("bm-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.senderId).toBe("mem-1");
    expect(result.content).toBe("Welcome");
    expect(result.pinned).toBe(false);
    expect(result.sortOrder).toBe(0);
    expect(result.archived).toBe(false);
  });

  it("returns archived board message when archived = 1", () => {
    const result = rowToBoardMessage(
      baseBoardRow({ archived: 1, updated_at: 1_700_000_555_000, pinned: 1 }),
    );
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_555_000);
      expect(result.pinned).toBe(true);
    }
  });
});

// ── rowToPoll ─────────────────────────────────────────────────────────────────

describe("rowToPoll", () => {
  function basePollRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "poll-1",
      system_id: "sys-1",
      created_by_member_id: "mem-1",
      title: "What's for dinner?",
      description: "Help us decide",
      kind: "single",
      status: "open",
      closed_at: null,
      ends_at: null,
      allow_multiple_votes: 0,
      max_votes_per_member: 1,
      allow_abstain: 0,
      allow_veto: 0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps poll row with multiple boolean fields", () => {
    const row: Record<string, unknown> = {
      id: "poll-1",
      system_id: "sys-1",
      created_by_member_id: "mem-1",
      title: "Which day?",
      description: null,
      kind: "standard",
      status: "open",
      closed_at: null,
      ends_at: null,
      allow_multiple_votes: 0,
      max_votes_per_member: 1,
      allow_abstain: 1,
      allow_veto: 0,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToPoll(row);

    expect(result.id).toBe("poll-1");
    expect(result.title).toBe("Which day?");
    expect(result.kind).toBe("standard");
    expect(result.status).toBe("open");
    expect(result.allowMultipleVotes).toBe(false);
    expect(result.maxVotesPerMember).toBe(1);
    expect(result.allowAbstain).toBe(true);
    expect(result.allowVeto).toBe(false);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("maps a non-archived poll row", () => {
    const result = rowToPoll(basePollRow());
    expect(result.id).toBe("poll-1");
    expect(result.title).toBe("What's for dinner?");
    expect(result.description).toBe("Help us decide");
    expect(result.kind).toBe("single");
    expect(result.status).toBe("open");
    expect(result.closedAt).toBeNull();
    expect(result.endsAt).toBeNull();
    expect(result.allowMultipleVotes).toBe(false);
    expect(result.maxVotesPerMember).toBe(1);
    expect(result.allowAbstain).toBe(false);
    expect(result.allowVeto).toBe(false);
    expect(result.archived).toBe(false);
  });

  it("supports nullable description and bool flags = 1", () => {
    const result = rowToPoll(
      basePollRow({
        description: null,
        allow_multiple_votes: 1,
        allow_abstain: 1,
        allow_veto: 1,
      }),
    );
    expect(result.description).toBeNull();
    expect(result.allowMultipleVotes).toBe(true);
    expect(result.allowAbstain).toBe(true);
    expect(result.allowVeto).toBe(true);
  });

  it("returns archived poll when archived = 1", () => {
    const result = rowToPoll(
      basePollRow({ archived: 1, updated_at: 1_700_000_777_000, status: "closed" }),
    );
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_777_000);
    }
  });

  it("preserves closedAt and endsAt timestamps", () => {
    const result = rowToPoll(
      basePollRow({
        closed_at: 1_700_000_001_000,
        ends_at: 1_700_000_002_000,
      }),
    );
    expect(result.closedAt).toBe(1_700_000_001_000);
    expect(result.endsAt).toBe(1_700_000_002_000);
  });

  it("allows null createdByMemberId for SP-imported polls", () => {
    const result = rowToPoll(basePollRow({ created_by_member_id: null }));
    expect(result.createdByMemberId).toBeNull();
  });
});

// ── rowToAcknowledgement ──────────────────────────────────────────────────────

describe("rowToAcknowledgement", () => {
  function baseAckRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: "ack-1",
      system_id: "sys-1",
      created_by_member_id: "mem-1",
      target_member_id: "mem-2",
      message: "Please acknowledge",
      confirmed: 0,
      confirmed_at: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
      ...overrides,
    };
  }

  it("maps acknowledgement row with confirmed boolean", () => {
    const row: Record<string, unknown> = {
      id: "ack-1",
      system_id: "sys-1",
      created_by_member_id: "mem-1",
      target_member_id: "mem-2",
      message: "Are you okay?",
      confirmed: 0,
      confirmed_at: null,
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToAcknowledgement(row);

    expect(result.id).toBe("ack-1");
    expect(result.createdByMemberId).toBe("mem-1");
    expect(result.targetMemberId).toBe("mem-2");
    expect(result.message).toBe("Are you okay?");
    expect(result.confirmed).toBe(false);
    expect(result.confirmedAt).toBeNull();
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });

  it("maps a non-archived unconfirmed acknowledgement row", () => {
    const result = rowToAcknowledgement(baseAckRow());
    expect(result.id).toBe("ack-1");
    expect(result.createdByMemberId).toBe("mem-1");
    expect(result.targetMemberId).toBe("mem-2");
    expect(result.confirmed).toBe(false);
    expect(result.confirmedAt).toBeNull();
    expect(result.archived).toBe(false);
  });

  it("captures confirmedAt when confirmed = 1", () => {
    const result = rowToAcknowledgement(
      baseAckRow({ confirmed: 1, confirmed_at: 1_700_000_001_000 }),
    );
    expect(result.confirmed).toBe(true);
    expect(result.confirmedAt).toBe(1_700_000_001_000);
  });

  it("returns archived acknowledgement when archived = 1", () => {
    const result = rowToAcknowledgement(baseAckRow({ archived: 1, updated_at: 1_700_000_888_000 }));
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_888_000);
    }
  });

  it("allows null createdByMemberId", () => {
    const result = rowToAcknowledgement(baseAckRow({ created_by_member_id: null }));
    expect(result.createdByMemberId).toBeNull();
  });
});

// ── rowToRelationship ─────────────────────────────────────────────────────────

describe("rowToRelationship", () => {
  it("maps standard relationship row — no label key", () => {
    const row: Record<string, unknown> = {
      id: "rel-1",
      system_id: "sys-1",
      source_member_id: "mem-1",
      target_member_id: "mem-2",
      type: "sibling",
      label: null,
      bidirectional: 1,
      created_at: 1_700_000_000_000,
      archived: 0,
    };

    const result = rowToRelationship(row);

    expect(result.id).toBe("rel-1");
    expect(result.sourceMemberId).toBe("mem-1");
    expect(result.targetMemberId).toBe("mem-2");
    expect(result.type).toBe("sibling");
    expect("label" in result).toBe(false);
    expect(result.bidirectional).toBe(true);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.archived).toBe(false);
  });

  it("maps custom relationship row — carries label", () => {
    const row: Record<string, unknown> = {
      id: "rel-2",
      system_id: "sys-1",
      source_member_id: "mem-1",
      target_member_id: "mem-2",
      type: "custom",
      label: "Twin",
      bidirectional: 0,
      created_at: 1_700_000_000_000,
      archived: 0,
    };

    const result = rowToRelationship(row);

    expect(result.type).toBe("custom");
    if (result.type === "custom") {
      expect(result.label).toBe("Twin");
    }
    expect(result.archived).toBe(false);
  });
});

// ── rowToPrivacyBucket ────────────────────────────────────────────────────────

describe("rowToPrivacyBucket", () => {
  it("maps bucket row to PrivacyBucket domain type", () => {
    const row: Record<string, unknown> = {
      id: "bkt-1",
      system_id: "sys-1",
      name: "Friends Only",
      description: "Visible to close friends",
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToPrivacyBucket(row);

    expect(result.id).toBe("bkt-1");
    expect(result.systemId).toBe("sys-1");
    expect(result.name).toBe("Friends Only");
    expect(result.description).toBe("Visible to close friends");
    expect(result.archived).toBe(false);
    expect(result.createdAt).toBe(1_700_000_000_000);
    expect(result.updatedAt).toBe(1_700_000_000_000);
    expect(result.version).toBe(0);
  });

  it("returns Archived<PrivacyBucket> with archivedAt when archived = 1", () => {
    const row: Record<string, unknown> = {
      id: "bkt-2",
      system_id: "sys-1",
      name: "Old bucket",
      description: null,
      archived: 1,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_001_000,
    };

    const result = rowToPrivacyBucket(row);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_001_000);
    }
  });
});

// ── rowToFriendConnection ─────────────────────────────────────────────────────

describe("rowToFriendConnection", () => {
  it("maps friend connection row with JSON-serialized arrays", () => {
    const row: Record<string, unknown> = {
      id: "fc-1",
      account_id: "acct-1",
      friend_account_id: "acct-2",
      status: "accepted",
      assigned_buckets: '["bkt-1","bkt-2"]',
      visibility:
        '{"showMembers":true,"showGroups":true,"showStructure":false,"allowFrontingNotifications":true}',
      archived: 0,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    };

    const result = rowToFriendConnection(row);

    expect(result.id).toBe("fc-1");
    expect(result.accountId).toBe("acct-1");
    expect(result.friendAccountId).toBe("acct-2");
    expect(result.status).toBe("accepted");
    expect(result.assignedBucketIds).toEqual(["bkt-1", "bkt-2"]);
    expect(result.archived).toBe(false);
    expect(result.version).toBe(0);
  });
});
