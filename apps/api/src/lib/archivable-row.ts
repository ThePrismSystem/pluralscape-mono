import type { Archivable, Archived, UnixMillis } from "@pluralscape/types";

/**
 * Narrow a flat Drizzle row into the discriminated `Archivable<T>` shape.
 *
 * Each archivable PG table has a CHECK constraint guaranteeing
 * `(archived = true) = (archived_at IS NOT NULL)`. This adapter re-derives
 * the discriminated union from the flat row so the rest of the application
 * code can work with the type-system-encoded invariant.
 *
 * Throws on either inconsistent state (defensive: if the CHECK is ever
 * dropped or violated, fail loud at the read boundary rather than letting
 * the malformed row propagate). See ADR-023 § Archivable plaintext entities.
 */
export function narrowArchivableRow<T extends { readonly archived: false }>(
  row: Omit<T, "archived"> & {
    readonly archived: boolean;
    readonly archivedAt: UnixMillis | null;
  },
): Archivable<T> {
  if (!row.archived) {
    if (row.archivedAt !== null) {
      throw new Error(
        "Archivable row CHECK invariant violated: archived=false with non-null archivedAt",
      );
    }
    const entries = Object.entries(row).filter(([k]) => k !== "archivedAt");
    return { ...Object.fromEntries(entries), archived: false } as T;
  }
  if (row.archivedAt === null) {
    throw new Error("Archivable row CHECK invariant violated: archived=true with archivedAt=null");
  }
  return {
    ...row,
    archived: true as const,
    archivedAt: row.archivedAt,
  } as Archived<T>;
}
