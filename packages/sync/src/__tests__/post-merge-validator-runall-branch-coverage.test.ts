/**
 * Post-merge validator — timer/webhook config branch-coverage tests.
 *
 * These tests target uncovered branches in normalizeTimerConfig and
 * normalizeWebhookConfigs that span runtime-shape edge cases (corrupt CRDT
 * merge state, plain-string vs ImmutableString serialisation differences).
 * Distinct from the m4 file (post-merge-validator-m4.test.ts), which holds
 * the primary timer/webhook normalization happy paths.
 *
 * Covers:
 *   - normalizeTimerConfig: zero/negative interval, missing waking bound,
 *     archived skip, valid no-op, no-timers-field early return
 *   - normalizeWebhookConfigs: plain-string url, null/boolean/number eventType,
 *     non-HTTP protocol, malformed URL, object-without-val eventType,
 *     no-webhookConfigs-field early return
 */
import * as Automerge from "@automerge/automerge";
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createFrontingDocument,
  createPrivacyConfigDocument,
  createSystemCoreDocument,
} from "../factories/document-factory.js";
import { EncryptedSyncSession } from "../sync-session.js";
import { normalizeTimerConfig } from "../validators/timer-config.js";
import { normalizeWebhookConfigs } from "../validators/webhook-config.js";

import {
  makeKeys,
  makeTimer,
  makeWebhookSession,
  s,
  setSodium,
} from "./helpers/validator-fixtures.js";
import { asSyncDocId, asTimerId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;
let keys: DocumentKeys;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── normalizeTimerConfig: edge case branches ──────────────────────────

describe("normalizeTimerConfig: edge case branches", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("returns count=0 when document has no timers field", () => {
    const base = createFrontingDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-no-field"),
      sodium,
    });
    const result = normalizeTimerConfig(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(0);
    expect(result.envelope).toBeNull();
    expect(result.notifications).toHaveLength(0);
  });

  it("disables timer when intervalMinutes is 0", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-zero-interval"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_zero")] = makeTimer("tmr_zero", { intervalMinutes: 0 });
    });
    const { count, notifications } = normalizeTimerConfig(session);
    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_zero")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("intervalMinutes");
    expect(notifications[0]?.summary).toContain("0");
  });

  it("disables timer when intervalMinutes is negative", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-neg-interval"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_neg")] = makeTimer("tmr_neg", { intervalMinutes: -10 });
    });
    const { count, notifications } = normalizeTimerConfig(session);
    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_neg")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("intervalMinutes");
  });

  it("disables timer when wakingStart equals wakingEnd (same time)", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-same-waking"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_same")] = makeTimer("tmr_same", {
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("08:00"),
      });
    });
    const { count, notifications } = normalizeTimerConfig(session);
    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_same")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
    expect(notifications[0]?.summary).toContain("08:00");
  });

  it("disables timer when wakingHoursOnly is true but wakingStart is null", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-null-start"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_nullstart")] = makeTimer("tmr_nullstart", {
        wakingHoursOnly: true,
        wakingStart: null,
        wakingEnd: s("22:00"),
      });
    });
    const { count, notifications } = normalizeTimerConfig(session);
    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_nullstart")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
    expect(notifications[0]?.summary).toContain("null");
  });

  it("disables timer when wakingHoursOnly is true but wakingEnd is null", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-null-end"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_nullend")] = makeTimer("tmr_nullend", {
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: null,
      });
    });
    const { count, notifications } = normalizeTimerConfig(session);
    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_nullend")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
  });

  it("disables timer when wakingHoursOnly is true but both start and end are null", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-both-null"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_bothnull")] = makeTimer("tmr_bothnull", {
        wakingHoursOnly: true,
        wakingStart: null,
        wakingEnd: null,
      });
    });
    const { count, notifications } = normalizeTimerConfig(session);
    expect(count).toBe(1);
    expect(session.document.timers[asTimerId("tmr_bothnull")]?.enabled).toBe(false);
    expect(notifications[0]?.fieldName).toBe("wakingHours");
  });

  it("skips archived timers even if they have invalid intervalMinutes", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-archived-skip"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_arch")] = makeTimer("tmr_arch", {
        intervalMinutes: -5,
        archived: true,
      });
    });
    const { count, notifications } = normalizeTimerConfig(session);
    expect(count).toBe(0);
    expect(notifications).toHaveLength(0);
  });

  it("does not disable a valid timer (positive interval, valid waking hours)", () => {
    const base = createSystemCoreDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-timer-valid"),
      sodium,
    });
    session.change((d) => {
      d.timers[asTimerId("tmr_ok")] = makeTimer("tmr_ok", {
        intervalMinutes: 60,
        wakingHoursOnly: true,
        wakingStart: s("08:00"),
        wakingEnd: s("22:00"),
      });
    });
    const { count, envelope } = normalizeTimerConfig(session);
    expect(count).toBe(0);
    expect(envelope).toBeNull();
    expect(session.document.timers[asTimerId("tmr_ok")]?.enabled).toBe(true);
  });
});

