import * as Automerge from "@automerge/automerge";

import { getEntityMap, type DocRecord } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { EncryptedChangeEnvelope } from "../types.js";

interface FriendConnectionLike {
  status: Automerge.ImmutableString;
  assignedBuckets: Record<string, true>;
  /** JSON-serialized object (e.g. `{"showMembers":true}`). Parse `.val` with JSON.parse(). */
  visibility: Automerge.ImmutableString;
}

/**
 * If status reverted to "pending" from "accepted", re-stamp "accepted".
 * Accepted connections should not revert to pending.
 * Uses JSON.parse to check visibility instead of string comparison.
 *
 * Returns the count and the correction envelope (if any mutations were applied).
 */
export function normalizeFriendConnection(session: EncryptedSyncSession<unknown>): {
  count: number;
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;

  const friendConnections = getEntityMap<FriendConnectionLike>(doc, "friendConnections");
  if (!friendConnections) return { count: 0, envelope: null };

  const toFix: string[] = [];
  for (const [connectionId, connection] of Object.entries(friendConnections)) {
    if (connection.status.val === "pending") {
      const hasAssignedBuckets = Object.keys(connection.assignedBuckets).length > 0;
      let hasVisibility = false;
      try {
        const parsed = JSON.parse(connection.visibility.val) as Record<string, unknown>;
        hasVisibility = Object.keys(parsed).length > 0;
      } catch {
        hasVisibility = false;
      }

      if (hasAssignedBuckets || hasVisibility) {
        toFix.push(connectionId);
      }
    }
  }

  if (toFix.length === 0) {
    return { count: 0, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<FriendConnectionLike>(d as DocRecord, "friendConnections");
    for (const connectionId of toFix) {
      const target = map?.[connectionId];
      if (target) {
        target.status = new Automerge.ImmutableString("accepted");
      }
    }
  });

  return { count: toFix.length, envelope };
}
