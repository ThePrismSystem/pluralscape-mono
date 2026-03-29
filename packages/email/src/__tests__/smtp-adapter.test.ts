import { beforeEach, describe, expect, it, vi } from "vitest";

import { SmtpEmailAdapter } from "../adapters/smtp/index.js";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  EmailRateLimitError,
  InvalidRecipientError,
} from "../errors.js";

import { runEmailAdapterContract } from "./email-adapter.contract.js";

function createMockTransport() {
  return {
    sendMail: vi.fn().mockResolvedValue({
      messageId: "<mock-smtp-id@localhost>",
      accepted: ["test@example.com"],
      rejected: [],
    }),
    close: vi.fn(),
    verify: vi.fn().mockResolvedValue(true),
  };
}

describe("SmtpEmailAdapter", () => {
  // Contract tests via fromTransport
  runEmailAdapterContract(() =>
    SmtpEmailAdapter.fromTransport(createMockTransport(), "test@example.com"),
  );

  it("has providerName 'smtp'", () => {
    const adapter = SmtpEmailAdapter.fromTransport(createMockTransport(), "test@example.com");
    expect(adapter.providerName).toBe("smtp");
  });

  describe("send", () => {
    let mockTransport: ReturnType<typeof createMockTransport>;
    let adapter: SmtpEmailAdapter;

    beforeEach(() => {
      mockTransport = createMockTransport();
      adapter = SmtpEmailAdapter.fromTransport(mockTransport, "sender@example.com");
    });

    it("returns the message ID from SMTP", async () => {
      const result = await adapter.send({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
        text: "Hello",
      });
      expect(result.messageId).toBe("<mock-smtp-id@localhost>");
    });

    it("passes to, subject, html, and text to sendMail", async () => {
      await adapter.send({
        to: "user@example.com",
        subject: "Subject Line",
        html: "<p>Body</p>",
        text: "Body",
      });

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Subject Line",
          html: "<p>Body</p>",
          text: "Body",
        }),
      );
    });

    it("uses configured fromAddress as default sender", async () => {
      await adapter.send({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      });

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "sender@example.com",
        }),
      );
    });

    it("overrides from when specified in params", async () => {
      await adapter.send({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
        from: "custom@example.com",
      });

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: "custom@example.com",
        }),
      );
    });

    it("passes replyTo when specified", async () => {
      await adapter.send({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
        replyTo: "reply@example.com",
      });

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          replyTo: "reply@example.com",
        }),
      );
    });

    it("joins array recipients with comma for Nodemailer", async () => {
      await adapter.send({
        to: ["a@example.com", "b@example.com"],
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      });

      expect(mockTransport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "a@example.com, b@example.com",
        }),
      );
    });

    it("returns null messageId when transport returns undefined", async () => {
      mockTransport.sendMail.mockResolvedValueOnce({
        accepted: ["test@example.com"],
        rejected: [],
      });

      const result = await adapter.send({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      });
      expect(result.messageId).toBeNull();
    });
  });

  describe("error mapping", () => {
    let mockTransport: ReturnType<typeof createMockTransport>;
    let adapter: SmtpEmailAdapter;

    beforeEach(() => {
      mockTransport = createMockTransport();
      adapter = SmtpEmailAdapter.fromTransport(mockTransport, "sender@example.com");
    });

    it("maps ECONNREFUSED to EmailConfigurationError", async () => {
      const error = new Error("connect ECONNREFUSED 127.0.0.1:587");
      (error as NodeJS.ErrnoException).code = "ECONNREFUSED";
      mockTransport.sendMail.mockRejectedValueOnce(error);

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailConfigurationError);
    });

    it("maps EAUTH to EmailConfigurationError", async () => {
      const error = new Error("Invalid login");
      (error as NodeJS.ErrnoException).code = "EAUTH";
      mockTransport.sendMail.mockRejectedValueOnce(error);

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailConfigurationError);
    });

    it("maps ESOCKET to EmailConfigurationError", async () => {
      const error = new Error("Socket closed");
      (error as NodeJS.ErrnoException).code = "ESOCKET";
      mockTransport.sendMail.mockRejectedValueOnce(error);

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailConfigurationError);
    });

    it("maps SMTP 550 response code to InvalidRecipientError", async () => {
      const error = new Error("550 User not found");
      Object.assign(error, { responseCode: 550 });
      mockTransport.sendMail.mockRejectedValueOnce(error);

      await expect(
        adapter.send({
          to: "bad@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(InvalidRecipientError);
    });

    it("maps SMTP 553 response code to InvalidRecipientError", async () => {
      const error = new Error("553 Mailbox name not allowed");
      Object.assign(error, { responseCode: 553 });
      mockTransport.sendMail.mockRejectedValueOnce(error);

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(InvalidRecipientError);
    });

    it("maps SMTP 421 response code to EmailRateLimitError", async () => {
      const error = new Error("421 Too many connections");
      Object.assign(error, { responseCode: 421 });
      mockTransport.sendMail.mockRejectedValueOnce(error);

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailRateLimitError);
    });

    it("maps SMTP 452 response code to EmailRateLimitError", async () => {
      const error = new Error("452 Too many messages");
      Object.assign(error, { responseCode: 452 });
      mockTransport.sendMail.mockRejectedValueOnce(error);

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailRateLimitError);
    });

    it("maps unknown errors to EmailDeliveryError", async () => {
      mockTransport.sendMail.mockRejectedValueOnce(new Error("Unknown failure"));

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailDeliveryError);
    });
  });
});
