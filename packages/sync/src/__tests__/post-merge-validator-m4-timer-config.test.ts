/**
 * M4 post-merge validator tests: timer config normalization.
 *
 * Covers normalizeTimerConfig edge cases (interval bounds, waking-hours
 * validity, archived skip) and runAllValidations integration paths that
 * exercise the timer validator.
 *
 * Companion file: post-merge-validator-m4-webhook-config.test.ts holds
 * normalizeWebhookConfigs tests + runAllValidations webhook integration.
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createSystemCoreDocument,
  fromDoc,
} from "../factories/document-factory.js";
import { normalizeTimerConfig, runAllValidations } from "../post-merge-validator.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { asSyncDocId, asTimerId } from "./test-crypto-helpers.js";

import type { CrdtTimer, SystemCoreDocument } from "../schemas/system-core.js";
import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

// ── helpers ──────────────────────────────────────────────────────────

const s = (val: string): Automerge.ImmutableString => new Automerge.ImmutableString(val);

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
});

function makeKeys(): DocumentKeys {
  return {
    encryptionKey: sodium.aeadKeygen(),
    signingKeys: sodium.signKeypair(),
  };
}

function makeTimer(id: string, overrides?: Partial<CrdtTimer>): CrdtTimer {
  return {
    id: s(id),
    systemId: s("sys_1"),
    intervalMinutes: 30,
    wakingHoursOnly: false,
    wakingStart: null,
    wakingEnd: null,
    promptText: s("How are you?"),
    enabled: true,
    archived: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function createTimerSession(
  keys: DocumentKeys,
  docId: string,
): EncryptedSyncSession<SystemCoreDocument> {
  return new EncryptedSyncSession<SystemCoreDocument>({
    doc: createSystemCoreDocument(),
    keys,
    documentId: asSyncDocId(docId),
    sodium,
  });
}

interface WebhookConfigShape {
  url: Automerge.ImmutableString;
  eventTypes: Automerge.ImmutableString[];
  enabled: boolean;
}
interface TimerWithWebhookDocument {
  timers: Record<string, CrdtTimer>;
  webhookConfigs: Record<string, WebhookConfigShape>;
}

/**
 * Helper to build a document carrying both timers and webhookConfigs — used
 * by the cross-validator runAllValidations test that exercises the
 * "timer error does not block webhook" path.
 */
function createTimerAndWebhookSession(
  keys: DocumentKeys,
  docId: string,
): EncryptedSyncSession<TimerWithWebhookDocument> {
  const base = fromDoc({ timers: {}, webhookConfigs: {} });
  return new EncryptedSyncSession<TimerWithWebhookDocument>({
    doc: Automerge.clone(base),
    keys,
    documentId: asSyncDocId(docId),
    sodium,
  });
}

function makeWebhookConfig(url: string, eventTypes: string[], enabled = true): WebhookConfigShape {
  return {
    url: s(url),
    eventTypes: eventTypes.map((et) => s(et)),
    enabled,
  };
}

// ── normalizeTimerConfig ─────────────────────────────────────────────

