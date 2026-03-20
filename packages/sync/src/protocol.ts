import type { SyncManifest } from "./adapters/network-adapter.js";
import type { EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";

// ── Protocol version ──────────────────────────────────────────────────

/** Current sync protocol version. Declared in AuthenticateRequest. */
export const SYNC_PROTOCOL_VERSION = 1;

// ── Transport ─────────────────────────────────────────────────────────

/** Connection state of a sync transport. */
export type TransportState = "connecting" | "connected" | "disconnecting" | "disconnected";

/**
 * Transport interface for sending and receiving sync protocol messages.
 * Adapts a concrete channel (WebSocket, HTTP long-polling, peer-to-peer) to
 * the protocol layer. All protocol logic lives above this interface.
 */
export interface SyncTransport {
  readonly state: TransportState;
  /** Send a client-originated message to the server. */
  send(message: ClientMessage): Promise<void>;
  /** Register a handler for all server-originated messages. */
  onMessage(handler: (message: ServerMessage) => void): void;
  /** Close the transport connection. */
  close(): void;
  /** Register a handler for transport close events. */
  onClose?(handler: (reason?: string) => void): void;
  /** Register a handler for transport error events. */
  onError?(handler: (error: Error) => void): void;
}

// ── Base ─────────────────────────────────────────────────────────────

/**
 * Common fields shared by every sync protocol message.
 */
export interface SyncMessageBase {
  /** Discriminant field identifying the message type. */
  readonly type: string;
  /**
   * Client-generated UUID correlating a request with its response.
   * The server echoes correlationId on all direct responses.
   * Server-pushed messages (DocumentUpdate, ManifestChanged) set this to null.
   */
  readonly correlationId: string | null;
}

// ── Supporting types ──────────────────────────────────────────────────

/**
 * The client's local sync position for a single document.
 * Sent in SubscribeRequest so the server can compute catch-up data.
 */
export interface DocumentVersionEntry {
  readonly docId: string;
  /** Highest change seq the client has applied locally. 0 = no changes applied. */
  readonly lastSyncedSeq: number;
  /** Snapshot version the client bootstrapped from. 0 = no snapshot loaded. */
  readonly lastSnapshotVersion: number;
}

/**
 * Catch-up data for a single document returned in SubscribeResponse.
 * Omitted for documents where the client is already current.
 */
export interface DocumentCatchup {
  readonly docId: string;
  /** Changes the client is missing, in ascending seq order. */
  readonly changes: readonly EncryptedChangeEnvelope[];
  /**
   * Present only when the server holds a newer snapshot than the client.
   * Client should bootstrap from the snapshot, then apply the provided changes.
   */
  readonly snapshot: EncryptedSnapshotEnvelope | null;
}

/** Error codes returned in SyncError messages. */
export type SyncErrorCode =
  | "AUTH_FAILED" // Bad or missing session token
  | "AUTH_EXPIRED" // Session token has expired; re-authenticate
  | "PERMISSION_DENIED" // Access to document or system not granted
  | "DOCUMENT_NOT_FOUND" // Requested docId not in manifest
  | "DOCUMENT_LOAD_DENIED" // On-demand load denied (access check failed or doc not loadable)
  | "SNAPSHOT_NOT_FOUND" // No snapshot exists for the requested document
  | "VERSION_CONFLICT" // SnapshotVersion not strictly increasing
  | "MALFORMED_MESSAGE" // Message failed schema validation or size limit
  | "QUOTA_EXCEEDED" // Storage budget exceeded (see document-lifecycle.md §6)
  | "RATE_LIMITED" // Submitting changes too rapidly
  | "PROTOCOL_MISMATCH" // Client protocolVersion != SYNC_PROTOCOL_VERSION
  | "INTERNAL_ERROR"; // Server-side error; retry after backoff

// ── Client → Server messages ──────────────────────────────────────────

/**
 * First message in every session. Must be sent before any other message.
 * Server responds with AuthenticateResponse or SyncError { code: "AUTH_FAILED" }.
 */
export interface AuthenticateRequest extends SyncMessageBase {
  readonly type: "AuthenticateRequest";
  /** Must equal SYNC_PROTOCOL_VERSION. Mismatch produces PROTOCOL_MISMATCH error. */
  readonly protocolVersion: typeof SYNC_PROTOCOL_VERSION;
  /**
   * Session token obtained from the auth service.
   * @security Must be transmitted over TLS. Never log or persist session tokens in plaintext.
   */
  readonly sessionToken: string;
  /** The system ID this client belongs to. */
  readonly systemId: string;
  /** Replication profile the client intends to use for this session. */
  readonly profileType: "owner-full" | "owner-lite" | "friend";
}

/**
 * Requests the current filtered manifest for a system.
 * Must be sent after a successful AuthenticateResponse.
 * Server responds with ManifestResponse.
 */
export interface ManifestRequest extends SyncMessageBase {
  readonly type: "ManifestRequest";
  readonly systemId: string;
}

/**
 * Declares the client's local sync positions and requests subscriptions.
 * Server responds with SubscribeResponse containing catch-up data.
 * Must be sent after a ManifestResponse.
 */
export interface SubscribeRequest extends SyncMessageBase {
  readonly type: "SubscribeRequest";
  /** Per-document positions; server computes catch-up relative to these. */
  readonly documents: readonly DocumentVersionEntry[];
}

/**
 * Cancels real-time subscription for a single document.
 * After this, the client will no longer receive DocumentUpdate pushes for docId.
 * Idempotent — unsubscribing a non-subscribed document is a no-op.
 */
export interface UnsubscribeRequest extends SyncMessageBase {
  readonly type: "UnsubscribeRequest";
  readonly docId: string;
}

/**
 * Requests the latest encrypted snapshot for a document.
 * Server responds with SnapshotResponse.
 */
export interface FetchSnapshotRequest extends SyncMessageBase {
  readonly type: "FetchSnapshotRequest";
  readonly docId: string;
}

/**
 * Requests all encrypted changes for a document with seq > sinceSeq.
 * Server responds with ChangesResponse.
 */
export interface FetchChangesRequest extends SyncMessageBase {
  readonly type: "FetchChangesRequest";
  readonly docId: string;
  /** Server returns changes with seq strictly greater than this value. */
  readonly sinceSeq: number;
  /** Maximum number of changes to return. Server may return fewer. */
  readonly limit?: number;
}

/**
 * Submits a new encrypted change to the server.
 * Server assigns a monotonically increasing seq and responds with ChangeAccepted.
 * Idempotent: the server deduplicates by (docId, authorPublicKey, nonce).
 */
export interface SubmitChangeRequest extends SyncMessageBase {
  readonly type: "SubmitChangeRequest";
  readonly docId: string;
  /** Change without seq — the server assigns seq on acceptance. */
  readonly change: Omit<EncryptedChangeEnvelope, "seq">;
}

/**
 * Submits a new encrypted snapshot (compaction result) for a document.
 * Server validates that snapshotVersion strictly exceeds the current value.
 * Responds with SnapshotAccepted on success or VERSION_CONFLICT on concurrent conflict.
 */
export interface SubmitSnapshotRequest extends SyncMessageBase {
  readonly type: "SubmitSnapshotRequest";
  readonly docId: string;
  readonly snapshot: EncryptedSnapshotEnvelope;
}

/**
 * Requests a non-subscribed document (on-demand load).
 * Used for historical periods, lite-profile journal access, and similar.
 * Server performs an access check identical to subscription rules.
 * Server responds with SnapshotResponse + ChangesResponse, or SyncError on denial.
 */
export interface DocumentLoadRequest extends SyncMessageBase {
  readonly type: "DocumentLoadRequest";
  readonly docId: string;
  /**
   * Whether the client intends to persist this document locally.
   * Informational — does not affect server behavior or access checks.
   */
  readonly persist: boolean;
}

// ── Server → Client messages ──────────────────────────────────────────

/**
 * Confirms session establishment. Sent in response to AuthenticateRequest.
 */
export interface AuthenticateResponse extends SyncMessageBase {
  readonly type: "AuthenticateResponse";
  /** Server-assigned identifier for this sync session (connection-scoped). */
  readonly syncSessionId: string;
  /** Current server time in UTC milliseconds (for client clock alignment). */
  readonly serverTime: number;
}

/**
 * Returns the filtered sync manifest. Sent in response to ManifestRequest.
 * Owner clients receive the full manifest; friend clients receive a server-filtered
 * manifest containing only bucket documents with active KeyGrants.
 */
export interface ManifestResponse extends SyncMessageBase {
  readonly type: "ManifestResponse";
  readonly manifest: SyncManifest;
}

/**
 * Confirms subscriptions and provides catch-up data per document.
 * Sent in response to SubscribeRequest.
 */
export interface SubscribeResponse extends SyncMessageBase {
  readonly type: "SubscribeResponse";
  /**
   * Catch-up entries for documents where the client was behind.
   * Omitted for documents already current at the client's lastSyncedSeq.
   */
  readonly catchup: readonly DocumentCatchup[];
  /** Document IDs that were dropped because the subscription cap was reached. */
  readonly droppedDocIds: readonly string[];
}

/**
 * Server-pushed message delivering new encrypted changes to a subscribed document.
 * Sent to all clients subscribed to docId whenever a new change is accepted.
 * correlationId is always null — this is server-initiated.
 */
export interface DocumentUpdate extends SyncMessageBase {
  readonly type: "DocumentUpdate";
  readonly correlationId: null;
  readonly docId: string;
  /** One or more new changes, in ascending seq order. */
  readonly changes: readonly EncryptedChangeEnvelope[];
}

/**
 * Returns the latest encrypted snapshot. Sent in response to FetchSnapshotRequest.
 */
export interface SnapshotResponse extends SyncMessageBase {
  readonly type: "SnapshotResponse";
  readonly docId: string;
  /** Null if no snapshot has been submitted for this document yet. */
  readonly snapshot: EncryptedSnapshotEnvelope | null;
}

/**
 * Returns encrypted changes since a seq. Sent in response to FetchChangesRequest.
 */
export interface ChangesResponse extends SyncMessageBase {
  readonly type: "ChangesResponse";
  readonly docId: string;
  readonly changes: readonly EncryptedChangeEnvelope[];
}

/**
 * Confirms server acceptance of a submitted change.
 * Sent in response to SubmitChangeRequest.
 */
export interface ChangeAccepted extends SyncMessageBase {
  readonly type: "ChangeAccepted";
  readonly docId: string;
  /** Server-assigned seq for the accepted change. */
  readonly assignedSeq: number;
}

/**
 * Confirms server acceptance of a submitted snapshot.
 * Sent in response to SubmitSnapshotRequest.
 */
export interface SnapshotAccepted extends SyncMessageBase {
  readonly type: "SnapshotAccepted";
  readonly docId: string;
  readonly snapshotVersion: number;
}

/**
 * Server-pushed notification that the manifest has changed.
 * The client MUST re-fetch the full manifest to get accurate state.
 * correlationId is always null — this is server-initiated.
 */
export interface ManifestChanged extends SyncMessageBase {
  readonly type: "ManifestChanged";
  readonly correlationId: null;
  readonly systemId: string;
  /**
   * Optional hint about what changed (e.g., a new docId or a revoked grant).
   * Informational only — the client must re-fetch the manifest regardless.
   */
  readonly hint: string | null;
}

/**
 * Error response. May be sent in response to any client message, or unsolicited
 * (e.g., AUTH_EXPIRED when session expires mid-connection).
 */
export interface SyncError extends SyncMessageBase {
  readonly type: "SyncError";
  readonly code: SyncErrorCode;
  readonly message: string;
  /** Present when the error is scoped to a specific document. */
  readonly docId: string | null;
}

// ── Message unions ────────────────────────────────────────────────────

/** All messages that can be sent from client to server. */
export type ClientMessage =
  | AuthenticateRequest
  | ManifestRequest
  | SubscribeRequest
  | UnsubscribeRequest
  | FetchSnapshotRequest
  | FetchChangesRequest
  | SubmitChangeRequest
  | SubmitSnapshotRequest
  | DocumentLoadRequest;

/** All messages that can be sent from server to client. */
export type ServerMessage =
  | AuthenticateResponse
  | ManifestResponse
  | SubscribeResponse
  | DocumentUpdate
  | SnapshotResponse
  | ChangesResponse
  | ChangeAccepted
  | SnapshotAccepted
  | ManifestChanged
  | SyncError;

/** Union of all sync protocol messages. */
export type SyncMessage = ClientMessage | ServerMessage;
