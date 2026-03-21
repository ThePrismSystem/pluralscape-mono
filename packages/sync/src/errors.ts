/**
 * Typed error classes for the sync package.
 *
 * Provides structured error types for protocol, adapter, and document
 * operations so callers can catch by name or instanceof.
 */
import type { ClientMessage, SyncErrorCode } from "./protocol.js";

/**
 * Thrown when the server returns a SyncError protocol message.
 * Wraps the error code and optional document ID for structured handling.
 */
export class SyncProtocolError extends Error {
  override readonly name = "SyncProtocolError" as const;
  readonly code: SyncErrorCode;
  readonly docId: string | null;

  constructor(code: SyncErrorCode, message: string, docId?: string | null, options?: ErrorOptions) {
    super(`SyncError [${code}]: ${message}`, options);
    this.code = code;
    this.docId = docId ?? null;
  }
}

/**
 * Thrown when a server response has an unexpected message type
 * (e.g. expecting SnapshotResponse but received ChangesResponse).
 */
export class UnexpectedResponseError extends Error {
  override readonly name = "UnexpectedResponseError" as const;
  readonly expectedType: string;
  readonly actualType: string;

  constructor(expectedType: string, actualType: string, options?: ErrorOptions) {
    super(`Unexpected response: expected "${expectedType}", got "${actualType}"`, options);
    this.expectedType = expectedType;
    this.actualType = actualType;
  }
}

/**
 * Thrown when a request/response pair exceeds the configured timeout.
 */
export class SyncTimeoutError extends Error {
  override readonly name = "SyncTimeoutError" as const;
  readonly messageType: ClientMessage["type"];

  constructor(messageType: ClientMessage["type"], options?: ErrorOptions) {
    super(`Request timed out: ${messageType}`, options);
    this.messageType = messageType;
  }
}

/**
 * Thrown when an operation is attempted on a disposed adapter.
 */
export class AdapterDisposedError extends Error {
  override readonly name = "AdapterDisposedError" as const;

  constructor(message = "Adapter disposed", options?: ErrorOptions) {
    super(message, options);
  }
}

/**
 * Thrown when Automerge.change produces no diff (no-op change).
 */
export class NoChangeProducedError extends Error {
  override readonly name = "NoChangeProducedError" as const;

  constructor(message = "Automerge.change produced no diff", options?: ErrorOptions) {
    super(message, options);
  }
}

/**
 * Thrown when a document type does not support an operation (e.g. time-splitting).
 */
export class UnsupportedDocumentTypeError extends Error {
  override readonly name = "UnsupportedDocumentTypeError" as const;
  readonly documentType: string;
  readonly operation: string;

  constructor(documentType: string, operation: string, options?: ErrorOptions) {
    super(`Document type "${documentType}" does not support ${operation}`, options);
    this.documentType = documentType;
    this.operation = operation;
  }
}

/**
 * Thrown when a document is not found (e.g. in relay service operations).
 */
export class DocumentNotFoundError extends Error {
  override readonly name = "DocumentNotFoundError" as const;
  readonly documentId: string;

  constructor(documentId: string, options?: ErrorOptions) {
    super(`Document not found: ${documentId}`, options);
    this.documentId = documentId;
  }
}
