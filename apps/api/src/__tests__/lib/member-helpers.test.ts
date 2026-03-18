import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { assertFieldDefinitionActive, assertMemberActive } from "../../lib/member-helpers.js";
import { mockDb } from "../helpers/mock-db.js";

import type { FieldDefinitionId, MemberId, SystemId } from "@pluralscape/types";

const SYSTEM_ID = "sys_test-system" as SystemId;

describe("assertMemberActive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when member is found and active", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "mem_active-member" }]);

    await expect(
      assertMemberActive(db, SYSTEM_ID, "mem_active-member" as MemberId),
    ).resolves.toBeUndefined();
  });

  it("throws 404 when member not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertMemberActive(db, SYSTEM_ID, "mem_nonexistent" as MemberId).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((err as ApiHttpError).message).toContain("Member");
  });

  it("throws 404 when member belongs to a different system", async () => {
    const { db, chain } = mockDb();
    // Query filters by systemId, so wrong system returns no rows
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertMemberActive(
      db,
      "sys_other" as SystemId,
      "mem_wrong-system" as MemberId,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("throws 404 when member is archived", async () => {
    const { db, chain } = mockDb();
    // Query filters by archived=false, so archived member returns no rows
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertMemberActive(db, SYSTEM_ID, "mem_archived" as MemberId).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("assertFieldDefinitionActive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when field definition is found and active", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([{ id: "fd_active-field" }]);

    await expect(
      assertFieldDefinitionActive(db, SYSTEM_ID, "fd_active-field" as FieldDefinitionId),
    ).resolves.toBeUndefined();
  });

  it("throws 404 when field definition not found", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertFieldDefinitionActive(
      db,
      SYSTEM_ID,
      "fd_nonexistent" as FieldDefinitionId,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((err as ApiHttpError).message).toContain("Field definition");
  });

  it("throws 404 when field definition is archived", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertFieldDefinitionActive(
      db,
      SYSTEM_ID,
      "fd_archived" as FieldDefinitionId,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
