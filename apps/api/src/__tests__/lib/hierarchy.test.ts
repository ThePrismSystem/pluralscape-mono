import { brandId } from "@pluralscape/types";
import { describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { detectAncestorCycle } from "../../lib/hierarchy.js";

import type { GroupId } from "@pluralscape/types";

describe("detectAncestorCycle", () => {
  it("resolves when ancestor walk reaches root without finding target", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string | null>>()
      .mockResolvedValueOnce("b")
      .mockResolvedValueOnce("c")
      .mockResolvedValueOnce(null);

    await expect(detectAncestorCycle(getParentId, "a", "z", "Group")).resolves.toBeUndefined();
    expect(getParentId).toHaveBeenCalledTimes(3);
  });

  it("throws CONFLICT when immediate parent equals target", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string | null>>()
      .mockResolvedValueOnce("target");

    const err = (await detectAncestorCycle(getParentId, "start", "target", "Group").catch(
      (e: unknown) => e,
    )) as ApiHttpError;

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("Circular reference detected");
  });

  it("throws CONFLICT when ancestor several levels up equals target", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string | null>>()
      .mockResolvedValueOnce("b")
      .mockResolvedValueOnce("c")
      .mockResolvedValueOnce("target");

    const err = (await detectAncestorCycle(getParentId, "a", "target", "Group").catch(
      (e: unknown) => e,
    )) as ApiHttpError;

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("Circular reference detected");
  });

  it("throws NOT_FOUND when getParentId returns undefined", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string | undefined>>()
      .mockResolvedValueOnce(undefined);

    const err = (await detectAncestorCycle(getParentId, "a", "z", "Group").catch(
      (e: unknown) => e,
    )) as ApiHttpError;

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Group hierarchy integrity violation");
  });

  it("throws CONFLICT with depth message when depth exceeds MAX_ANCESTOR_DEPTH", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string>>()
      .mockImplementation((id) => Promise.resolve(`parent-of-${id}`));

    const err = (await detectAncestorCycle(getParentId, "start", "unreachable", "Subsystem").catch(
      (e: unknown) => e,
    )) as ApiHttpError;

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("Subsystem hierarchy too deep or contains a cycle");
    expect(getParentId).toHaveBeenCalledTimes(50);
  });

  it("handles startId === targetId as immediate cycle", async () => {
    const getParentId = vi.fn();

    const err = (await detectAncestorCycle(getParentId, "same", "same", "Group").catch(
      (e: unknown) => e,
    )) as ApiHttpError;

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
    expect(err.message).toBe("Circular reference detected");
    expect(getParentId).not.toHaveBeenCalled();
  });

  it("uses entityName in NOT_FOUND error messages", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string | undefined>>()
      .mockResolvedValueOnce(undefined);

    const err = (await detectAncestorCycle(getParentId, "a", "z", "Member").catch(
      (e: unknown) => e,
    )) as ApiHttpError;

    expect(err.message).toBe("Member hierarchy integrity violation");
  });

  it("uses entityName in depth-exceeded error messages", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string>>()
      .mockImplementation((id) => Promise.resolve(`parent-of-${id}`));

    const err = (await detectAncestorCycle(getParentId, "a", "z", "Layer").catch(
      (e: unknown) => e,
    )) as ApiHttpError;

    expect(err.message).toBe("Layer hierarchy too deep or contains a cycle");
  });

  it("works correctly with branded ID types", async () => {
    const getParentId = vi
      .fn<(id: string) => Promise<string | null>>()
      .mockResolvedValueOnce(brandId<GroupId>("grp_parent"))
      .mockResolvedValueOnce(null);

    await expect(
      detectAncestorCycle(
        getParentId,
        brandId<GroupId>("grp_child"),
        brandId<GroupId>("grp_other"),
        "Group",
      ),
    ).resolves.toBeUndefined();

    expect(getParentId).toHaveBeenCalledWith("grp_child");
    expect(getParentId).toHaveBeenCalledWith("grp_parent");
  });
});
