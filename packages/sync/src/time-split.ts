import * as Automerge from "@automerge/automerge";

import { parseDocumentId } from "./document-types.js";
import {
  createChatDocument,
  createFrontingDocument,
  createJournalDocument,
} from "./factories/document-factory.js";
import { TIME_SPLIT_CONFIGS } from "./types.js";

import type { ParsedDocumentId, SyncDocumentType } from "./document-types.js";
import type { ChatDocument } from "./schemas/chat.js";
import type { FrontingDocument } from "./schemas/fronting.js";
import type { JournalDocument } from "./schemas/journal.js";
import type { TimeSplitUnit } from "./types.js";

/** Result of splitting a time-based document into a new period. */
export interface TimeSplitResult {
  readonly newDocId: string;
  readonly newDoc:
    | Automerge.Doc<FrontingDocument>
    | Automerge.Doc<ChatDocument>
    | Automerge.Doc<JournalDocument>;
}

/** Computes the current time period string for a given split unit. */
export function computeNextTimePeriod(splitUnit: TimeSplitUnit, nowMs?: number): string {
  const now = new Date(nowMs ?? Date.now());
  const year = now.getUTCFullYear();

  switch (splitUnit) {
    case "quarter": {
      const MONTHS_PER_QUARTER = 3;
      const quarter = Math.floor(now.getUTCMonth() / MONTHS_PER_QUARTER) + 1;
      return `${year.toString()}-Q${quarter.toString()}`;
    }
    case "month": {
      const month = now.getUTCMonth() + 1;
      return `${year.toString()}-${month.toString().padStart(2, "0")}`;
    }
    case "year":
      return year.toString();
    default: {
      const _exhaustive: never = splitUnit;
      throw new Error(`Unknown split unit: ${String(_exhaustive)}`);
    }
  }
}

/** Constructs a new document ID with a time period suffix. */
export function computeNewDocumentId(parsed: ParsedDocumentId, timePeriod: string): string {
  switch (parsed.documentType) {
    case "fronting":
      return `fronting-${parsed.entityId}-${timePeriod}`;
    case "chat":
      return `chat-${parsed.entityId}-${timePeriod}`;
    case "journal":
      return `journal-${parsed.entityId}-${timePeriod}`;
    case "system-core":
    case "privacy-config":
    case "bucket":
      throw new Error(`Document type "${parsed.documentType}" does not support time-splitting`);
    default: {
      const _exhaustive: never = parsed;
      throw new Error(`Unknown document type: ${String(_exhaustive)}`);
    }
  }
}

/** Checks whether a document has exceeded its time-split size threshold. */
export function checkTimeSplitEligibility(docId: string, currentSizeBytes: number): boolean {
  const parsed = parseDocumentId(docId);
  const config = TIME_SPLIT_CONFIGS.find((c) => c.documentType === parsed.documentType);
  if (!config) return false;
  return currentSizeBytes >= config.splitThresholdBytes;
}

const SPLITTABLE_TYPES: ReadonlySet<SyncDocumentType> = new Set(
  TIME_SPLIT_CONFIGS.map((c) => c.documentType),
);

function isFrontingDocument(doc: unknown): doc is FrontingDocument {
  return doc !== null && typeof doc === "object" && "sessions" in doc && "switches" in doc;
}

/**
 * Creates a new time-period document from an existing document.
 * For fronting documents, active sessions (endTime === null) are migrated.
 * For chat/journal, the new document starts empty.
 */
export function splitDocument<T>(
  docId: string,
  session: { readonly document: Automerge.Doc<T> },
  nowMs?: number,
): TimeSplitResult {
  const parsed = parseDocumentId(docId);
  if (!SPLITTABLE_TYPES.has(parsed.documentType)) {
    throw new Error(`Document type "${parsed.documentType}" does not support time-splitting`);
  }

  const config = TIME_SPLIT_CONFIGS.find((c) => c.documentType === parsed.documentType);
  if (!config) {
    throw new Error(`No time-split config for "${parsed.documentType}"`);
  }

  const timePeriod = computeNextTimePeriod(config.splitUnit, nowMs);
  const newDocId = computeNewDocumentId(parsed, timePeriod);

  if (parsed.documentType === "fronting") {
    const currentDoc = session.document;
    const newDoc = createFrontingDocument();

    if (isFrontingDocument(currentDoc)) {
      const activeEntries = Object.entries(currentDoc.sessions).filter(
        ([, fs]) => fs.endTime === null,
      );

      if (activeEntries.length > 0) {
        const migrated = Automerge.change(newDoc, (d) => {
          for (const [id, fs] of activeEntries) {
            d.sessions[id] = fs;
          }
        });
        return { newDocId, newDoc: migrated };
      }
    }
    return { newDocId, newDoc };
  }

  if (parsed.documentType === "chat") {
    return { newDocId, newDoc: createChatDocument() };
  }

  return { newDocId, newDoc: createJournalDocument() };
}
