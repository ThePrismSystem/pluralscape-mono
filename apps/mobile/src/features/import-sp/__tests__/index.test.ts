/**
 * Smoke test asserting that every symbol the import-sp feature barrel
 * advertises is actually exported. Protects against barrel rot when
 * individual source files are renamed or restructured.
 */

import { describe, expect, it } from "vitest";

import * as barrel from "../index.js";

describe("import-sp barrel", () => {
  it("exports every public runtime symbol as a function", () => {
    const runtimeExports = {
      createMobileAvatarFetcher: barrel.createMobileAvatarFetcher,
      createSpTokenStorage: barrel.createSpTokenStorage,
      createMobilePersister: barrel.createMobilePersister,
      runSpImport: barrel.runSpImport,
      useCancelImport: barrel.useCancelImport,
      useImportJob: barrel.useImportJob,
      useImportProgress: barrel.useImportProgress,
      useImportSummary: barrel.useImportSummary,
      useResumeActiveImport: barrel.useResumeActiveImport,
      useStartImport: barrel.useStartImport,
    } as const;

    for (const [name, value] of Object.entries(runtimeExports)) {
      expect(typeof value, `${name} should be a function`).toBe("function");
    }
  });
});
