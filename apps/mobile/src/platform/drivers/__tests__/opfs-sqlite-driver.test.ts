import { describe, expect, it } from "vitest";

// OPFS + wa-sqlite require a browser environment with FileSystemSyncAccessHandle.
// These tests verify the module shape and document the interface contract.
// Full behavioral tests require a browser harness (Playwright).

describe("OpfsSqliteDriver", () => {
  it("module exports createOpfsSqliteDriver", async () => {
    const mod = await import("../opfs-sqlite-driver.js");
    expect(mod.createOpfsSqliteDriver).toBeTypeOf("function");
  });

  it("createOpfsSqliteDriver rejects when wa-sqlite modules are unavailable", async () => {
    const { createOpfsSqliteDriver } = await import("../opfs-sqlite-driver.js");
    await expect(createOpfsSqliteDriver()).rejects.toThrow();
  });
});
