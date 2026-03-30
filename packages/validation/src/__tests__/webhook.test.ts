import { describe, expect, it } from "vitest";

import {
  CreateWebhookConfigBodySchema,
  UpdateWebhookConfigBodySchema,
  WebhookConfigQuerySchema,
  WebhookDeliveryQuerySchema,
} from "../webhook.js";

describe("CreateWebhookConfigBodySchema", () => {
  it("accepts a valid create payload", () => {
    const result = CreateWebhookConfigBodySchema.safeParse({
      url: "https://example.com/webhook",
      eventTypes: ["member.created"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional enabled and cryptoKeyId", () => {
    const result = CreateWebhookConfigBodySchema.safeParse({
      url: "https://example.com/webhook",
      eventTypes: ["member.created", "fronting.started"],
      enabled: false,
      cryptoKeyId: "ak_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing url", () => {
    const result = CreateWebhookConfigBodySchema.safeParse({
      eventTypes: ["member.created"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty eventTypes", () => {
    const result = CreateWebhookConfigBodySchema.safeParse({
      url: "https://example.com/webhook",
      eventTypes: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid event types", () => {
    const result = CreateWebhookConfigBodySchema.safeParse({
      url: "https://example.com/webhook",
      eventTypes: ["invalid.event"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL format", () => {
    const result = CreateWebhookConfigBodySchema.safeParse({
      url: "not-a-url",
      eventTypes: ["member.created"],
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateWebhookConfigBodySchema", () => {
  it("accepts version with optional fields", () => {
    const result = UpdateWebhookConfigBodySchema.safeParse({
      version: 1,
      enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all updatable fields", () => {
    const result = UpdateWebhookConfigBodySchema.safeParse({
      url: "https://new-url.com/webhook",
      eventTypes: ["fronting.started", "fronting.ended"],
      enabled: true,
      version: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing version", () => {
    const result = UpdateWebhookConfigBodySchema.safeParse({
      enabled: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("WebhookConfigQuerySchema", () => {
  it("accepts empty query", () => {
    const result = WebhookConfigQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts includeArchived", () => {
    const result = WebhookConfigQuerySchema.safeParse({
      includeArchived: "true",
    });
    expect(result.success).toBe(true);
  });
});

describe("WebhookDeliveryQuerySchema", () => {
  it("accepts empty query", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts status filter", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({
      status: "pending",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts eventType filter", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({
      eventType: "member.created",
    });
    expect(result.success).toBe(true);
  });

  it("accepts webhookId filter", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({
      webhookId: "wh_550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts fromDate and toDate as numeric strings", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({
      fromDate: "1700000000000",
      toDate: "1700100000000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fromDate).toBe(1_700_000_000_000);
      expect(result.data.toDate).toBe(1_700_100_000_000);
    }
  });

  it("treats omitted fromDate/toDate as undefined", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fromDate).toBeUndefined();
      expect(result.data.toDate).toBeUndefined();
    }
  });

  it("treats non-numeric fromDate as undefined", () => {
    const result = WebhookDeliveryQuerySchema.safeParse({ fromDate: "not-a-number" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fromDate).toBeUndefined();
    }
  });
});
