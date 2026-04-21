import { groupHierarchy } from "./internal.js";

import type { GroupResult } from "./internal.js";
import type { AuditWriter } from "../../lib/audit-writer.js";
import type { AuthContext } from "../../lib/auth-context.js";
import type { SystemId } from "@pluralscape/types";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export const createGroup: (
  db: PostgresJsDatabase,
  systemId: SystemId,
  params: unknown,
  auth: AuthContext,
  audit: AuditWriter,
) => Promise<GroupResult> = groupHierarchy.create;
