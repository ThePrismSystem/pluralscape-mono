import { ApiHttpError } from "../../lib/api-error.js";

import type { Mock } from "vitest";

/**
 * Configure a mocked assertSystemOwnership to throw a 404 NOT_FOUND
 * error on the next call, simulating a failed ownership check.
 */
export function mockOwnershipFailure(mock: Mock): void {
  mock.mockImplementationOnce(() => {
    throw new ApiHttpError(404, "NOT_FOUND", "System not found");
  });
}
