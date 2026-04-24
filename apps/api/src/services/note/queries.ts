import { notes } from "@pluralscape/db/pg";
import { brandId } from "@pluralscape/types";
import { NoteQuerySchema } from "@pluralscape/validation";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import { HTTP_BAD_REQUEST, HTTP_NOT_FOUND } from "../../http.constants.js";
import { ApiHttpError } from "../../lib/api-error.js";
import { buildCompositePaginatedResult, fromCompositeCursor } from "../../lib/pagination.js";
import { parseQuery } from "../../lib/query-parse.js";
import { withTenantRead } from "../../lib/rls-context.js";
import { assertSystemOwnership } from "../../lib/system-ownership.js";
import { tenantCtx } from "../../lib/tenant-context.js";
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "../../service.constants.js";

import { toNoteResult } from "./internal.js";

import type { NoteResult } from "./internal.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type {
  AnyBrandedId,
  NoteAuthorEntityType,
  NoteId,
  PaginatedResult,
  SystemId,
} from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

interface ListNoteOpts {
  readonly cursor?: string;
  readonly limit?: number;
  readonly includeArchived?: boolean;
  readonly authorEntityType?: NoteAuthorEntityType;
  readonly authorEntityId?: string;
  readonly systemWide?: boolean;
}

export async function getNote(
  db: PostgresJsDatabase,
  systemId: SystemId,
  noteId: NoteId,
  auth: AuthContext,
): Promise<NoteResult> {
  assertSystemOwnership(systemId, auth);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const [row] = await tx
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.systemId, systemId), eq(notes.archived, false)))
      .limit(1);

    if (!row) {
      throw new ApiHttpError(HTTP_NOT_FOUND, "NOT_FOUND", "Note not found");
    }

    return toNoteResult(row);
  });
}

export async function listNotes(
  db: PostgresJsDatabase,
  systemId: SystemId,
  auth: AuthContext,
  opts: ListNoteOpts = {},
): Promise<PaginatedResult<NoteResult>> {
  assertSystemOwnership(systemId, auth);

  if (
    opts.systemWide &&
    (opts.authorEntityType !== undefined || opts.authorEntityId !== undefined)
  ) {
    throw new ApiHttpError(
      HTTP_BAD_REQUEST,
      "VALIDATION_ERROR",
      "systemWide cannot be combined with author filters",
    );
  }

  const effectiveLimit = Math.min(opts.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);

  return withTenantRead(db, tenantCtx(systemId, auth), async (tx) => {
    const conditions = [eq(notes.systemId, systemId)];

    if (!opts.includeArchived) {
      conditions.push(eq(notes.archived, false));
    }

    if (opts.systemWide) {
      conditions.push(isNull(notes.authorEntityType));
    }

    if (opts.authorEntityType !== undefined) {
      conditions.push(eq(notes.authorEntityType, opts.authorEntityType));
    }

    if (opts.authorEntityId !== undefined) {
      conditions.push(eq(notes.authorEntityId, brandId<AnyBrandedId>(opts.authorEntityId)));
    }

    if (opts.cursor) {
      const decoded = fromCompositeCursor(opts.cursor, "note");
      // or() returns SQL | undefined in drizzle types; always defined with concrete args
      const cursorCondition = or(
        lt(notes.createdAt, decoded.sortValue),
        and(eq(notes.createdAt, decoded.sortValue), lt(notes.id, brandId<NoteId>(decoded.id))),
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await tx
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt), desc(notes.id))
      .limit(effectiveLimit + 1);

    return buildCompositePaginatedResult(rows, effectiveLimit, toNoteResult, (i) => i.createdAt);
  });
}

export function parseNoteQuery(query: Record<string, string | undefined>): {
  includeArchived: boolean;
  authorEntityType?: NoteAuthorEntityType;
  authorEntityId?: string;
  systemWide: boolean;
} {
  return parseQuery(NoteQuerySchema, query);
}
