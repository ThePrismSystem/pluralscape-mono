import { describe, it, expect, expectTypeOf } from "vitest";

import { I18N_CACHE_TTL_MS, I18N_OTA_TIMEOUT_MS, I18N_ETAG_LENGTH } from "../constants.js";

import type {
  I18nManifest,
  I18nLocaleManifest,
  I18nNamespaceManifest,
  I18nNamespace,
} from "../index.js";

describe("i18n types", () => {
  it("I18nManifest has distributionTimestamp and locales", () => {
    expectTypeOf<I18nManifest>().toEqualTypeOf<{
      readonly distributionTimestamp: number;
      readonly locales: readonly I18nLocaleManifest[];
    }>();
  });

  it("I18nLocaleManifest groups namespaces by locale tag", () => {
    expectTypeOf<I18nLocaleManifest>().toEqualTypeOf<{
      readonly locale: string;
      readonly namespaces: readonly I18nNamespaceManifest[];
    }>();
  });

  it("I18nNamespaceManifest carries name and etag", () => {
    expectTypeOf<I18nNamespaceManifest>().toEqualTypeOf<{
      readonly name: string;
      readonly etag: string;
    }>();
  });

  it("I18nNamespace wraps translations record", () => {
    expectTypeOf<I18nNamespace>().toEqualTypeOf<{
      readonly translations: Readonly<Record<string, string>>;
    }>();
  });

  it("cache TTL is 24h", () => {
    expect(I18N_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("OTA fetch timeout is 5s", () => {
    expect(I18N_OTA_TIMEOUT_MS).toBe(5_000);
  });

  it("ETag length is 16 hex chars", () => {
    expect(I18N_ETAG_LENGTH).toBe(16);
  });
});
