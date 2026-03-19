/**
 * Zod schemas for all 9 client → server message types.
 *
 * These validate the JSON wire format and transform Base64url-encoded
 * binary fields to Uint8Array on parse.
 */
import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { z } from "zod";

import { SESSION_TOKEN_PATTERN } from "../middleware/middleware.constants.js";

import { base64urlToBytes } from "./serialization.js";

// ── Shared schemas ──────────────────────────────────────────────────

const correlationId = z.uuid().nullable();
const docId = z.string().min(1);
const base64urlBytes = z.string().min(1).transform(base64urlToBytes);

/** Encrypted change envelope without seq (server assigns). */
const changeWithoutSeq = z.object({
  ciphertext: base64urlBytes,
  nonce: base64urlBytes,
  signature: base64urlBytes,
  authorPublicKey: base64urlBytes,
  documentId: z.string().min(1),
});

/** Full encrypted snapshot envelope. */
const snapshotEnvelope = z.object({
  ciphertext: base64urlBytes,
  nonce: base64urlBytes,
  signature: base64urlBytes,
  authorPublicKey: base64urlBytes,
  documentId: z.string().min(1),
  snapshotVersion: z.number().int().positive(),
});

/** Per-document sync position. */
const documentVersionEntry = z.object({
  docId: z.string().min(1),
  lastSyncedSeq: z.number().int().nonnegative(),
  lastSnapshotVersion: z.number().int().nonnegative(),
});

// ── Client message schemas ──────────────────────────────────────────

export const authenticateRequestSchema = z.object({
  type: z.literal("AuthenticateRequest"),
  correlationId,
  protocolVersion: z.literal(SYNC_PROTOCOL_VERSION),
  sessionToken: z.string().regex(SESSION_TOKEN_PATTERN),
  systemId: z.string().min(1),
  profileType: z.enum(["owner-full", "owner-lite", "friend"]),
});

export const manifestRequestSchema = z.object({
  type: z.literal("ManifestRequest"),
  correlationId,
  systemId: z.string().min(1),
});

export const subscribeRequestSchema = z.object({
  type: z.literal("SubscribeRequest"),
  correlationId,
  documents: z.array(documentVersionEntry),
});

export const unsubscribeRequestSchema = z.object({
  type: z.literal("UnsubscribeRequest"),
  correlationId,
  docId,
});

export const fetchSnapshotRequestSchema = z.object({
  type: z.literal("FetchSnapshotRequest"),
  correlationId,
  docId,
});

export const fetchChangesRequestSchema = z.object({
  type: z.literal("FetchChangesRequest"),
  correlationId,
  docId,
  sinceSeq: z.number().int().nonnegative(),
});

export const submitChangeRequestSchema = z.object({
  type: z.literal("SubmitChangeRequest"),
  correlationId,
  docId,
  change: changeWithoutSeq,
});

export const submitSnapshotRequestSchema = z.object({
  type: z.literal("SubmitSnapshotRequest"),
  correlationId,
  docId,
  snapshot: snapshotEnvelope,
});

export const documentLoadRequestSchema = z.object({
  type: z.literal("DocumentLoadRequest"),
  correlationId,
  docId,
  persist: z.boolean(),
});

// ── Discriminated union ─────────────────────────────────────────────

/** Schema map keyed by message type for lookup in the router. */
export const CLIENT_MESSAGE_SCHEMAS = {
  AuthenticateRequest: authenticateRequestSchema,
  ManifestRequest: manifestRequestSchema,
  SubscribeRequest: subscribeRequestSchema,
  UnsubscribeRequest: unsubscribeRequestSchema,
  FetchSnapshotRequest: fetchSnapshotRequestSchema,
  FetchChangesRequest: fetchChangesRequestSchema,
  SubmitChangeRequest: submitChangeRequestSchema,
  SubmitSnapshotRequest: submitSnapshotRequestSchema,
  DocumentLoadRequest: documentLoadRequestSchema,
} as const;

/** All valid client message type strings. */
export type ClientMessageType = keyof typeof CLIENT_MESSAGE_SCHEMAS;

/** Set of mutation message types (subject to mutation rate limiting). */
export const MUTATION_MESSAGE_TYPES: ReadonlySet<ClientMessageType> = new Set<ClientMessageType>([
  "SubmitChangeRequest",
  "SubmitSnapshotRequest",
]);
