import type { JobEnqueueParams } from "../types.js";
import type { JobType, SystemId } from "@pluralscape/types";

/** Builds a minimal valid JobEnqueueParams for use in tests. */
export function makeJobParams(
  overrides: Partial<JobEnqueueParams> & { type?: JobType } = {},
): JobEnqueueParams {
  return {
    type: "sync-push",
    systemId: null,
    payload: {},
    idempotencyKey: crypto.randomUUID(),
    priority: 0,
    ...overrides,
  };
}

/** Casts a string to SystemId for use in tests. */
export function testSystemId(id: string): SystemId {
  return id as SystemId;
}
