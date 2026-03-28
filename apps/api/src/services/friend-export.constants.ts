/**
 * Entity table registry for friend data export.
 *
 * Each entry provides typed query functions that preserve drizzle custom type
 * conversions (pgTimestamp → number, pgEncryptedBlob → EncryptedBlob).
 *
 * The functions are defined inline per entity type to maintain full type safety
 * with drizzle's column generics.
 */
import {
  acknowledgements,
  boardMessages,
  channels,
  customFronts,
  fieldDefinitions,
  fieldValues,
  frontingComments,
  frontingSessions,
  groups,
  innerworldEntities,
  innerworldRegions,
  journalEntries,
  memberPhotos,
  members,
  messages,
  notes,
  polls,
  relationships,
  systemStructureEntities,
  systemStructureEntityTypes,
  wikiPages,
} from "@pluralscape/db/pg";
import { and, asc, eq, gt, or } from "drizzle-orm";

import type { EncryptedBlob, FriendExportEntityType, SystemId } from "@pluralscape/types";
import type { SQL } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/** Row shape returned by manifest queries (no encrypted data). */
export interface ManifestRow {
  readonly id: string;
  readonly updatedAt: number;
}

/** Row shape returned by export page queries. */
export interface ExportRow {
  readonly id: string;
  readonly encryptedData: EncryptedBlob;
  readonly updatedAt: number;
}

/** Decoded cursor values for keyset pagination. */
export interface CursorValues {
  readonly sortValue: number;
  readonly id: string;
}

/** Query functions for a single exportable entity type. */
export interface ExportQueryFns {
  readonly queryManifestRows: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
  ) => Promise<ManifestRow[]>;

  readonly queryExportRows: (
    tx: PostgresJsDatabase,
    systemId: SystemId,
    limit: number,
    cursor?: CursorValues,
  ) => Promise<ExportRow[]>;
}

/* -------------------------------------------------------------------------- */
/*  Per-table query function builders                                         */
/*                                                                            */
/*  Each function captures concrete drizzle column references in a closure,   */
/*  preserving custom type conversions without generic type erasure.           */
/* -------------------------------------------------------------------------- */

function memberFns(): ExportQueryFns {
  const t = members;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function groupFns(): ExportQueryFns {
  const t = groups;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function channelFns(): ExportQueryFns {
  const t = channels;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function messageFns(): ExportQueryFns {
  const t = messages;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function noteFns(): ExportQueryFns {
  const t = notes;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function pollFns(): ExportQueryFns {
  const t = polls;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function relationshipFns(): ExportQueryFns {
  const t = relationships;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function structureEntityTypeFns(): ExportQueryFns {
  const t = systemStructureEntityTypes;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function structureEntityFns(): ExportQueryFns {
  const t = systemStructureEntities;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function journalEntryFns(): ExportQueryFns {
  const t = journalEntries;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function wikiPageFns(): ExportQueryFns {
  const t = wikiPages;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function customFrontFns(): ExportQueryFns {
  const t = customFronts;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function frontingSessionFns(): ExportQueryFns {
  const t = frontingSessions;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function boardMessageFns(): ExportQueryFns {
  const t = boardMessages;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function acknowledgementFns(): ExportQueryFns {
  const t = acknowledgements;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function innerworldEntityFns(): ExportQueryFns {
  const t = innerworldEntities;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function innerworldRegionFns(): ExportQueryFns {
  const t = innerworldRegions;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function fieldDefinitionFns(): ExportQueryFns {
  const t = fieldDefinitions;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function fieldValueFns(): ExportQueryFns {
  const t = fieldValues;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(eq(t.systemId, systemId));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function memberPhotoFns(): ExportQueryFns {
  const t = memberPhotos;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

function frontingCommentFns(): ExportQueryFns {
  const t = frontingComments;
  return {
    async queryManifestRows(tx, systemId) {
      return tx
        .select({ id: t.id, updatedAt: t.updatedAt })
        .from(t)
        .where(and(eq(t.systemId, systemId), eq(t.archived, false)));
    },
    async queryExportRows(tx, systemId, limit, cursor) {
      const conds: SQL[] = [eq(t.systemId, systemId), eq(t.archived, false)];
      if (cursor) {
        conds.push(
          or(
            gt(t.updatedAt, cursor.sortValue),
            and(eq(t.updatedAt, cursor.sortValue), gt(t.id, cursor.id)),
          ) as SQL,
        );
      }
      return tx
        .select({ id: t.id, encryptedData: t.encryptedData, updatedAt: t.updatedAt })
        .from(t)
        .where(and(...conds))
        .orderBy(asc(t.updatedAt), asc(t.id))
        .limit(limit);
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Registry                                                                  */
/* -------------------------------------------------------------------------- */

export const EXPORT_TABLE_REGISTRY: Record<FriendExportEntityType, ExportQueryFns> = {
  member: memberFns(),
  group: groupFns(),
  channel: channelFns(),
  message: messageFns(),
  note: noteFns(),
  poll: pollFns(),
  relationship: relationshipFns(),
  "structure-entity-type": structureEntityTypeFns(),
  "structure-entity": structureEntityFns(),
  "journal-entry": journalEntryFns(),
  "wiki-page": wikiPageFns(),
  "custom-front": customFrontFns(),
  "fronting-session": frontingSessionFns(),
  "board-message": boardMessageFns(),
  acknowledgement: acknowledgementFns(),
  "innerworld-entity": innerworldEntityFns(),
  "innerworld-region": innerworldRegionFns(),
  "field-definition": fieldDefinitionFns(),
  "field-value": fieldValueFns(),
  "member-photo": memberPhotoFns(),
  "fronting-comment": frontingCommentFns(),
};
