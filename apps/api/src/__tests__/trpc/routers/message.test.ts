import { brandId } from "@pluralscape/types";
import { callProcedure } from "@trpc/server/unstable-core-do-not-import";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../../lib/api-error.js";
import { router } from "../../../trpc/trpc.js";
import {
  MOCK_AUTH,
  MOCK_SYSTEM_ID,
  makeCallerFactory,
  makeContext,
  type SystemId,
  assertProcedureRateLimited,
} from "../test-helpers.js";

import type { EncryptedBase64, ChannelId, MessageId, UnixMillis } from "@pluralscape/types";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
}));

vi.mock("../../../lib/entity-pubsub.js", () => ({
  publishEntityChange: vi.fn().mockResolvedValue(true),
  subscribeToEntityChanges: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)),
}));

vi.mock("../../../services/message/create.js", () => ({
  createMessage: vi.fn(),
}));
vi.mock("../../../services/message/queries.js", () => ({
  getMessage: vi.fn(),
  listMessages: vi.fn(),
}));
vi.mock("../../../services/message/update.js", () => ({
  updateMessage: vi.fn(),
}));
vi.mock("../../../services/message/lifecycle.js", () => ({
  archiveMessage: vi.fn(),
  restoreMessage: vi.fn(),
}));
vi.mock("../../../services/message/delete.js", () => ({
  deleteMessage: vi.fn(),
}));

const { createMessage } = await import("../../../services/message/create.js");
const { getMessage, listMessages } = await import("../../../services/message/queries.js");
const { updateMessage } = await import("../../../services/message/update.js");
const { archiveMessage, restoreMessage } = await import("../../../services/message/lifecycle.js");
const { deleteMessage } = await import("../../../services/message/delete.js");

const { subscribeToEntityChanges } = await import("../../../lib/entity-pubsub.js");

const { messageRouter } = await import("../../../trpc/routers/message.js");

const createCaller = makeCallerFactory({ message: messageRouter });

