// @pluralscape/sync — Encrypted CRDT sync over relay
export type { DocumentKeys, EncryptedChangeEnvelope, EncryptedSnapshotEnvelope } from "./types.js";

export {
  encryptChange,
  decryptChange,
  encryptSnapshot,
  decryptSnapshot,
  verifyEnvelopeSignature,
  SignatureVerificationError,
} from "./encrypted-sync.js";

export { EncryptedRelay } from "./relay.js";
export type { RelayDocumentState } from "./relay.js";

export { EncryptedSyncSession, syncThroughRelay } from "./sync-session.js";
