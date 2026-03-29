import nodemailer from "nodemailer";

import { DEFAULT_FROM_ADDRESS, validateSendParams } from "../../email.constants.js";
import {
  EmailConfigurationError,
  EmailDeliveryError,
  EmailRateLimitError,
  InvalidRecipientError,
} from "../../errors.js";

import type { EmailAdapter, EmailSendParams, EmailSendResult } from "../../interface.js";

/** Configuration for creating an SMTP transport. */
export interface SmtpConfig {
  /** SMTP server hostname. */
  readonly host: string;
  /** SMTP server port. */
  readonly port: number;
  /** Whether to use TLS. */
  readonly secure?: boolean;
  /** Authentication credentials. */
  readonly auth?: {
    readonly user: string;
    readonly pass: string;
  };
  /** Whether to use connection pooling. */
  readonly pool?: boolean;
  /** Maximum number of simultaneous connections (when pool is true). */
  readonly maxConnections?: number;
}

/** Mail options passed to the underlying transport's sendMail. */
interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** Result shape from a sendMail call — only the messageId is needed. */
interface SendMailResult {
  messageId?: string;
}

/**
 * Abstraction over the transport's sendMail method.
 * Allows dependency injection for testing without matching Nodemailer's full overloaded type.
 */
type SendMailFn = (options: SendMailOptions) => Promise<SendMailResult>;

/** SMTP error codes indicating a configuration or connection issue. */
const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "EAUTH", "ESOCKET", "ETLS"]);

// ── SMTP response code constants ──────────────────────────────────────
/** 550 — Requested action not taken: mailbox unavailable. */
const SMTP_MAILBOX_UNAVAILABLE = 550;
/** 551 — User not local; please try forwarding. */
const SMTP_USER_NOT_LOCAL = 551;
/** 552 — Requested mail action aborted: exceeded storage allocation. */
const SMTP_EXCEEDED_STORAGE = 552;
/** 553 — Requested action not taken: mailbox name not allowed. */
const SMTP_MAILBOX_NAME_NOT_ALLOWED = 553;
/** 554 — Transaction failed. */
const SMTP_TRANSACTION_FAILED = 554;
/** 421 — Service not available, closing transmission channel. */
const SMTP_SERVICE_NOT_AVAILABLE = 421;
/** 450 — Requested mail action not taken: mailbox unavailable (temporary). */
const SMTP_MAILBOX_BUSY = 450;
/** 451 — Requested action aborted: local error in processing. */
const SMTP_LOCAL_ERROR = 451;
/** 452 — Requested action not taken: insufficient system storage. */
const SMTP_INSUFFICIENT_STORAGE = 452;

/** SMTP response codes indicating the recipient is invalid. */
const INVALID_RECIPIENT_RESPONSE_CODES = new Set([
  SMTP_MAILBOX_UNAVAILABLE,
  SMTP_USER_NOT_LOCAL,
  SMTP_EXCEEDED_STORAGE,
  SMTP_MAILBOX_NAME_NOT_ALLOWED,
  SMTP_TRANSACTION_FAILED,
]);

/** SMTP response codes indicating rate limiting or temporary failure. */
const RATE_LIMIT_RESPONSE_CODES = new Set([
  SMTP_SERVICE_NOT_AVAILABLE,
  SMTP_MAILBOX_BUSY,
  SMTP_LOCAL_ERROR,
  SMTP_INSUFFICIENT_STORAGE,
]);

/** Discriminated init options for SmtpEmailAdapter. */
type SmtpAdapterInit =
  | { readonly kind: "config"; readonly config: SmtpConfig; readonly fromAddress?: string }
  | {
      readonly kind: "transport";
      readonly transport: { sendMail: SendMailFn };
      readonly fromAddress?: string;
    };

/**
 * Email adapter backed by SMTP via Nodemailer.
 *
 * Maps Nodemailer/SMTP errors to the package's error type hierarchy.
 */
export class SmtpEmailAdapter implements EmailAdapter {
  readonly providerName = "smtp" as const;
  private readonly sendMailFn: SendMailFn;
  private readonly fromAddress: string;

  private constructor(init: SmtpAdapterInit) {
    switch (init.kind) {
      case "config": {
        const baseOptions = {
          host: init.config.host,
          port: init.config.port,
          secure: init.config.secure,
          auth: init.config.auth,
        };

        const nodeTransport =
          init.config.pool === true
            ? nodemailer.createTransport({
                ...baseOptions,
                pool: true,
                maxConnections: init.config.maxConnections,
              })
            : nodemailer.createTransport(baseOptions);

        this.sendMailFn = async (opts) => {
          const info = await nodeTransport.sendMail(opts);
          return { messageId: info.messageId };
        };
        this.fromAddress = init.fromAddress ?? DEFAULT_FROM_ADDRESS;
        break;
      }
      case "transport":
        this.sendMailFn = (opts: SendMailOptions) => init.transport.sendMail(opts);
        this.fromAddress = init.fromAddress ?? DEFAULT_FROM_ADDRESS;
        break;
    }
  }

  /** Creates an adapter from SMTP connection configuration. */
  static create(config: SmtpConfig, fromAddress?: string): SmtpEmailAdapter {
    return new SmtpEmailAdapter({ kind: "config", config, fromAddress });
  }

  /**
   * Creates an adapter from a mock transport object.
   * Primarily used for testing with mocked transports.
   */
  static fromTransport(
    transport: { sendMail: SendMailFn },
    fromAddress?: string,
  ): SmtpEmailAdapter {
    return new SmtpEmailAdapter({ kind: "transport", transport, fromAddress });
  }

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    validateSendParams(params);
    const to = typeof params.to === "string" ? params.to : params.to.join(", ");

    try {
      const result = await this.sendMailFn({
        from: params.from ?? this.fromAddress,
        to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo !== undefined ? { replyTo: params.replyTo } : {}),
      });

      return { messageId: result.messageId ?? null };
    } catch (err: unknown) {
      throw this.mapError(
        err,
        typeof params.to === "string" ? params.to : (params.to[0] ?? "unknown"),
      );
    }
  }

  private mapError(
    err: unknown,
    recipient: string,
  ): EmailConfigurationError | EmailRateLimitError | InvalidRecipientError | EmailDeliveryError {
    const code = hasCode(err) ? err.code : undefined;
    const responseCode = hasResponseCode(err) ? err.responseCode : undefined;
    const message = err instanceof Error ? err.message : String(err);

    if (code !== undefined && CONNECTION_ERROR_CODES.has(code)) {
      return new EmailConfigurationError(message, {
        cause: err instanceof Error ? err : undefined,
      });
    }

    if (responseCode !== undefined && INVALID_RECIPIENT_RESPONSE_CODES.has(responseCode)) {
      return new InvalidRecipientError(recipient, {
        cause: err instanceof Error ? err : undefined,
      });
    }

    if (responseCode !== undefined && RATE_LIMIT_RESPONSE_CODES.has(responseCode)) {
      return new EmailRateLimitError(undefined, { cause: err instanceof Error ? err : undefined });
    }

    return new EmailDeliveryError(recipient, message, {
      cause: err instanceof Error ? err : undefined,
    });
  }
}

function hasCode(err: unknown): err is { code: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as Record<string, unknown>).code === "string"
  );
}

function hasResponseCode(err: unknown): err is { responseCode: number } {
  return (
    typeof err === "object" &&
    err !== null &&
    "responseCode" in err &&
    typeof (err as Record<string, unknown>).responseCode === "number"
  );
}
