import type { ImportEntityTargetIdMap } from "./entities/import-entity-ref.js";
import type { ImportEntityType } from "./entities/import-job.js";

/**
 * Thrown when `assertBrandedTargetId` receives a value that cannot plausibly
 * be a branded target ID (empty, non-string, or fails per-entity format
 * validation).
 */
export class InvalidBrandedIdError extends Error {
  public readonly entityType: ImportEntityType;
  public readonly rawId: unknown;

  constructor(entityType: ImportEntityType, rawId: unknown) {
    super(`Invalid branded ID for entity type "${entityType}": ${JSON.stringify(rawId)}`);
    this.name = "InvalidBrandedIdError";
    this.entityType = entityType;
    this.rawId = rawId;
  }
}

/**
 * Runtime assertion helper for converting a raw string to a typed branded
 * target ID. Throws `InvalidBrandedIdError` on any input that cannot plausibly
 * be a branded ID.
 *
 * For entity types without per-entity format checks, the helper only asserts
 * that the input is a non-empty string. Consumers that need stricter checks
 * (UUID, ULID, numeric) should wrap this helper with their own validation.
 *
 * The trailing cast is the single controlled narrowing boundary between raw
 * DB strings and branded target IDs: every caller that reaches the return
 * statement has already passed the runtime `typeof`/length check, so the
 * cast is justified by the preceding assertion.
 */
export function assertBrandedTargetId<T extends ImportEntityType>(
  entityType: T,
  rawId: unknown,
): ImportEntityTargetIdMap[T] {
  if (typeof rawId !== "string" || rawId.length === 0) {
    throw new InvalidBrandedIdError(entityType, rawId);
  }
  return rawId as ImportEntityTargetIdMap[T];
}
