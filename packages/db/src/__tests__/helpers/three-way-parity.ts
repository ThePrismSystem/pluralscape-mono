import type { Column } from "drizzle-orm";

/**
 * Assert that two schema column maps share equivalent structural columns
 * (id, systemId, timestamps, archivable, …). Variant-specific columns
 * (encryptedData, version on the server side; decrypted fields on the
 * cache side) are skipped via the `skip` option.
 */
export function assertStructuralColumnsEquivalent(
  serverCols: Record<string, Column>,
  cacheCols: Record<string, Column>,
  opts: { skip: readonly string[] },
): void {
  const skipSet = new Set(opts.skip);

  for (const [name, col] of Object.entries(serverCols)) {
    if (skipSet.has(name)) continue;
    const cacheCol = cacheCols[name];
    if (!cacheCol) {
      throw new Error(
        `Cache schema is missing structural column "${name}" present on server schema`,
      );
    }
    if (col.notNull !== cacheCol.notNull) {
      throw new Error(
        `Column "${name}" notNull mismatch: server=${String(col.notNull)}, cache=${String(cacheCol.notNull)}`,
      );
    }
  }
}

/**
 * Runtime assertion that a cache schema's variant columns map onto a domain
 * type's fields per the encoding rules in ADR-038. The actual T-to-column
 * mapping is enforced by Drizzle's `$type<T>()` annotations on the column
 * builders; this helper checks that every non-structural cache column is
 * declared in `expectedDomainKeys`. Type-level identity is asserted in the
 * caller via `expectTypeOf` against the column-inferred row type.
 */
export function assertCacheColumnsMatchDomainType(
  cacheCols: Record<string, Column>,
  opts: { skipStructural: readonly string[]; expectedDomainKeys: readonly string[] },
): void {
  const skipSet = new Set(opts.skipStructural);
  const expectedSet = new Set(opts.expectedDomainKeys);
  const variantKeys = Object.keys(cacheCols).filter((k) => !skipSet.has(k));
  const missing = variantKeys.filter((k) => !expectedSet.has(k));
  if (missing.length > 0) {
    throw new Error(
      `Cache schema has variant columns not declared on the domain type: ${missing.join(", ")}`,
    );
  }
}
