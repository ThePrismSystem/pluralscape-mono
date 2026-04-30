/**
 * Row transform tests for channel-shaped communication entities: channels,
 * messages, and board messages.
 *
 * Covers: rowToChannel, rowToMessage (+ edge branches), rowToBoardMessage
 * Companion files: row-transforms-primitives.test.ts,
 *                  row-transforms-member-fronting.test.ts,
 *                  row-transforms-structure-innerworld.test.ts,
 *                  row-transforms-documents.test.ts,
 *                  row-transforms-lifecycle-fields.test.ts,
 *                  row-transforms-polls-social.test.ts
 */
import { describe, expect, it } from "vitest";

import {
  rowToBoardMessage,
  rowToChannel,
  rowToMessage,
} from "../../row-transforms/index.js";

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
