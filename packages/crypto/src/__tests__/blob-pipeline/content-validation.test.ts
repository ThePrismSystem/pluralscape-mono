import { describe, expect, it } from "vitest";

import {
  ContentTypeNotAllowedError,
  getAllowedMimeTypes,
  validateBlobContentType,
} from "../../blob-pipeline/content-validation.js";

import type { BlobPurpose } from "@pluralscape/types";

describe("validateBlobContentType", () => {
  describe("avatar", () => {
    it("allows image/png", () => {
      expect(() => {
        validateBlobContentType("image/png", "avatar");
      }).not.toThrow();
    });

    it("allows image/jpeg", () => {
      expect(() => {
        validateBlobContentType("image/jpeg", "avatar");
      }).not.toThrow();
    });

    it("rejects application/pdf", () => {
      expect(() => {
        validateBlobContentType("application/pdf", "avatar");
      }).toThrow(ContentTypeNotAllowedError);
    });

    it("rejects video/mp4", () => {
      expect(() => {
        validateBlobContentType("video/mp4", "avatar");
      }).toThrow(ContentTypeNotAllowedError);
    });
  });

  describe("attachment", () => {
    it("allows image/png", () => {
      expect(() => {
        validateBlobContentType("image/png", "attachment");
      }).not.toThrow();
    });

    it("allows application/pdf", () => {
      expect(() => {
        validateBlobContentType("application/pdf", "attachment");
      }).not.toThrow();
    });

    it("allows video/mp4", () => {
      expect(() => {
        validateBlobContentType("video/mp4", "attachment");
      }).not.toThrow();
    });

    it("rejects application/x-executable", () => {
      expect(() => {
        validateBlobContentType("application/x-executable", "attachment");
      }).toThrow(ContentTypeNotAllowedError);
    });
  });

  describe("export", () => {
    it("allows application/zip", () => {
      expect(() => {
        validateBlobContentType("application/zip", "export");
      }).not.toThrow();
    });

    it("allows application/json", () => {
      expect(() => {
        validateBlobContentType("application/json", "export");
      }).not.toThrow();
    });

    it("rejects image/png", () => {
      expect(() => {
        validateBlobContentType("image/png", "export");
      }).toThrow(ContentTypeNotAllowedError);
    });
  });

  it("error includes mimeType and purpose", () => {
    try {
      validateBlobContentType("text/html", "avatar");
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ContentTypeNotAllowedError);
      const cte = err as ContentTypeNotAllowedError;
      expect(cte.mimeType).toBe("text/html");
      expect(cte.purpose).toBe("avatar");
    }
  });
});

describe("getAllowedMimeTypes", () => {
  it("returns allowed types for each purpose", () => {
    const purposes: BlobPurpose[] = [
      "avatar",
      "member-photo",
      "journal-image",
      "attachment",
      "export",
      "littles-safe-mode",
    ];
    for (const purpose of purposes) {
      const types = getAllowedMimeTypes(purpose);
      expect(types.length).toBeGreaterThan(0);
    }
  });

  it("attachment has the most allowed types", () => {
    const attachment = getAllowedMimeTypes("attachment");
    const avatar = getAllowedMimeTypes("avatar");
    expect(attachment.length).toBeGreaterThan(avatar.length);
  });
});
