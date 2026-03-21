/**
 * Zod schemas for all 9 client → server message types.
 *
 * These validate the JSON wire format and transform Base64url-encoded
 * binary fields to Uint8Array on parse.
 */
import { AEAD_NONCE_BYTES, SIGN_BYTES, SIGN_PUBLIC_KEY_BYTES } from "@pluralscape/crypto";
import { SYNC_PROTOCOL_VERSION } from "@pluralscape/sync";
import { z } from "zod";

import { SESSION_TOKEN_PATTERN } from "../middleware/middleware.constants.js";

import { PROFILE_TYPES } from "./connection-state.js";
import { base64urlToBytes } from "./serialization.js";
import { WS_MAX_SUBSCRIBE_DOCUMENTS } from "./ws.constants.js";

import type { AeadNonce, Signature, SignPublicKey } from "@pluralscape/crypto";
import type { ClientMessage } from "@pluralscape/sync";
import type { SyncDocumentId, SystemId } from "@pluralscape/types";
import type { ZodType } from "zod";

// ── Shared schemas ──────────────────────────────────────────────────

const correlationId = z.uuid().nullable();
const docId = z
  .string()
  .min(1)
  .transform((s): SyncDocumentId => s as SyncDocumentId);
const systemId = z
  .string()
  .min(1)
  .transform((s): SystemId => s as SystemId);

/** Pattern for valid base64url characters (RFC 4648 §5). */
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

const base64urlBytes = z
  .string()
  .min(1)
  .regex(BASE64URL_PATTERN, "Invalid base64url encoding")
  .transform(base64urlToBytes);

/** Base64url → Uint8Array with byte-length refinement for AEAD nonce (24 bytes). */
const nonceBytes = z
  .string()
  .min(1)
  .regex(BASE64URL_PATTERN, "Invalid base64url encoding")
  .transform(base64urlToBytes)
  .refine((buf) => buf.length === AEAD_NONCE_BYTES, {
    message: `Nonce must be ${String(AEAD_NONCE_BYTES)} bytes`,
  })
  .transform((buf): AeadNonce => buf as AeadNonce);

/** Base64url → Uint8Array with byte-length refinement for signature (64 bytes). */
const signatureBytes = z
  .string()
  .min(1)
  .regex(BASE64URL_PATTERN, "Invalid base64url encoding")
  .transform(base64urlToBytes)
  .refine((buf) => buf.length === SIGN_BYTES, {
    message: `Signature must be ${String(SIGN_BYTES)} bytes`,
  })
  .transform((buf): Signature => buf as Signature);

/** Base64url → Uint8Array with byte-length refinement for sign public key (32 bytes). */
const signPublicKeyBytes = z
  .string()
  .min(1)
  .regex(BASE64URL_PATTERN, "Invalid base64url encoding")
  .transform(base64urlToBytes)
  .refine((buf) => buf.length === SIGN_PUBLIC_KEY_BYTES, {
    message: `Author public key must be ${String(SIGN_PUBLIC_KEY_BYTES)} bytes`,
  })
  .transform((buf): SignPublicKey => buf as SignPublicKey);

/** Encrypted change envelope without seq (server assigns). */
const changeWithoutSeq = z.object({
  ciphertext: base64urlBytes,
  nonce: nonceBytes,
  signature: signatureBytes,
  authorPublicKey: signPublicKeyBytes,
  documentId: z
    .string()
    .min(1)
    .transform((s): SyncDocumentId => s as SyncDocumentId),
});

/** Full encrypted snapshot envelope. */
const snapshotEnvelope = z.object({
  ciphertext: base64urlBytes,
  nonce: nonceBytes,
  signature: signatureBytes,
  authorPublicKey: signPublicKeyBytes,
  documentId: z
    .string()
    .min(1)
    .transform((s): SyncDocumentId => s as SyncDocumentId),
  snapshotVersion: z.number().int().positive(),
});

/** Per-document sync position. */
const documentVersionEntry = z.object({
  docId,
  lastSyncedSeq: z.number().int().nonnegative(),
  lastSnapshotVersion: z.number().int().nonnegative(),
});

// ── Client message schemas ──────────────────────────────────────────

export const authenticateRequestSchema = z.object({
  type: z.literal("AuthenticateRequest"),
  correlationId,
  protocolVersion: z.literal(SYNC_PROTOCOL_VERSION),
  sessionToken: z.string().regex(SESSION_TOKEN_PATTERN),
  systemId,
  profileType: z.enum(PROFILE_TYPES),
});

export const manifestRequestSchema = z.object({
  type: z.literal("ManifestRequest"),
  correlationId,
  systemId,
});

export const subscribeRequestSchema = z.object({
  type: z.literal("SubscribeRequest"),
  correlationId,
  documents: z.array(documentVersionEntry).max(WS_MAX_SUBSCRIBE_DOCUMENTS),
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
} as const satisfies Record<ClientMessage["type"], ZodType>;

/** All valid client message type strings. */
export type ClientMessageType = keyof typeof CLIENT_MESSAGE_SCHEMAS;

/** Set of mutation message types (subject to mutation rate limiting). */
export const MUTATION_MESSAGE_TYPES: ReadonlySet<ClientMessageType> = new Set<ClientMessageType>([
  "SubmitChangeRequest",
  "SubmitSnapshotRequest",
]);