describe("normalizeTimerConfig (M4 extended coverage)", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it.each([-100, -5, 0])(
    "disables timer with intervalMinutes = %i and generates notification",
    (interval) => {
      const session = createTimerSession(keys, `doc-m4-timer-interval-${String(interval)}`);

      session.change((d) => {
        d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", { intervalMinutes: interval });
      });

      const result = normalizeTimerConfig(session);

      expect(result.count).toBe(1);
      expect(result.envelope).not.toBeNull();
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.fieldName).toBe("intervalMinutes");
      expect(result.notifications[0]?.resolution).toBe("post-merge-timer-normalize");
      expect(session.document.timers[asTimerId("tmr_1")]?.enabled).toBe(false);
    },
  );

  it("does not normalize timer with intervalMinutes = null (field not set)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-null-interval");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", { intervalMinutes: null });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });

  it("still counts already-disabled timer with invalid intervalMinutes", () => {
    const session = createTimerSession(keys, "doc-m4-timer-already-disabled");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", { intervalMinutes: -10, enabled: false });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(session.document.timers[asTimerId("tmr_1")]?.enabled).toBe(false);
  });

  it("does not disable timer with overnight waking hours (start=22:00, end=08:00)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-hours-overnight");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
        wakingHoursOnly: true,
        wakingStart: s("22:00"),
        wakingEnd: s("08:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
    expect(session.document.timers[asTimerId("tmr_1")]?.enabled).toBe(true);
  });

  it("disables timer with wakingHoursOnly=true and start equals end", () => {
    const session = createTimerSession(keys, "doc-m4-timer-hours-eq");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
        wakingHoursOnly: true,
        wakingStart: s("10:00"),
        wakingEnd: s("10:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("wakingHours");
    expect(session.document.timers[asTimerId("tmr_1")]?.enabled).toBe(false);
  });

  it.each([
    [null, "22:00", "null-start"],
    ["08:00", null, "null-end"],
  ] as [string | null, string | null, string][])(
    "disables timer with wakingHoursOnly=true and missing bound (start=%s, end=%s)",
    (start, end, suffix) => {
      const session = createTimerSession(keys, `doc-m4-timer-${suffix}`);

      session.change((d) => {
        d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
          wakingHoursOnly: true,
          wakingStart: start !== null ? s(start) : null,
          wakingEnd: end !== null ? s(end) : null,
        });
      });

      const result = normalizeTimerConfig(session);

      expect(result.count).toBe(1);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.fieldName).toBe("wakingHours");
      expect(session.document.timers[asTimerId("tmr_1")]?.enabled).toBe(false);
    },
  );

  it("does not modify timer with wakingHoursOnly=true and valid hours (start < end)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-valid-h");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("22:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });

  it("skips hours validation when wakingHoursOnly is false", () => {
    const session = createTimerSession(keys, "doc-m4-timer-wh-false");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
        wakingHoursOnly: false,
        wakingStart: s("22:00"),
        wakingEnd: s("08:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });

  it("skips hours validation when wakingHoursOnly is null", () => {
    const session = createTimerSession(keys, "doc-m4-timer-wh-null");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
        wakingHoursOnly: null,
        wakingStart: null,
        wakingEnd: null,
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
  });

  it("skips archived timers even with invalid config", () => {
    const session = createTimerSession(keys, "doc-m4-timer-arch");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
        intervalMinutes: -10,
        archived: true,
      });
      d.timers[asTimerId("tmr_2")] = makeTimer("tmr_2", {
        wakingHoursOnly: true,
        wakingStart: null,
        wakingEnd: null,
        archived: true,
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });

  it("produces no notifications for a valid timer (positive interval, valid hours)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-all-ok");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", {
        intervalMinutes: 60,
        wakingHoursOnly: true,
        wakingStart: s("09:00"),
        wakingEnd: s("21:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });

  it("disables only invalid timers in a mixed set (overnight range is valid)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-mixed");

    session.change((d) => {
      d.timers[asTimerId("tmr_valid")] = makeTimer("tmr_valid", {
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("22:00"),
      });
      d.timers[asTimerId("tmr_zero")] = makeTimer("tmr_zero", { intervalMinutes: 0 });
      d.timers[asTimerId("tmr_hours")] = makeTimer("tmr_hours", {
        wakingHoursOnly: true,
        wakingStart: s("20:00"),
        wakingEnd: s("06:00"),
      });
      d.timers[asTimerId("tmr_equal")] = makeTimer("tmr_equal", {
        wakingHoursOnly: true,
        wakingStart: s("12:00"),
        wakingEnd: s("12:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(2);
    expect(result.notifications).toHaveLength(2);
    expect(session.document.timers[asTimerId("tmr_valid")]?.enabled).toBe(true);
    expect(session.document.timers[asTimerId("tmr_zero")]?.enabled).toBe(false);
    expect(session.document.timers[asTimerId("tmr_hours")]?.enabled).toBe(true);
    expect(session.document.timers[asTimerId("tmr_equal")]?.enabled).toBe(false);
  });

  it("returns count=0 for empty timers map", () => {
    const session = createTimerSession(keys, "doc-m4-timer-empty");

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });
});

// ── runAllValidations integration: timer paths ───────────────────────

describe("runAllValidations (M4 timer integration)", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("triggers normalizeTimerConfig when document has timers field", () => {
    const session = createTimerSession(keys, "doc-m4-run-timer");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", { intervalMinutes: -1 });
    });

    const result = runAllValidations(session);

    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.notifications.some((n) => n.resolution === "post-merge-timer-normalize")).toBe(
      true,
    );
    expect(session.document.timers[asTimerId("tmr_1")]?.enabled).toBe(false);
  });

  it("runs neither validator when neither field is present in the document", () => {
    // Cross-coverage: also implicitly tests the no-webhookConfigs branch.
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-m4-run-neither"),
      sodium,
    });

    const result = runAllValidations(session);

    expect(result.timerConfigNormalizations).toBe(0);
    expect(result.webhookConfigIssues).toBe(0);
  });

  it("catches timer validator error without blocking webhook validation", () => {
    // Cross-coverage: this exercises both validators — the timer-error path
    // is the test focus; the webhook validator runs as the success companion.
    const session = createTimerAndWebhookSession(keys, "doc-m4-run-error");

    session.change((d) => {
      // @ts-expect-error -- deliberately corrupting the timers map to test error handling
      d.timers[asTimerId("tmr_broken")] = null;
      d.webhookConfigs["wh_1"] = makeWebhookConfig("ftp://bad.com/hook", ["member.created"]);
    });

    const errorMessages: string[] = [];
    const result = runAllValidations(session, (msg) => {
      errorMessages.push(msg);
    });

    // Guard: ensure the error path actually triggered
    expect(result.errors.length).toBeGreaterThan(0);

    const timerError = result.errors.find((e) => e.validator === "normalizeTimerConfig");
    expect(timerError?.validator).toBe("normalizeTimerConfig");
    expect(errorMessages).toContain("Timer config normalization failed");

    // Webhook validator should still have run successfully
    expect(result.webhookConfigIssues).toBe(1);
    expect(result.notifications.some((n) => n.entityType === "webhook-config")).toBe(true);
  });
});
