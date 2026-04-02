import { describe, expect, it } from "vitest";

import { protectedProcedure } from "../../../trpc/middlewares/auth.js";
import { createCallerFactory, router } from "../../../trpc/trpc.js";
import { MOCK_AUTH, makeContext } from "../test-helpers.js";

const testRouter = router({
  whoami: protectedProcedure.query(({ ctx }) => ({
    accountId: ctx.auth.accountId,
  })),
});

const createCaller = createCallerFactory(testRouter);

describe("protectedProcedure", () => {
  it("rejects unauthenticated requests with UNAUTHORIZED", async () => {
    const caller = createCaller(makeContext(null));
    await expect(caller.whoami()).rejects.toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
    );
  });

  it("allows authenticated requests and narrows auth to non-null", async () => {
    const caller = createCaller(makeContext(MOCK_AUTH));
    const result = await caller.whoami();
    expect(result).toEqual({ accountId: MOCK_AUTH.accountId });
  });
});
