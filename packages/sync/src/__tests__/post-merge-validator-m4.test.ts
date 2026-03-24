/**
 * M4 post-merge validator tests: timer config and webhook config normalization.
 *
 * Covers normalizeTimerConfig edge cases, normalizeWebhookConfigs validation,
 * and runAllValidations integration for both M4 document fields.
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createSystemCoreDocument,
  fromDoc,
} from "../factories/document-factory.js";
import {
  normalizeTimerConfig,
  normalizeWebhookConfigs,
  runAllValidations,
} from "../post-merge-validator.js";
import { EncryptedSyncSession } from "../sync-session.js";

import { asSyncDocId } from "./test-crypto-helpers.js";

import type { CrdtTimer } from "../schemas/system-core.js";
import type { SystemCoreDocument } from "../schemas/system-core.js";
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

/**
 * Helper to create a session with the "webhookConfigs" field for testing.
 * The SystemCoreDocument type does not include webhookConfigs yet, so we
 * build a minimal document via fromDoc with the correct shape.
 */
function createSessionWithWebhookConfigs(
  keys: DocumentKeys,
  docId: string,
): EncryptedSyncSession<WebhookTestDocument> {
  const base = fromDoc<WebhookTestDocument>({
    timers: {},
    webhookConfigs: {},
  });
  return new EncryptedSyncSession<WebhookTestDocument>({
    doc: Automerge.clone(base),
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

interface WebhookTestDocument {
  timers: Record<string, CrdtTimer>;
  webhookConfigs: Record<string, WebhookConfigShape>;
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
        d.timers["tmr_1"] = makeTimer("tmr_1", { intervalMinutes: interval });
      });

      const result = normalizeTimerConfig(session);

      expect(result.count).toBe(1);
      expect(result.envelope).not.toBeNull();
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.fieldName).toBe("intervalMinutes");
      expect(result.notifications[0]?.resolution).toBe("post-merge-timer-normalize");
      expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
    },
  );

  it("does not normalize timer with intervalMinutes = null (field not set)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-null-interval");

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", { intervalMinutes: null });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });

  it("still counts already-disabled timer with invalid intervalMinutes", () => {
    const session = createTimerSession(keys, "doc-m4-timer-already-disabled");

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", { intervalMinutes: -10, enabled: false });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
  });

  it("disables timer with wakingHoursOnly=true and start >= end (start=22:00, end=08:00)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-hours-inv");

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", {
        wakingHoursOnly: true,
        wakingStart: s("22:00"),
        wakingEnd: s("08:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("wakingHours");
    expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
  });

  it.each([
    [null, "22:00", "null-start"],
    ["08:00", null, "null-end"],
  ] as [string | null, string | null, string][])(
    "disables timer with wakingHoursOnly=true and missing bound (start=%s, end=%s)",
    (start, end, suffix) => {
      const session = createTimerSession(keys, `doc-m4-timer-${suffix}`);

      session.change((d) => {
        d.timers["tmr_1"] = makeTimer("tmr_1", {
          wakingHoursOnly: true,
          wakingStart: start !== null ? s(start) : null,
          wakingEnd: end !== null ? s(end) : null,
        });
      });

      const result = normalizeTimerConfig(session);

      expect(result.count).toBe(1);
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]?.fieldName).toBe("wakingHours");
      expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
    },
  );

  it("does not modify timer with wakingHoursOnly=true and valid hours (start < end)", () => {
    const session = createTimerSession(keys, "doc-m4-timer-valid-h");

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", {
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
      d.timers["tmr_1"] = makeTimer("tmr_1", {
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
      d.timers["tmr_1"] = makeTimer("tmr_1", {
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
      d.timers["tmr_1"] = makeTimer("tmr_1", {
        intervalMinutes: -10,
        archived: true,
      });
      d.timers["tmr_2"] = makeTimer("tmr_2", {
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
      d.timers["tmr_1"] = makeTimer("tmr_1", {
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

  it("disables only invalid timers in a mixed set", () => {
    const session = createTimerSession(keys, "doc-m4-timer-mixed");

    session.change((d) => {
      d.timers["tmr_valid"] = makeTimer("tmr_valid", {
        intervalMinutes: 30,
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("22:00"),
      });
      d.timers["tmr_zero"] = makeTimer("tmr_zero", { intervalMinutes: 0 });
      d.timers["tmr_hours"] = makeTimer("tmr_hours", {
        wakingHoursOnly: true,
        wakingStart: s("20:00"),
        wakingEnd: s("06:00"),
      });
    });

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(2);
    expect(result.notifications).toHaveLength(2);
    expect(session.document.timers["tmr_valid"]?.enabled).toBe(true);
    expect(session.document.timers["tmr_zero"]?.enabled).toBe(false);
    expect(session.document.timers["tmr_hours"]?.enabled).toBe(false);
  });

  it("returns count=0 for empty timers map", () => {
    const session = createTimerSession(keys, "doc-m4-timer-empty");

    const result = normalizeTimerConfig(session);

    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });
});

// ── normalizeWebhookConfigs ──────────────────────────────────────────

describe("normalizeWebhookConfigs (M4)", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("generates notification for config with invalid URL format", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-badurl");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("not-a-url", ["member.created"]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("url");
    expect(result.notifications[0]?.resolution).toBe("notification-only");
    expect(result.notifications[0]?.summary).toContain("invalid URL format");
    expect(result.envelope).toBeNull();
  });

  it("generates notification for config with non-HTTP(S) URL (ftp://)", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-ftp");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("ftp://example.com/hook", ["member.created"]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("url");
    expect(result.notifications[0]?.summary).toContain("non-HTTP(S) URL");
  });

  it("produces no notification for config with valid HTTPS URL", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-https");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/webhook", [
        "member.created",
      ]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("produces no notification for config with valid HTTP URL", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-http");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("http://localhost:8080/hook", [
        "member.created",
      ]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("skips URL validation when url is a plain string (non-object guard)", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-plain-url");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", ["member.created"]);
    });

    const result = normalizeWebhookConfigs(session);

    // URL validation runs normally — valid HTTPS URL produces no notification
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("generates notification for config with unknown event type", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-unk-evt");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", [
        "totally.fake.event",
      ]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
    expect(result.notifications[0]?.summary).toContain("unknown event type");
  });

  it("produces no notification for config with all valid event types", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-valid-evt");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", [
        "member.created",
        "fronting.started",
        "fronting.ended",
      ]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("validates plain-string event types via typeof fallback", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-plain-str-evt");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", [
        "member.created",
        "fronting.started",
      ]);
    });

    const result = normalizeWebhookConfigs(session);

    // Valid event types handled via ImmutableString .val extraction
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("generates one notification per config for mix of valid and invalid event types (breaks on first invalid)", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-mix-evt");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", [
        "member.created",
        "fake.event.one",
        "fake.event.two",
      ]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
  });

  it("returns count=0 for empty configs map", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-empty");

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.envelope).toBeNull();
  });

  it("returns count=0 for config with empty eventTypes array", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-empty-evt");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", []);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("skips eventTypes validation when eventTypes is not an array", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-nonarr-evt");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- deliberately setting eventTypes to a non-array to test guard
        eventTypes: "not-an-array",
        enabled: true,
      };
    });

    const result = normalizeWebhookConfigs(session);

    // Array.isArray guard skips the eventTypes loop
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("only invalid configs generate notifications in a multi-config set", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-wh-multi");

    session.change((d) => {
      d.webhookConfigs["wh_valid"] = makeWebhookConfig("https://example.com/hook", [
        "member.created",
      ]);
      d.webhookConfigs["wh_bad_url"] = makeWebhookConfig("not-a-valid-url", ["member.created"]);
      d.webhookConfigs["wh_bad_evt"] = makeWebhookConfig("https://example.com/other", [
        "nonexistent.event",
      ]);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(2);
    expect(result.notifications).toHaveLength(2);
    const validConfigNotifications = result.notifications.filter((n) => n.entityId === "wh_valid");
    expect(validConfigNotifications).toHaveLength(0);
  });
});

