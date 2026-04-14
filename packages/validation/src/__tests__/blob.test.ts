import { describe, expect, it } from "vitest";

import { ALLOWED_MIME_TYPES, CreateUploadUrlBodySchema } from "../blob.js";

// ── Helpers ──────────────────────────────────────────────────────────

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    purpose: "avatar",
    mimeType: "image/png",
    sizeBytes: 1024,
    encryptionTier: 1,
    ...overrides,
  };
}

// ── ALLOWED_MIME_TYPES export ────────────────────────────────────────

describe("ALLOWED_MIME_TYPES", () => {
  it("contains an entry for every BlobPurpose value", () => {
    const purposes = [
      "avatar",
      "member-photo",
      "journal-image",
      "attachment",
      "export",
      "littles-safe-mode",
    ] as const;
    for (const purpose of purposes) {
      expect(ALLOWED_MIME_TYPES[purpose]).toBeDefined();
      expect(ALLOWED_MIME_TYPES[purpose].length).toBeGreaterThan(0);
    }
  });
});

// ── MIME type validation ────────────────────────────────────────────

describe("CreateUploadUrlBodySchema MIME validation", () => {
  it("accepts valid MIME type for avatar (image/png)", () => {
    const result = CreateUploadUrlBodySchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("accepts valid MIME type for avatar (image/jpeg)", () => {
    const result = CreateUploadUrlBodySchema.safeParse(validPayload({ mimeType: "image/jpeg" }));
    expect(result.success).toBe(true);
  });

  it("accepts valid MIME type for avatar (image/webp)", () => {
    const result = CreateUploadUrlBodySchema.safeParse(validPayload({ mimeType: "image/webp" }));
    expect(result.success).toBe(true);
  });

  it("accepts image/gif for journal-image", () => {
    const result = CreateUploadUrlBodySchema.safeParse(
      validPayload({ purpose: "journal-image", mimeType: "image/gif" }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts application/pdf for attachment", () => {
    const result = CreateUploadUrlBodySchema.safeParse(
      validPayload({ purpose: "attachment", mimeType: "application/pdf" }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts application/octet-stream for export", () => {
    const result = CreateUploadUrlBodySchema.safeParse(
      validPayload({ purpose: "export", mimeType: "application/octet-stream" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects text/html (stored XSS vector)", () => {
    const result = CreateUploadUrlBodySchema.safeParse(validPayload({ mimeType: "text/html" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("text/html");
      expect(issue?.message).toContain("not allowed");
    }
  });

  it("rejects application/javascript (stored XSS vector)", () => {
    const result = CreateUploadUrlBodySchema.safeParse(
      validPayload({ mimeType: "application/javascript" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("application/javascript");
      expect(issue?.message).toContain("not allowed");
    }
  });

  it("rejects cross-purpose MIME type (PDF not allowed for avatar)", () => {
    const result = CreateUploadUrlBodySchema.safeParse(
      validPayload({ mimeType: "application/pdf" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue).toBeDefined();
      expect(issue?.message).toContain("application/pdf");
      expect(issue?.message).toContain("avatar");
    }
  });

  it("rejects cross-purpose MIME type (image/gif not allowed for avatar)", () => {
    const result = CreateUploadUrlBodySchema.safeParse(validPayload({ mimeType: "image/gif" }));
    expect(result.success).toBe(false);
  });

  it("rejects image/png for export purpose", () => {
    const result = CreateUploadUrlBodySchema.safeParse(
      validPayload({ purpose: "export", mimeType: "image/png" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects application/octet-stream for avatar purpose", () => {
    const result = CreateUploadUrlBodySchema.safeParse(
      validPayload({ mimeType: "application/octet-stream" }),
    );
    expect(result.success).toBe(false);
  });
});
