// @pluralscape/email — platform-agnostic email sending adapter interface

// ── Interface & types ────────────────────────────────────────────────
export type { EmailAdapter, EmailSendParams, EmailSendResult } from "./interface.js";

// ── Errors ──────────────────────────────────────────────────────────
export {
  EmailDeliveryError,
  EmailConfigurationError,
  EmailRateLimitError,
  InvalidRecipientError,
} from "./errors.js";

// ── Constants ───────────────────────────────────────────────────────
export { DEFAULT_FROM_ADDRESS, MAX_RECIPIENTS, MAX_SUBJECT_LENGTH } from "./email.constants.js";

// ── Adapters ────────────────────────────────────────────────────────
export { StubEmailAdapter } from "./adapters/stub.js";
