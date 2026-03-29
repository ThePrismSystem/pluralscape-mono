import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDb } from "../helpers/mock-db.js";

import type { EmailAdapter, EmailSendParams, EmailSendResult } from "@pluralscape/email";
import type { AccountId, JobPayloadMap } from "@pluralscape/types";

// ── Mocks ────────────────────────────────────────────────────────────

const mockResolveAccountEmail = vi.fn<(db: unknown, accountId: string) => Promise<string | null>>();

vi.mock("../../lib/email-resolve.js", () => ({
  resolveAccountEmail: (...args: unknown[]) => mockResolveAccountEmail(args[0], args[1] as string),
}));

const mockAdapter: EmailAdapter & { send: ReturnType<typeof vi.fn> } = {
  providerName: "test",
  send: vi.fn<(params: EmailSendParams) => Promise<EmailSendResult>>().mockResolvedValue({
    messageId: "test-msg-1",
  }),
};

vi.mock("../../lib/email.js", () => ({
  getEmailAdapter: () => mockAdapter,
}));

vi.mock("../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ── Imports after mocks ──────────────────────────────────────────────

const { processEmailJob } = await import("../../services/email-worker.js");
const { logger } = await import("../../lib/logger.js");

// ── Fixtures ─────────────────────────────────────────────────────────

const ACCOUNT_ID = "acct_test-email" as AccountId;

function makeJobPayload(
  overrides?: Partial<JobPayloadMap["email-send"]>,
): JobPayloadMap["email-send"] {
  return {
    accountId: ACCOUNT_ID,
    template: "recovery-key-regenerated",
    vars: {
      timestamp: "2026-03-29T00:00:00Z",
      deviceInfo: "Test Browser",
    },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe("email-worker", () => {
  afterEach(() => {
    mockResolveAccountEmail.mockReset();
    mockAdapter.send.mockReset().mockResolvedValue({ messageId: "test-msg-1" });
  });

  describe("processEmailJob", () => {
    it("resolves email, renders template, and sends via adapter", async () => {
      const { db } = mockDb();
      mockResolveAccountEmail.mockResolvedValueOnce("user@example.com");

      await processEmailJob(db, makeJobPayload());

      expect(mockResolveAccountEmail).toHaveBeenCalledWith(db, ACCOUNT_ID);
      expect(mockAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.any(String),
          html: expect.any(String),
          text: expect.any(String),
        }),
      );
      expect(vi.mocked(logger)["info"]).toHaveBeenCalledWith(
        "[email-worker] email sent",
        expect.objectContaining({
          accountId: ACCOUNT_ID,
          template: "recovery-key-regenerated",
          provider: "test",
        }),
      );
    });

    it("skips sending when no email address is found", async () => {
      const { db } = mockDb();
      mockResolveAccountEmail.mockResolvedValueOnce(null);

      await processEmailJob(db, makeJobPayload());

      expect(mockAdapter.send).not.toHaveBeenCalled();
      expect(vi.mocked(logger)["warn"]).toHaveBeenCalledWith(
        "[email-worker] no email address found for account, skipping",
        expect.objectContaining({ accountId: ACCOUNT_ID }),
      );
    });

    it("propagates adapter errors for queue retry", async () => {
      const { db } = mockDb();
      mockResolveAccountEmail.mockResolvedValueOnce("user@example.com");
      const deliveryError = new Error("SMTP connection refused");
      mockAdapter.send.mockRejectedValueOnce(deliveryError);

      await expect(processEmailJob(db, makeJobPayload())).rejects.toThrow(
        "SMTP connection refused",
      );
    });

    it("propagates email resolution errors for queue retry", async () => {
      const { db } = mockDb();
      const decryptError = new Error("Decryption failed");
      mockResolveAccountEmail.mockRejectedValueOnce(decryptError);

      await expect(processEmailJob(db, makeJobPayload())).rejects.toThrow("Decryption failed");
    });

    it("sends with correct template vars for password-changed", async () => {
      const { db } = mockDb();
      mockResolveAccountEmail.mockResolvedValueOnce("user@example.com");

      await processEmailJob(
        db,
        makeJobPayload({
          template: "password-changed",
          vars: { timestamp: "2026-03-29T12:00:00Z" },
        }),
      );

      expect(mockAdapter.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: expect.any(String),
        }),
      );
    });
  });
});
