import * as Automerge from "@automerge/automerge";

import { parseDocumentId } from "./document-types.js";
import { UnsupportedDocumentTypeError } from "./errors.js";
import {
  createChatDocument,
  createFrontingDocument,
  createJournalDocument,
  createNoteDocument,
} from "./factories/document-factory.js";
import { TIME_SPLIT_CONFIGS } from "./types.js";

import type { ParsedDocumentId } from "./document-types.js";
import type { ChatDocument } from "./schemas/chat.js";
import type { FrontingDocument } from "./schemas/fronting.js";
import type { JournalDocument } from "./schemas/journal.js";
import type { NoteDocument } from "./schemas/notes.js";
import type { TimeSplitConfig, TimeSplitUnit } from "./types.js";

/** Result of splitting a time-based document into a new period. */
export type TimeSplitResult =
  | {
      readonly documentType: "fronting";
      readonly newDocId: string;
      readonly newDoc: Automerge.Doc<FrontingDocument>;
    }
  | {
      readonly documentType: "chat";
      readonly newDocId: string;
      readonly newDoc: Automerge.Doc<ChatDocument>;
    }
  | {
      readonly documentType: "journal";
      readonly newDocId: string;
      readonly newDoc: Automerge.Doc<JournalDocument>;
    }
  | {
      readonly documentType: "note";
      readonly newDocId: string;
      readonly newDoc: Automerge.Doc<NoteDocument>;
    };

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
    case "note":
      return `note-${parsed.entityId}-${timePeriod}`;
    case "system-core":
    case "privacy-config":
    case "bucket":
      throw new UnsupportedDocumentTypeError(parsed.documentType, "time-splitting");
    default: {
      const _exhaustive: never = parsed;
      throw new Error(`Unknown document type: ${String(_exhaustive)}`);
    }
  }
}

/** Resolves a docId to its parsed form and time-split config, or null if not splittable. */
function resolveTimeSplitConfig(
  docId: string,
): { parsed: ParsedDocumentId; config: TimeSplitConfig } | null {
  const parsed = parseDocumentId(docId);
  const config = TIME_SPLIT_CONFIGS.find((c) => c.documentType === parsed.documentType);
  if (!config) return null;
  return { parsed, config };
}

/** Checks whether a document has exceeded its time-split size threshold. */
export function checkTimeSplitEligibility(docId: string, currentSizeBytes: number): boolean {
  const resolved = resolveTimeSplitConfig(docId);
  if (!resolved) return false;
  return currentSizeBytes >= resolved.config.splitThresholdBytes;
}

function isFrontingDocument(doc: unknown): doc is FrontingDocument {
  return (
    doc !== null &&
    typeof doc === "object" &&
    "sessions" in doc &&
    "comments" in doc &&
    "checkInRecords" in doc
  );
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
  const resolved = resolveTimeSplitConfig(docId);
  if (!resolved) {
    const parsed = parseDocumentId(docId);
    throw new UnsupportedDocumentTypeError(parsed.documentType, "time-splitting");
  }

  const { parsed, config } = resolved;
  const timePeriod = computeNextTimePeriod(config.splitUnit, nowMs);
  const newDocId = computeNewDocumentId(parsed, timePeriod);

  switch (parsed.documentType) {
    case "fronting": {
      const currentDoc = session.document;
      if (!isFrontingDocument(currentDoc)) {
        throw new Error(`Document "${docId}" does not match expected FrontingDocument shape`);
      }

      const newDoc = createFrontingDocument();
      const activeEntries = Object.entries(currentDoc.sessions).filter(
        ([, fs]) => fs.endTime === null,
      );

      if (activeEntries.length > 0) {
        const migrated = Automerge.change(newDoc, (d) => {
          for (const [id, fs] of activeEntries) {
            d.sessions[id] = fs;
          }
        });
        return { documentType: "fronting", newDocId, newDoc: migrated };
      }
      return { documentType: "fronting", newDocId, newDoc };
    }
    case "chat":
      return { documentType: "chat", newDocId, newDoc: createChatDocument() };
    case "note":
      return { documentType: "note", newDocId, newDoc: createNoteDocument() };
    case "journal":
      return { documentType: "journal", newDocId, newDoc: createJournalDocument() };
    case "system-core":
    case "privacy-config":
    case "bucket":
      throw new UnsupportedDocumentTypeError(parsed.documentType, "time-splitting");
    default: {
      const _exhaustive: never = parsed;
      throw new Error(`Unhandled document type in splitDocument: ${String(_exhaustive)}`);
    }
  }
}
