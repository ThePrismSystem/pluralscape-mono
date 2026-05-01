import { parseTimeToMinutes } from "@pluralscape/validation";

import { getEntityMap, type DocRecord } from "./internal.js";

import type { EncryptedSyncSession } from "../sync-session.js";
import type { ConflictNotification, EncryptedChangeEnvelope } from "../types.js";
import type * as Automerge from "@automerge/automerge";

interface TimerConfigLike {
  intervalMinutes: number | null;
  wakingHoursOnly: boolean | null;
  wakingStart: Automerge.ImmutableString | null;
  wakingEnd: Automerge.ImmutableString | null;
  enabled: boolean;
  archived: boolean;
}

/**
 * Post-merge validation for timer configs:
 * - If wakingHoursOnly is true, wakingStart must be before wakingEnd
 * - intervalMinutes must be > 0 when set
 *
 * Violations are corrected by disabling the timer (enabled = false)
 * to prevent invalid check-in generation.
 */
export function normalizeTimerConfig(session: EncryptedSyncSession<unknown>): {
  count: number;
  notifications: ConflictNotification[];
  envelope: Omit<EncryptedChangeEnvelope, "seq"> | null;
} {
  const doc = session.document as DocRecord;
  const now = Date.now();
  const notifications: ConflictNotification[] = [];

  const timers = getEntityMap<TimerConfigLike>(doc, "timers");
  if (!timers) return { count: 0, notifications, envelope: null };

  const toDisable: string[] = [];
  for (const [timerId, timer] of Object.entries(timers)) {
    if (timer.archived) continue;

    // Check intervalMinutes > 0 when set
    if (timer.intervalMinutes !== null && timer.intervalMinutes <= 0) {
      toDisable.push(timerId);
      notifications.push({
        entityType: "timer",
        entityId: timerId,
        fieldName: "intervalMinutes",
        resolution: "post-merge-timer-normalize",
        detectedAt: now,
        summary: `Disabled timer ${timerId}: intervalMinutes must be > 0 (was ${String(timer.intervalMinutes)})`,
      });
      continue;
    }

    // Check wakingStart < wakingEnd when wakingHoursOnly is true
    if (timer.wakingHoursOnly === true) {
      const startStr = timer.wakingStart !== null ? timer.wakingStart.val : null;
      const endStr = timer.wakingEnd !== null ? timer.wakingEnd.val : null;
      const startMin = startStr !== null ? parseTimeToMinutes(startStr) : null;
      const endMin = endStr !== null ? parseTimeToMinutes(endStr) : null;

      if (startMin === null || endMin === null || startMin === endMin) {
        toDisable.push(timerId);
        notifications.push({
          entityType: "timer",
          entityId: timerId,
          fieldName: "wakingHours",
          resolution: "post-merge-timer-normalize",
          detectedAt: now,
          summary: `Disabled timer ${timerId}: invalid waking hours (start=${String(startStr)}, end=${String(endStr)})`,
        });
      }
    }
  }

  if (toDisable.length === 0) {
    return { count: 0, notifications, envelope: null };
  }

  const envelope = session.change((d) => {
    const map = getEntityMap<TimerConfigLike>(d as DocRecord, "timers");
    for (const timerId of toDisable) {
      const target = map?.[timerId];
      if (target) {
        target.enabled = false;
      }
    }
  });

  return { count: toDisable.length, notifications, envelope };
}
