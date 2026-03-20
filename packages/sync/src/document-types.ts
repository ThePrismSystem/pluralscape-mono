import type { BucketId, ChannelId, SyncDocType, SyncKeyType, SystemId } from "@pluralscape/types";

/** Parsed components of a document ID. */
export type ParsedDocumentId =
  | {
      readonly documentType: "system-core";
      readonly keyType: "derived";
      readonly entityId: SystemId;
      readonly timePeriod: null;
    }
  | {
      readonly documentType: "fronting";
      readonly keyType: "derived";
      readonly entityId: SystemId;
      readonly timePeriod: string | null;
    }
  | {
      readonly documentType: "chat";
      readonly keyType: "derived";
      readonly entityId: ChannelId;
      readonly timePeriod: string | null;
    }
  | {
      readonly documentType: "journal";
      readonly keyType: "derived";
      readonly entityId: SystemId;
      readonly timePeriod: string | null;
    }
  | {
      readonly documentType: "privacy-config";
      readonly keyType: "derived";
      readonly entityId: SystemId;
      readonly timePeriod: null;
    }
  | {
      readonly documentType: "bucket";
      readonly keyType: "bucket";
      readonly entityId: BucketId;
      readonly timePeriod: null;
    };

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

/** Multi-word prefixes checked first to avoid ambiguity. */
const PREFIX_CONFIGS = [
  {
    prefix: "system-core-",
    documentType: "system-core",
    keyType: "derived",
    timeSplitPattern: null,
  },
  {
    prefix: "privacy-config-",
    documentType: "privacy-config",
    keyType: "derived",
    timeSplitPattern: null,
  },
  {
    prefix: "fronting-",
    documentType: "fronting",
    keyType: "derived",
    timeSplitPattern: QUARTER_RE,
  },
  { prefix: "chat-", documentType: "chat", keyType: "derived", timeSplitPattern: MONTH_RE },
  { prefix: "journal-", documentType: "journal", keyType: "derived", timeSplitPattern: YEAR_RE },
  { prefix: "bucket-", documentType: "bucket", keyType: "bucket", timeSplitPattern: null },
] as const satisfies readonly {
  prefix: string;
  documentType: SyncDocType;
  keyType: SyncKeyType;
  timeSplitPattern: RegExp | null;
}[];

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

      const match = config.timeSplitPattern?.exec(rest);
      if (match?.[1]) {
        timePeriod = match[1];
        entityId = rest.slice(0, match.index);
      }

      if (entityId.length === 0) {
        throw new InvalidDocumentIdError(documentId);
      }

      if (!entityId.includes("_")) {
        throw new InvalidDocumentIdError(documentId);
      }

      switch (config.documentType) {
        case "system-core":
          return {
            documentType: "system-core",
            keyType: "derived",
            entityId: entityId as SystemId,
            timePeriod: null,
          };
        case "fronting":
          return {
            documentType: "fronting",
            keyType: "derived",
            entityId: entityId as SystemId,
            timePeriod,
          };
        case "chat":
          return {
            documentType: "chat",
            keyType: "derived",
            entityId: entityId as ChannelId,
            timePeriod,
          };
        case "journal":
          return {
            documentType: "journal",
            keyType: "derived",
            entityId: entityId as SystemId,
            timePeriod,
          };
        case "privacy-config":
          return {
            documentType: "privacy-config",
            keyType: "derived",
            entityId: entityId as SystemId,
            timePeriod: null,
          };
        case "bucket":
          return {
            documentType: "bucket",
            keyType: "bucket",
            entityId: entityId as BucketId,
            timePeriod: null,
          };
      }
    }
  }

  throw new InvalidDocumentIdError(documentId);
}
