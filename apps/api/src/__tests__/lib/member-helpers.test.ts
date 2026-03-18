
import { fieldDefinitions, members } from "@pluralscape/db/pg";
import { and, eq } from "drizzle-orm";
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
    const memberId = "mem_active-member" as MemberId;
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

    const err = await assertMemberActive(db, SYSTEM_ID, "mem_nonexistent" as MemberId).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((err as ApiHttpError).message).toContain("Member");
  });
});

describe("assertFieldDefinitionActive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves when field definition is found and active", async () => {
    const { db, chain } = mockDb();
    const fieldDefId = "fd_active-field" as FieldDefinitionId;
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
      "fd_nonexistent" as FieldDefinitionId,
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiHttpError);
    expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect((err as ApiHttpError).message).toContain("Field definition");
  });
});
