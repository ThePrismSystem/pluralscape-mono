import { fieldDefinitions, members } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHttpError } from "../../lib/api-error.js";
import { assertFieldDefinitionActive, assertMemberActive } from "../../lib/member-helpers.js";
import { mockDb } from "../helpers/mock-db.js";

import type { FieldDefinitionId, MemberId, SystemId } from "@pluralscape/types";

const SYSTEM_ID = brandId<SystemId>("sys_test-system");

describe("assertMemberActive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when member is found and active", async () => {
    const { db, chain } = mockDb();
    const memberId = brandId<MemberId>("mem_active-member");
    chain.limit.mockResolvedValueOnce([{ id: memberId }]);

    await expect(assertMemberActive(db, SYSTEM_ID, memberId)).resolves.toBeUndefined();

    expect(chain.select).toHaveBeenCalledWith({ id: members.id });
    expect(chain.from).toHaveBeenCalledWith(members);
    expect(chain.where).toHaveBeenCalledWith(
      and(eq(members.id, memberId), eq(members.systemId, SYSTEM_ID), eq(members.archived, false)),
    );
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("throws 404 when query returns no rows (not found, wrong system, or archived)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertMemberActive(db, SYSTEM_ID, brandId<MemberId>("mem_nonexistent")).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((err as ApiHttpError).message).toContain("Member");
  });

  it("throws ApiHttpError with exact message 'Member not found'", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertMemberActive(db, SYSTEM_ID, brandId<MemberId>("mem_gone")).catch(
      (e: unknown) => e,
    );

    expect((err as ApiHttpError).message).toBe("Member not found");
  });

  it("queries with the correct systemId and memberId combination", async () => {
    const { db, chain } = mockDb();
    const otherSystemId = brandId<SystemId>("sys_other-system");
    const memberId = brandId<MemberId>("mem_specific");
    chain.limit.mockResolvedValueOnce([{ id: memberId }]);

    await assertMemberActive(db, otherSystemId, memberId);

    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(members.id, memberId),
        eq(members.systemId, otherSystemId),
        eq(members.archived, false),
      ),
    );
  });
});

describe("assertFieldDefinitionActive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when field definition is found and active", async () => {
    const { db, chain } = mockDb();
    const fieldDefId = brandId<FieldDefinitionId>("fd_active-field");
    chain.limit.mockResolvedValueOnce([{ id: fieldDefId }]);

    await expect(assertFieldDefinitionActive(db, SYSTEM_ID, fieldDefId)).resolves.toBeUndefined();

    expect(chain.select).toHaveBeenCalledWith({ id: fieldDefinitions.id });
    expect(chain.from).toHaveBeenCalledWith(fieldDefinitions);
    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(fieldDefinitions.id, fieldDefId),
        eq(fieldDefinitions.systemId, SYSTEM_ID),
        eq(fieldDefinitions.archived, false),
      ),
    );
    expect(chain.limit).toHaveBeenCalledWith(1);
  });

  it("throws 404 when query returns no rows (not found or archived)", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertFieldDefinitionActive(
      db,
      SYSTEM_ID,
      brandId<FieldDefinitionId>("fd_nonexistent"),
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((err as ApiHttpError).message).toContain("Field definition");
  });

  it("throws ApiHttpError with exact message 'Field definition not found'", async () => {
    const { db, chain } = mockDb();
    chain.limit.mockResolvedValueOnce([]);

    const err = await assertFieldDefinitionActive(
      db,
      SYSTEM_ID,
      brandId<FieldDefinitionId>("fd_missing"),
    ).catch((e: unknown) => e);

    expect((err as ApiHttpError).message).toBe("Field definition not found");
  });

  it("queries with the correct systemId and fieldDefId combination", async () => {
    const { db, chain } = mockDb();
    const otherSystemId = brandId<SystemId>("sys_other-system");
    const fieldDefId = brandId<FieldDefinitionId>("fd_specific");
    chain.limit.mockResolvedValueOnce([{ id: fieldDefId }]);

    await assertFieldDefinitionActive(db, otherSystemId, fieldDefId);

    expect(chain.where).toHaveBeenCalledWith(
      and(
        eq(fieldDefinitions.id, fieldDefId),
        eq(fieldDefinitions.systemId, otherSystemId),
        eq(fieldDefinitions.archived, false),
      ),
    );
  });
});