// ── normalizeWebhookConfigs: branch coverage ──────────────────────────

describe("normalizeWebhookConfigs: additional branch coverage", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("skips URL check when config url field is not an object (urlVal=null branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-url-null");
    session.change((d) => {
      d.webhookConfigs["wh_noobj"] = {
        // @ts-expect-error -- testing non-object url to hit urlVal=null branch
        url: "https://example.com/hook",
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("generates notification for null event type value (typeof check returns null branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-null-evttype");
    session.change((d) => {
      d.webhookConfigs["wh_nullevt"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- null eventType to hit the val=null → invalid path
        eventTypes: [null],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
  });

  it("validates plain string event types (typeof eventType === string branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-str-evt-valid");
    session.change((d) => {
      d.webhookConfigs["wh_strvalid"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- plain string eventType to hit typeof === string branch
        eventTypes: ["member.created"],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("generates notification for invalid plain string event type (typeof string, bad value)", () => {
    const session = makeWebhookSession(keys, "doc-wh-str-evt-bad");
    session.change((d) => {
      d.webhookConfigs["wh_strbad"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- plain string eventType to hit typeof === string bad-value path
        eventTypes: ["completely.unknown.event"],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
  });
});

// ── normalizeWebhookConfigs: object/number/protocol edge cases ─────────

describe("normalizeWebhookConfigs: object/number eventType and protocol edge cases", () => {
  beforeEach(() => {
    keys = makeKeys();
  });

  it("generates notification for non-string non-object eventType (number hits null branch)", () => {
    const session = makeWebhookSession(keys, "doc-wh-num-evttype");
    session.change((d) => {
      d.webhookConfigs["wh_numevt"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- number eventType to hit the else branch (val=null)
        eventTypes: [42],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
    expect(result.notifications[0]?.summary).toContain("null");
  });

  it("generates notification for boolean eventType (non-string non-object-with-val)", () => {
    const session = makeWebhookSession(keys, "doc-wh-bool-evttype");
    session.change((d) => {
      d.webhookConfigs["wh_boolevt"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- boolean eventType to hit the else branch (val=null)
        eventTypes: [true],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.summary).toContain("null");
  });

  it("generates notification for non-HTTP(S) URL protocol (ftp://)", () => {
    const session = makeWebhookSession(keys, "doc-wh-ftp-url");
    session.change((d) => {
      d.webhookConfigs["wh_ftp"] = {
        url: s("ftp://example.com/hook"),
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("url");
    expect(result.notifications[0]?.summary).toContain("non-HTTP(S)");
  });

  it("generates notification for invalid URL format (malformed string)", () => {
    const session = makeWebhookSession(keys, "doc-wh-bad-url");
    session.change((d) => {
      d.webhookConfigs["wh_badurl"] = {
        url: s("not a valid url at all"),
        eventTypes: [s("member.created")],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("url");
    expect(result.notifications[0]?.summary).toContain("invalid URL format");
  });

  it("generates notification for object eventType without val property (val=null)", () => {
    const session = makeWebhookSession(keys, "doc-wh-obj-no-val");
    session.change((d) => {
      d.webhookConfigs["wh_objnoval"] = {
        url: s("https://example.com/hook"),
        // @ts-expect-error -- object without val property to hit typeof=object but no 'val' branch
        eventTypes: [{ something: "else" }],
        enabled: true,
      };
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(1);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]?.fieldName).toBe("eventTypes");
  });

  it("normalizeWebhookConfigs returns count=0 when document has no webhookConfigs field", () => {
    const base = createPrivacyConfigDocument();
    const session = new EncryptedSyncSession({
      doc: Automerge.clone(base),
      keys,
      documentId: asSyncDocId("doc-wh-no-field"),
      sodium,
    });
    const result = normalizeWebhookConfigs(session as EncryptedSyncSession<unknown>);
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.envelope).toBeNull();
  });
});