const CHANNEL_ID = brandId<ChannelId>("ch_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const OTHER_CHANNEL_ID = brandId<ChannelId>("ch_bbbbbbbb-cccc-dddd-eeee-ffffffffffff");
const MESSAGE_ID = brandId<MessageId>("msg_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
const VALID_ENCRYPTED_DATA = "dGVzdGRhdGFmb3JtZXNzYWdl";
const VALID_TIMESTAMP = 1_700_000_000_000 as UnixMillis;

const MOCK_MESSAGE_RESULT = {
  id: MESSAGE_ID,
  channelId: CHANNEL_ID,
  systemId: MOCK_SYSTEM_ID,
  replyToId: null,
  timestamp: VALID_TIMESTAMP,
  editedAt: null,
  encryptedData: "base64data==" as EncryptedBase64,
  version: 1,
  archived: false,
  archivedAt: null,
  createdAt: VALID_TIMESTAMP,
  updatedAt: VALID_TIMESTAMP,
};

/** Call the onChange subscription procedure directly, bypassing the server-side caller
 * which does not support subscriptions. Returns the raw async generator. */
async function callOnChange(channelId: ChannelId, signal: AbortSignal): Promise<AsyncGenerator> {
  const appRouter = router({ message: messageRouter });
  const ctx = makeContext(MOCK_AUTH);
  const input = { systemId: MOCK_SYSTEM_ID, channelId };
  return callProcedure({
    router: appRouter,
    ctx,
    getRawInput: () => Promise.resolve(input),
    input,
    path: "message.onChange",
    type: "subscription",
    signal,
    batchIndex: 0,
  }) as Promise<AsyncGenerator>;
}

describe("message router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ────────────────────────────────────────────────────────

  describe("message.create", () => {
    it("calls createMessage with correct systemId, channelId, and returns result", async () => {
      vi.mocked(createMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.message.create({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        timestamp: VALID_TIMESTAMP,
        replyToId: undefined,
      });

      expect(vi.mocked(createMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(createMessage).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(createMessage).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("throws UNAUTHORIZED for unauthenticated callers", async () => {
      const caller = createCaller(null);
      await expect(
        caller.message.create({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          timestamp: VALID_TIMESTAMP,
          replyToId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
    });

    it("throws NOT_FOUND when systemId is not owned", async () => {
      const foreignSystemId = brandId<SystemId>("sys_ffffffff-ffff-ffff-ffff-ffffffffffff");
      const caller = createCaller();
      await expect(
        caller.message.create({
          systemId: foreignSystemId,
          channelId: CHANNEL_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          timestamp: VALID_TIMESTAMP,
          replyToId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });

    it("rejects invalid channelId format", async () => {
      const caller = createCaller();
      await expect(
        caller.message.create({
          systemId: MOCK_SYSTEM_ID,
          channelId: brandId<ChannelId>("invalid-id"),
          encryptedData: VALID_ENCRYPTED_DATA,
          timestamp: VALID_TIMESTAMP,
          replyToId: undefined,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });
  });

  // ── get ───────────────────────────────────────────────────────────

  describe("message.get", () => {
    it("calls getMessage with correct systemId and messageId", async () => {
      vi.mocked(getMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.message.get({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      });

      expect(vi.mocked(getMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(getMessage).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(getMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("rejects invalid messageId format", async () => {
      const caller = createCaller();
      await expect(
        caller.message.get({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: brandId<MessageId>("invalid-id"),
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(getMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.message.get({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── list ──────────────────────────────────────────────────────────

  describe("message.list", () => {
    it("calls listMessages with correct channelId and returns result", async () => {
      const mockResult = {
        data: [MOCK_MESSAGE_RESULT],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      };
      vi.mocked(listMessages).mockResolvedValue(mockResult);
      const caller = createCaller();
      const result = await caller.message.list({ systemId: MOCK_SYSTEM_ID, channelId: CHANNEL_ID });

      expect(vi.mocked(listMessages)).toHaveBeenCalledOnce();
      expect(vi.mocked(listMessages).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(listMessages).mock.calls[0]?.[2]).toBe(CHANNEL_ID);
      expect(result).toEqual(mockResult);
    });

    it("passes cursor, limit, and includeArchived as opts", async () => {
      vi.mocked(listMessages).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.message.list({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        cursor: "cur_abc",
        limit: 10,
        includeArchived: true,
      });

      const opts = vi.mocked(listMessages).mock.calls[0]?.[4];
      expect(opts?.cursor).toBe("cur_abc");
      expect(opts?.limit).toBe(10);
      expect(opts?.includeArchived).toBe(true);
    });

    it("passes undefined cursor when cursor is null (??-branch)", async () => {
      vi.mocked(listMessages).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.message.list({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        cursor: null,
      });

      const opts = vi.mocked(listMessages).mock.calls[0]?.[4];
      expect(opts?.cursor).toBeUndefined();
    });

    it("passes converted before/after timestamps when provided", async () => {
      vi.mocked(listMessages).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      const BEFORE_TS = 1_700_000_100_000;
      const AFTER_TS = 1_699_999_900_000;
      await caller.message.list({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        before: BEFORE_TS,
        after: AFTER_TS,
      });

      const opts = vi.mocked(listMessages).mock.calls[0]?.[4];
      expect(opts?.before).toBe(BEFORE_TS);
      expect(opts?.after).toBe(AFTER_TS);
    });

    it("passes undefined before/after when not provided", async () => {
      vi.mocked(listMessages).mockResolvedValue({
        data: [],
        nextCursor: null,
        hasMore: false,
        totalCount: null,
      });
      const caller = createCaller();
      await caller.message.list({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
      });

      const opts = vi.mocked(listMessages).mock.calls[0]?.[4];
      expect(opts?.before).toBeUndefined();
      expect(opts?.after).toBeUndefined();
    });
  });

  // ── update ────────────────────────────────────────────────────────

  describe("message.update", () => {
    it("calls updateMessage with correct systemId and messageId", async () => {
      vi.mocked(updateMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.message.update({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
        encryptedData: VALID_ENCRYPTED_DATA,
        version: 1,
      });

      expect(vi.mocked(updateMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(updateMessage).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(updateMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("surfaces ApiHttpError(409) as CONFLICT", async () => {
      vi.mocked(updateMessage).mockRejectedValue(
        new ApiHttpError(409, "CONFLICT", "Version mismatch"),
      );
      const caller = createCaller();
      await expect(
        caller.message.update({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          version: 1,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CONFLICT" }));
    });
  });

  // ── archive ───────────────────────────────────────────────────────

  describe("message.archive", () => {
    it("calls archiveMessage and returns success", async () => {
      vi.mocked(archiveMessage).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.message.archive({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(archiveMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(archiveMessage).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(archiveMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(archiveMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.message.archive({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── restore ───────────────────────────────────────────────────────

  describe("message.restore", () => {
    it("calls restoreMessage and returns the message result", async () => {
      vi.mocked(restoreMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
      const caller = createCaller();
      const result = await caller.message.restore({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      });

      expect(vi.mocked(restoreMessage)).toHaveBeenCalledOnce();
      expect(vi.mocked(restoreMessage).mock.calls[0]?.[1]).toBe(MOCK_SYSTEM_ID);
      expect(vi.mocked(restoreMessage).mock.calls[0]?.[2]).toBe(MESSAGE_ID);
      expect(result).toEqual(MOCK_MESSAGE_RESULT);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(restoreMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.message.restore({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe("message.delete", () => {
    it("calls deleteMessage and returns success (no timestamp)", async () => {
      vi.mocked(deleteMessage).mockResolvedValue(undefined);
      const caller = createCaller();
      const result = await caller.message.delete({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
      });

      expect(result).toEqual({ success: true });
      expect(vi.mocked(deleteMessage)).toHaveBeenCalledOnce();
      const opts = vi.mocked(deleteMessage).mock.calls[0]?.[5];
      expect(opts?.timestamp).toBeUndefined();
    });

    it("passes converted timestamp when provided (timestamp-branch)", async () => {
      vi.mocked(deleteMessage).mockResolvedValue(undefined);
      const caller = createCaller();
      await caller.message.delete({
        systemId: MOCK_SYSTEM_ID,
        channelId: CHANNEL_ID,
        messageId: MESSAGE_ID,
        timestamp: VALID_TIMESTAMP,
      });

      const opts = vi.mocked(deleteMessage).mock.calls[0]?.[5];
      expect(opts?.timestamp).toBe(VALID_TIMESTAMP);
    });

    it("surfaces ApiHttpError(404) as NOT_FOUND", async () => {
      vi.mocked(deleteMessage).mockRejectedValue(
        new ApiHttpError(404, "NOT_FOUND", "Message not found"),
      );
      const caller = createCaller();
      await expect(
        caller.message.delete({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          messageId: MESSAGE_ID,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
    });
  });

  // ── onChange ──────────────────────────────────────────────────────

  describe("message.onChange", () => {
    it("yields events matching the subscribed channelId (channelId-match branch)", async () => {
      // Capture the subscription handler so we can drive it from the test.
      type ChangeHandler = Parameters<typeof subscribeToEntityChanges>[2];
      let capturedHandler: ChangeHandler = () => undefined;
      vi.mocked(subscribeToEntityChanges).mockImplementation((_, __, handler) => {
        capturedHandler = handler;
        // Emit one matching event synchronously so the queue is pre-loaded.
        handler({
          entity: "message",
          type: "created",
          messageId: MESSAGE_ID,
          channelId: CHANNEL_ID,
        });
        return Promise.resolve(() => Promise.resolve());
      });

      const ac = new AbortController();
      const gen = await callOnChange(CHANNEL_ID, ac.signal);

      // First .next(): drains the pre-loaded queue item and yields it.
      const first = await gen.next();

      // Start the next iteration (resumes from yield, exits inner while,
      // reaches line 191 `await new Promise`). Don't await yet — we need to
      // unblock it first.
      const pending = gen.next();

      // Flush microtasks so the generator actually reaches line 191.
      await Promise.resolve();
      await Promise.resolve();

      // Abort the signal and fire the handler to call resolve(), unblocking
      // the `await new Promise`. The generator then checks !signal.aborted,
      // exits the outer while, and finishes.
      ac.abort();
      capturedHandler({
        entity: "message",
        type: "created",
        messageId: MESSAGE_ID,
        channelId: CHANNEL_ID,
      });

      // Now await the pending next() — generator finishes (done: true) or
      // yields the second event; either way we then close.
      await pending;
      await gen.return(undefined);

      expect(first.done).toBe(false);
      expect(first.value).not.toBeUndefined();
    });

    it("filters out events for a different channelId (channelId-mismatch branch)", async () => {
      // Capture the handler so we can drive resolve() after the generator is running.
      type ChangeHandler = Parameters<typeof subscribeToEntityChanges>[2];
      let capturedMismatchHandler: ChangeHandler = () => undefined;
      vi.mocked(subscribeToEntityChanges).mockImplementation((_, __, handler) => {
        capturedMismatchHandler = handler;
        // Emit an event for a DIFFERENT channel — queue stays empty (false branch of line 177).
        handler({
          entity: "message",
          type: "created",
          messageId: MESSAGE_ID,
          channelId: OTHER_CHANNEL_ID,
        });
        return Promise.resolve(() => Promise.resolve());
      });

      const ac = new AbortController();
      const gen = await callOnChange(CHANNEL_ID, ac.signal);

      // Start the generator — this triggers subscribeToEntityChanges (running the mock
      // which fires the handler, covering the false branch of line 177). The generator
      // then enters the outer while with an empty queue and hits `await new Promise`.
      const pending = gen.next();

      // Flush microtasks so the generator reaches `await new Promise`.
      await Promise.resolve();
      await Promise.resolve();

      // Abort and fire the handler (any channel) to call resolve() and unblock.
      ac.abort();
      capturedMismatchHandler({
        entity: "message",
        type: "created",
        messageId: MESSAGE_ID,
        channelId: CHANNEL_ID,
      });

      // Generator exits the outer while (aborted) and finishes.
      const result = await pending;
      await gen.return(undefined);

      expect(result.done).toBe(true);
    });

    it("handles null unsubscribe when pub/sub is not configured (unsubscribe null branch)", async () => {
      // subscribeToEntityChanges returns null when pub/sub is unavailable.
      vi.mocked(subscribeToEntityChanges).mockResolvedValue(null);

      const ac = new AbortController();
      ac.abort();
      const gen = await callOnChange(CHANNEL_ID, ac.signal);
      const result = await gen.return(undefined);

      expect(result.done).toBe(true);
    });
  });

  // ── rate limiting ─────────────────────────────────────────────────

  it("applies rate limiting to queries", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(listMessages).mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
      totalCount: null,
    });
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () => caller.message.list({ systemId: MOCK_SYSTEM_ID, channelId: CHANNEL_ID }),
      "readDefault",
    );
  });

  it("applies rate limiting to mutations", async () => {
    const { checkRateLimit } = await import("../../../middleware/rate-limit.js");
    vi.mocked(createMessage).mockResolvedValue(MOCK_MESSAGE_RESULT);
    const caller = createCaller();
    await assertProcedureRateLimited(
      vi.mocked(checkRateLimit),
      () =>
        caller.message.create({
          systemId: MOCK_SYSTEM_ID,
          channelId: CHANNEL_ID,
          encryptedData: VALID_ENCRYPTED_DATA,
          timestamp: VALID_TIMESTAMP,
          replyToId: undefined,
        }),
      "write",
    );
  });
});
