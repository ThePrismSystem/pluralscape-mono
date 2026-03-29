import { Resend } from "resend";

import { DEFAULT_FROM_ADDRESS, validateSendParams } from "../../email.constants.js";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  EmailRateLimitError,
  InvalidRecipientError,
} from "../../errors.js";

import type { EmailAdapter, EmailSendParams, EmailSendResult } from "../../interface.js";

/** Configuration for the Resend email adapter. */
export interface ResendEmailAdapterConfig {
  /** Resend API key. */
  readonly apiKey: string;
  /** Default sender address. */
  readonly fromAddress?: string;
}

/**
 * Minimal interface for the Resend client's emails.send method.
 * Used for dependency injection in tests.
 */
interface ResendClient {
  emails: {
    send: (params: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
      reply_to?: string;
    }) => Promise<{ data: { id: string } | null; error: { name: string; message: string } | null }>;
  };
}

/** Error code names that indicate a configuration issue. */
const CONFIGURATION_ERROR_CODES = new Set([
  "missing_api_key",
  "invalid_api_Key",
  "invalid_from_address",
  "invalid_access",
  "invalid_region",
]);

/** Error code names that indicate an invalid recipient or parameter. */
const RECIPIENT_ERROR_CODES = new Set([
  "validation_error",
  "invalid_parameter",
  "missing_required_field",
]);

/**
 * Email adapter backed by the Resend API.
 *
 * Maps Resend SDK errors to the package's error type hierarchy.
 */
export class ResendEmailAdapter implements EmailAdapter {
  readonly providerName = "resend" as const;
  private readonly client: ResendClient;
  private readonly fromAddress: string;

  constructor(config: ResendEmailAdapterConfig) {
    this.client = new Resend(config.apiKey);
    this.fromAddress = config.fromAddress ?? DEFAULT_FROM_ADDRESS;
  }

  /**
   * Creates an adapter from a pre-configured client instance.
   * Primarily used for testing with mocked clients.
   */
  static fromClient(client: ResendClient, fromAddress?: string): ResendEmailAdapter {
    const adapter = Object.create(ResendEmailAdapter.prototype) as ResendEmailAdapter;
    Object.defineProperty(adapter, "providerName", { value: "resend", writable: false });
    Object.defineProperty(adapter, "client", { value: client, writable: false });
    Object.defineProperty(adapter, "fromAddress", {
      value: fromAddress ?? DEFAULT_FROM_ADDRESS,
      writable: false,
    });
    return adapter;
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    validateSendParams(params);
    const to = typeof params.to === "string" ? [params.to] : [...params.to];

    const response = await this.client.emails.send({
      from: params.from ?? this.fromAddress,
      to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo !== undefined ? { reply_to: params.replyTo } : {}),
    });

    if (response.error !== null) {
      throw this.mapError(response.error, to);
    }

    return { messageId: response.data?.id ?? null };
  }

  private mapError(
    error: { name: string; message: string },
    recipients: string[],
  ): EmailConfigurationError | EmailRateLimitError | InvalidRecipientError | EmailDeliveryError {
    const errorName = error.name;

    if (errorName === "rate_limit_exceeded") {
      return new EmailRateLimitError();
    }

    if (CONFIGURATION_ERROR_CODES.has(errorName)) {
      return new EmailConfigurationError(error.message);
    }

    if (RECIPIENT_ERROR_CODES.has(errorName)) {
      return new InvalidRecipientError(recipients[0] ?? "unknown", {
        cause: new Error(error.message),
      });
    }

    return new EmailDeliveryError(recipients[0] ?? "unknown", error.message);
  }
}