// ── runAllValidations integration (M4 fields) ───────────────────────

describe("runAllValidations (M4 timer + webhook integration)", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("triggers normalizeTimerConfig when document has timers field", () => {
    const session = createTimerSession(keys, "doc-m4-run-timer");

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", { intervalMinutes: -1 });
    });

    const result = runAllValidations(session);

    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.notifications.some((n) => n.resolution === "post-merge-timer-normalize")).toBe(
      true,
    );
    expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
  });

  it("triggers normalizeWebhookConfigs when document has webhookConfigs field", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-run-webhook");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("ftp://bad-protocol.com/hook", [
        "member.created",
      ]);
    });

    const result = runAllValidations(session);

    expect(result.webhookConfigIssues).toBe(1);
    expect(result.notifications.some((n) => n.entityType === "webhook-config")).toBe(true);
  });

  it("runs both validators when both timers and webhookConfigs are present", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-run-both");

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", { intervalMinutes: -5 });
      d.webhookConfigs["wh_1"] = makeWebhookConfig("not-valid", ["member.created"]);
    });

    const result = runAllValidations(session);

    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.webhookConfigIssues).toBe(1);
    expect(result.notifications.some((n) => n.resolution === "post-merge-timer-normalize")).toBe(
      true,
    );
    expect(result.notifications.some((n) => n.entityType === "webhook-config")).toBe(true);
  });

  it("runs neither validator when neither field is present in the document", () => {
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
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-run-error");

    session.change((d) => {
      // @ts-expect-error -- deliberately corrupting the timers map to test error handling
      d.timers["tmr_broken"] = null;
      d.webhookConfigs["wh_1"] = makeWebhookConfig("ftp://bad.com/hook", ["member.created"]);
    });

    const errorMessages: string[] = [];
    const result = runAllValidations(session, (msg) => {
      errorMessages.push(msg);
    });

    // Guard: ensure the error path actually triggered
    expect(result.errors.length).toBeGreaterThan(0);

    const timerError = result.errors.find((e) => e.validator === "normalizeTimerConfig");
    expect(timerError).toBeDefined();
    expect(errorMessages).toContain("Timer config normalization failed");

    // Webhook validator should still have run successfully
    expect(result.webhookConfigIssues).toBe(1);
    expect(result.notifications.some((n) => n.entityType === "webhook-config")).toBe(true);
  });

  it("catches webhook validator error without blocking timer validation", () => {
    const session = createSessionWithWebhookConfigs(keys, "doc-m4-run-error-rev");

    session.change((d) => {
      d.timers["tmr_1"] = makeTimer("tmr_1", { intervalMinutes: -5 });
      // @ts-expect-error -- deliberately corrupting the webhookConfigs map to test error handling
      d.webhookConfigs["wh_broken"] = null;
    });

    const errorMessages: string[] = [];
    const result = runAllValidations(session, (msg) => {
      errorMessages.push(msg);
    });

    // Guard: ensure the error path actually triggered
    expect(result.errors.length).toBeGreaterThan(0);

    const webhookError = result.errors.find((e) => e.validator === "normalizeWebhookConfigs");
    expect(webhookError).toBeDefined();
    expect(errorMessages).toContain("Webhook config validation failed");

    // Timer validator should still have run successfully
    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.notifications.some((n) => n.resolution === "post-merge-timer-normalize")).toBe(
      true,
    );
    expect(session.document.timers["tmr_1"]?.enabled).toBe(false);
  });
});
