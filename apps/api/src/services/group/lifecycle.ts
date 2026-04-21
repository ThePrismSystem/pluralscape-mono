import { groupHierarchy } from "./internal.js";

import type { GroupResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { GroupId, SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export const deleteGroup: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: GroupId,
  auth: AuthContext,
  audit: AuditWriter,
) => Promise<void> = groupHierarchy.remove;

export const archiveGroup: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: GroupId,
  auth: AuthContext,
  audit: AuditWriter,
) => Promise<void> = groupHierarchy.archive;

export const restoreGroup: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  entityId: GroupId,
  auth: AuthContext,
  audit: AuditWriter,
) => Promise<GroupResult> = groupHierarchy.restore;
