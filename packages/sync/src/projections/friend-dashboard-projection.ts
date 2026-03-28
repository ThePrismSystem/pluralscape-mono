import type { CrdtDashboardSnapshot } from "../schemas/bucket.js";
import type { BucketProjectionDocument } from "../schemas/bucket.js";
import type { FriendDashboardResponse } from "@pluralscape/types";

/**
 * Project a FriendDashboardResponse into the CRDT dashboard snapshot format.
 *
 * The snapshot contains summary metrics (member count, co-fronting status,
 * active session count) that the friend client can display offline.
 * Full entity data is already in the bucket document's other fields.
 */
export function projectDashboardSnapshot(
  dashboard: FriendDashboardResponse,
): CrdtDashboardSnapshot {
  return {
    memberCount: dashboard.memberCount,
    isCofronting: dashboard.activeFronting.isCofronting,
    activeSessionCount: dashboard.activeFronting.sessions.length,
    lastUpdatedAt: Date.now(),
  };
}

/**
 * Apply a dashboard snapshot projection to a BucketProjectionDocument.
 *
 * Must be called inside an Automerge.change() block.
 */
export function applyDashboardSnapshotProjection(
  doc: BucketProjectionDocument,
  dashboard: FriendDashboardResponse,
): void {
  doc.dashboardSnapshot = projectDashboardSnapshot(dashboard);
}
