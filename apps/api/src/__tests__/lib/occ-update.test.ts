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
});
