/** Sync document types matching the document topology spec (Section 3). */
export type SyncDocumentType =
  | "system-core"
  | "fronting"
  | "chat"
  | "journal"
  | "privacy-config"
  | "bucket";

/** Which encryption key tier a document uses. */
export type DocumentKeyType = "master" | "bucket";

/** Parsed components of a document ID. */
export interface ParsedDocumentId {
  readonly documentType: SyncDocumentType;
  readonly keyType: DocumentKeyType;
  readonly entityId: string;
  readonly timePeriod: string | null;
}

/** Thrown when a document ID cannot be parsed. */
export class InvalidDocumentIdError extends Error {
  constructor(documentId: string) {
    super(`Invalid document ID: "${documentId}"`);
    this.name = "InvalidDocumentIdError";
  }
}

/** Quarter time-split suffix: -YYYY-Q[1-4] */
const QUARTER_RE = /-(\d{4}-Q[1-4])$/;

/** Month time-split suffix: -YYYY-MM (01-12) */
const MONTH_RE = /-(\d{4}-(?:0[1-9]|1[0-2]))$/;

/** Year time-split suffix: -YYYY */
const YEAR_RE = /-(\d{4})$/;

interface PrefixConfig {
  readonly prefix: string;
  readonly documentType: SyncDocumentType;
  readonly keyType: DocumentKeyType;
  readonly timeSplitPattern: RegExp | null;
}

/** Multi-word prefixes checked first to avoid ambiguity. */
const PREFIX_CONFIGS: readonly PrefixConfig[] = [
  {
    prefix: "system-core-",
    documentType: "system-core",
    keyType: "master",
    timeSplitPattern: null,
  },
  {
    prefix: "privacy-config-",
    documentType: "privacy-config",
    keyType: "master",
    timeSplitPattern: null,
  },
  {
    prefix: "fronting-",
    documentType: "fronting",
    keyType: "master",
    timeSplitPattern: QUARTER_RE,
  },
  { prefix: "chat-", documentType: "chat", keyType: "master", timeSplitPattern: MONTH_RE },
  { prefix: "journal-", documentType: "journal", keyType: "master", timeSplitPattern: YEAR_RE },
  { prefix: "bucket-", documentType: "bucket", keyType: "bucket", timeSplitPattern: null },
];

/**
 * Parse a document ID into its components.
 *
 * Document IDs follow the naming conventions from the document topology spec:
 * - `system-core-{systemId}`
 * - `fronting-{systemId}[-YYYY-QN]`
 * - `chat-{channelId}[-YYYY-MM]`
 * - `journal-{systemId}[-YYYY]`
 * - `privacy-config-{systemId}`
 * - `bucket-{bucketId}`
 *
 * Entity IDs use underscores (e.g., `sys_abc`), never hyphens,
 * so there is no ambiguity with the hyphen-delimited prefixes and time suffixes.
 */
export function parseDocumentId(documentId: string): ParsedDocumentId {
  for (const config of PREFIX_CONFIGS) {
    if (documentId.startsWith(config.prefix)) {
      const rest = documentId.slice(config.prefix.length);
      if (rest.length === 0) {
        throw new InvalidDocumentIdError(documentId);
      }

      let entityId = rest;
      let timePeriod: string | null = null;

      if (config.timeSplitPattern !== null) {
        const match = config.timeSplitPattern.exec(rest);
        if (match?.[1]) {
          timePeriod = match[1];
          entityId = rest.slice(0, match.index);
        }
      }

      if (entityId.length === 0) {
        throw new InvalidDocumentIdError(documentId);
      }

      return {
        documentType: config.documentType,
        keyType: config.keyType,
        entityId,
        timePeriod,
      };
    }
  }

  throw new InvalidDocumentIdError(documentId);
}
