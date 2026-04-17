import { brandId } from "@pluralscape/types";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { systemProcedure } from "../../../trpc/middlewares/system.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";
import { MOCK_AUTH, MOCK_SYSTEM_ID, makeContext } from "../test-helpers.js";

import type { SystemId } from "@pluralscape/types";

const OWNED_SYSTEM_ID = MOCK_SYSTEM_ID;
const OTHER_SYSTEM_ID = brandId<SystemId>("sys_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

const testRouter = router({
  echo: systemProcedure.input(z.object({ value: z.string() })).query(({ ctx, input }) => ({
    systemId: ctx.systemId,
    value: input.value,
  })),
});

const createCaller = createCallerFactory(testRouter);

describe("systemProcedure", () => {
  it("rejects unauthenticated requests", async () => {
    const caller = createCaller(makeContext(null));
    await expect(caller.echo({ systemId: OWNED_SYSTEM_ID, value: "test" })).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("rejects requests with unowned systemId", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    await expect(caller.echo({ systemId: OTHER_SYSTEM_ID, value: "test" })).rejects.toThrow(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });

  it("rejects requests with missing systemId", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    await expect(caller.echo({ value: "test" } as never)).rejects.toThrow();
  });

  it("passes valid systemId into context", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    const result = await caller.echo({ systemId: OWNED_SYSTEM_ID, value: "hello" });
    expect(result).toEqual({ systemId: OWNED_SYSTEM_ID, value: "hello" });
  });
});
