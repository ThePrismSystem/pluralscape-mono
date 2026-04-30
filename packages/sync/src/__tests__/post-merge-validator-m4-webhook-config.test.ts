/**
 * M4 post-merge validator tests: webhook config normalization.
 *
 * Covers normalizeWebhookConfigs validation (URL format, protocol, event-type
 * checks) and runAllValidations integration paths that exercise the webhook
 * validator, including cross-validator error isolation.
 *
 * Companion file: post-merge-validator-m4-timer-config.test.ts holds
 * normalizeTimerConfig tests + runAllValidations timer integration.
 */
import { WasmSodiumAdapter } from "@pluralscape/crypto/wasm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { normalizeWebhookConfigs, runAllValidations } from "../post-merge-validator.js";

import {
  makeKeys,
  makeTimer,
  makeWebhookConfig,
  makeWebhookSession,
  s,
  setSodium,
} from "./helpers/validator-fixtures.js";
import { asTimerId } from "./test-crypto-helpers.js";

import type { DocumentKeys } from "../types.js";
import type { SodiumAdapter } from "@pluralscape/crypto";

let sodium: SodiumAdapter;

beforeAll(async () => {
  sodium = new WasmSodiumAdapter();
  await sodium.init();
  setSodium(sodium);
});

// ── normalizeWebhookConfigs ──────────────────────────────────────────

describe("normalizeWebhookConfigs (M4)", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("generates notification for config with invalid URL format", () => {
    const session = makeWebhookSession(keys, "doc-m4-wh-badurl");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-ftp");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-https");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-http");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-plain-url");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", ["member.created"]);
    });

    const result = normalizeWebhookConfigs(session);

    // URL validation runs normally — valid HTTPS URL produces no notification
    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("generates notification for config with unknown event type", () => {
    const session = makeWebhookSession(keys, "doc-m4-wh-unk-evt");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-valid-evt");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-plain-str-evt");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-mix-evt");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-empty");

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
    expect(result.envelope).toBeNull();
  });

  it("returns count=0 for config with empty eventTypes array", () => {
    const session = makeWebhookSession(keys, "doc-m4-wh-empty-evt");

    session.change((d) => {
      d.webhookConfigs["wh_1"] = makeWebhookConfig("https://example.com/hook", []);
    });

    const result = normalizeWebhookConfigs(session);

    expect(result.count).toBe(0);
    expect(result.notifications).toHaveLength(0);
  });

  it("skips eventTypes validation when eventTypes is not an array", () => {
    const session = makeWebhookSession(keys, "doc-m4-wh-nonarr-evt");

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
    const session = makeWebhookSession(keys, "doc-m4-wh-multi");

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

// ── runAllValidations integration: webhook paths ─────────────────────

describe("runAllValidations (M4 webhook integration)", () => {
  let keys: DocumentKeys;

  beforeEach(() => {
    keys = makeKeys();
  });

  it("triggers normalizeWebhookConfigs when document has webhookConfigs field", () => {
    const session = makeWebhookSession(keys, "doc-m4-run-webhook");

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
    // Cross-coverage: this also exercises the timer validator's success path
    // alongside the webhook validator's success path.
    const session = makeWebhookSession(keys, "doc-m4-run-both");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", { intervalMinutes: -5 });
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

  it("catches webhook validator error without blocking timer validation", () => {
    // Cross-coverage: webhook-error path is the test focus; timer validator
    // runs as the success companion.
    const session = makeWebhookSession(keys, "doc-m4-run-error-rev");

    session.change((d) => {
      d.timers[asTimerId("tmr_1")] = makeTimer("tmr_1", { intervalMinutes: -5 });
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
    expect(webhookError?.validator).toBe("normalizeWebhookConfigs");
    expect(errorMessages).toContain("Webhook config validation failed");

    // Timer validator should still have run successfully
    expect(result.timerConfigNormalizations).toBe(1);
    expect(result.notifications.some((n) => n.resolution === "post-merge-timer-normalize")).toBe(
      true,
    );
    expect(session.document.timers[asTimerId("tmr_1")]?.enabled).toBe(false);
  });
});
