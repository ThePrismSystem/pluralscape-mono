/**
 * Smoke test asserting that every symbol the import-sp feature barrel
 * advertises is actually exported. Protects against barrel rot when
 * individual source files are renamed or restructured.
 */

import { describe, expect, it } from "vitest";

import * as barrel from "../index.js";

describe("import-sp barrel", () => {
  it("exports every public runtime symbol", () => {
    expect(barrel.createMobileAvatarFetcher).toBeDefined();
    expect(barrel.createSpTokenStorage).toBeDefined();
    expect(barrel.createMobilePersister).toBeDefined();
    expect(barrel.runSpImport).toBeDefined();
    expect(barrel.useCancelImport).toBeDefined();
    expect(barrel.useImportJob).toBeDefined();
    expect(barrel.useImportProgress).toBeDefined();
    expect(barrel.useImportSummary).toBeDefined();
    expect(barrel.useResumeActiveImport).toBeDefined();
    expect(barrel.useStartImport).toBeDefined();
  });

  it("every exported value is a function", () => {
    const runtimeExports = [
      barrel.createMobileAvatarFetcher,
      barrel.createSpTokenStorage,
      barrel.createMobilePersister,
      barrel.runSpImport,
      barrel.useCancelImport,
      barrel.useImportJob,
      barrel.useImportProgress,
      barrel.useImportSummary,
      barrel.useResumeActiveImport,
      barrel.useStartImport,
    ];
    for (const value of runtimeExports) {
      expect(typeof value).toBe("function");
    }
  });
});
