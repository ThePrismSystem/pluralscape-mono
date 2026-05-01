import * as Automerge from "@automerge/automerge";

import { getEntityMap, type DocRecord } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { EncryptedChangeEnvelope } from "../types.js";

interface CheckInLike {
  respondedByMemberId: Automerge.ImmutableString | null;
  dismissed: boolean;
}

/**
 * If respondedByMemberId is set AND dismissed is true, re-apply dismissed = false.
 * Response takes priority over dismissal.
 *
 * Returns the count and the correction envelope (if any mutations were applied).
 */
export function normalizeCheckInRecord(session: EncryptedSyncSession<unknown>): {
  count: number;
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;

  const checkInRecords = getEntityMap<CheckInLike>(doc, "checkInRecords");
  if (!checkInRecords) return { count: 0, envelope: null };

  const toFix: string[] = [];
  for (const [recordId, record] of Object.entries(checkInRecords)) {
    if (record.respondedByMemberId !== null && record.dismissed) {
      toFix.push(recordId);
    }
  }

  if (toFix.length === 0) {
    return { count: 0, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<CheckInLike>(d as DocRecord, "checkInRecords");
    for (const recordId of toFix) {
      const target = map?.[recordId];
      if (target) {
        target.dismissed = false;
      }
    }
  });

  return { count: toFix.length, envelope };
}
