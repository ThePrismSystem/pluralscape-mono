import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResendEmailAdapter } from "../adapters/resend/index.js";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  EmailRateLimitError,
  InvalidRecipientError,
} from "../errors.js";

import { runEmailAdapterContract } from "./email-adapter.contract.js";

function createMockResendClient() {
  return {
    emails: {
      send: vi.fn().mockResolvedValue({
        data: { id: "mock-resend-id" },
        error: null,
      }),
    },
  };
}

describe("ResendEmailAdapter", () => {
  // Contract tests via fromClient (avoids needing to mock the Resend constructor)
  runEmailAdapterContract(() =>
    ResendEmailAdapter.fromClient(createMockResendClient(), "test@example.com"),
  );

  it("has providerName 'resend'", () => {
    const adapter = ResendEmailAdapter.fromClient(createMockResendClient(), "test@example.com");
    expect(adapter.providerName).toBe("resend");
  });

  describe("send", () => {
    let mockClient: ReturnType<typeof createMockResendClient>;
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      mockClient = createMockResendClient();
      adapter = ResendEmailAdapter.fromClient(mockClient, "sender@example.com");
    });

    it("returns the message ID from Resend", async () => {
      const result = await adapter.send({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
        text: "Hello",
      });
      expect(result.messageId).toBe("mock-resend-id");
    });

    it("passes to, subject, html, and text to the SDK", async () => {
      await adapter.send({
        to: "user@example.com",
        subject: "Subject Line",
        html: "<p>Body</p>",
        text: "Body",
      });

      expect(mockClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user@example.com"],
          subject: "Subject Line",
          html: "<p>Body</p>",
          text: "Body",
        }),
      );
    });

    it("uses the configured fromAddress as default sender", async () => {
      await adapter.send({
        to: "user@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      });

      expect(mockClient.emails.send).toHaveBeenCalledWith(
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

      expect(mockClient.emails.send).toHaveBeenCalledWith(
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

      expect(mockClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          reply_to: "reply@example.com",
        }),
      );
    });

    it("normalizes single recipient to array", async () => {
      await adapter.send({
        to: "single@example.com",
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      });

      expect(mockClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["single@example.com"],
        }),
      );
    });

    it("passes array recipients directly", async () => {
      await adapter.send({
        to: ["a@example.com", "b@example.com"],
        subject: "Test",
        html: "<p>Hi</p>",
        text: "Hi",
      });

      expect(mockClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["a@example.com", "b@example.com"],
        }),
      );
    });
  });

  describe("error mapping", () => {
    let mockClient: ReturnType<typeof createMockResendClient>;
    let adapter: ResendEmailAdapter;

    beforeEach(() => {
      mockClient = createMockResendClient();
      adapter = ResendEmailAdapter.fromClient(mockClient, "sender@example.com");
    });

    it("maps rate_limit_exceeded to EmailRateLimitError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "rate_limit_exceeded", message: "Too many requests" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailRateLimitError);
    });

    it("maps missing_api_key to EmailConfigurationError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "missing_api_key", message: "Missing API key" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailConfigurationError);
    });

    it("maps invalid_api_Key to EmailConfigurationError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "invalid_api_Key", message: "Invalid API key" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailConfigurationError);
    });

    it("maps validation_error to InvalidRecipientError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "validation_error", message: "Invalid email" },
      });

      await expect(
        adapter.send({
          to: "bad@",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(InvalidRecipientError);
    });

    it("maps invalid_parameter to InvalidRecipientError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "invalid_parameter", message: "Invalid parameter" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(InvalidRecipientError);
    });

    it("maps missing_required_field to InvalidRecipientError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "missing_required_field", message: "Missing required field" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(InvalidRecipientError);
    });

    it("maps application_error to EmailDeliveryError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "application_error", message: "Server error" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailDeliveryError);
    });

    it("maps internal_server_error to EmailDeliveryError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "internal_server_error", message: "Internal error" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailDeliveryError);
    });

    it("maps invalid_from_address to EmailConfigurationError", async () => {
      mockClient.emails.send.mockResolvedValueOnce({
        data: null,
        error: { name: "invalid_from_address", message: "Invalid from" },
      });

      await expect(
        adapter.send({
          to: "user@example.com",
          subject: "Test",
          html: "<p>Hi</p>",
          text: "Hi",
        }),
      ).rejects.toThrow(EmailConfigurationError);
    });
  });
});
