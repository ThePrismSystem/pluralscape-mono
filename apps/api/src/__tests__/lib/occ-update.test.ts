import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { assertOccUpdated } from "../../lib/occ-update.js";

describe("assertOccUpdated", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the single row when update returned exactly one row", async () => {
    const row = { id: "sys_abc", version: 2 };
    const existsFn = vi.fn();

    const result = await assertOccUpdated([row], existsFn, "System");

    expect(result).toBe(row);
    expect(existsFn).not.toHaveBeenCalled();
  });

  it("throws 409 CONFLICT when update returned 0 rows but entity exists (version mismatch)", async () => {
    const existsFn = vi.fn().mockResolvedValue({ id: "sys_abc" });

    const err = await assertOccUpdated([], existsFn, "System").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 409, code: "CONFLICT" });
    expect((err as ApiHttpError).message).toBe("Version conflict");
    expect(existsFn).toHaveBeenCalledOnce();
  });

  it("throws 404 NOT_FOUND when update returned 0 rows and entity does not exist", async () => {
    const existsFn = vi.fn().mockResolvedValue(undefined);

    const err = await assertOccUpdated([], existsFn, "Widget").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((err as ApiHttpError).message).toContain("Widget");
  });

  it("returns the first row when update returned multiple rows", async () => {
    const rows = [
      { id: "a", version: 1 },
      { id: "b", version: 2 },
    ];
    const existsFn = vi.fn();

    const result = await assertOccUpdated(rows, existsFn, "System");

    expect(result).toBe(rows[0]);
  });

  it("includes entity name in the 404 message", async () => {
    const existsFn = vi.fn().mockResolvedValue(undefined);

    const err = await assertOccUpdated([], existsFn, "Layer").catch((e: unknown) => e);

    expect((err as ApiHttpError).message).toBe("Layer not found");
  });

  it("propagates errors thrown by existsFn", async () => {
    const dbError = new Error("Database connection lost");
    const existsFn = vi.fn().mockRejectedValue(dbError);

    await expect(assertOccUpdated([], existsFn, "System")).rejects.toThrow(
      "Database connection lost",
    );
  });

  it("does not call existsFn when rows are returned", async () => {
    const existsFn = vi.fn();

    await assertOccUpdated([{ id: "x" }], existsFn, "System");

    expect(existsFn).not.toHaveBeenCalled();
  });
});
