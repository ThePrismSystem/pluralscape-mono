import { describe, expect, it } from "vitest";

// OPFS is not available in vitest node environment — test the driver interface shape
// Integration testing requires a browser environment
describe("OpfsSqliteDriver", () => {
  it("module exports createOpfsSqliteDriver", async () => {
    const mod = await import("../opfs-sqlite-driver.js");
    expect(mod.createOpfsSqliteDriver).toBeTypeOf("function");
  });
});
