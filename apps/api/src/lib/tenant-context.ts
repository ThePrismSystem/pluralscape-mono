import type { AuthContext } from "./auth-context.js";
import type { TenantContext } from "./rls-context.js";
import type { SystemId } from "@pluralscape/types";

/** Build a {@link TenantContext} from a systemId and the current auth session. */
export function tenantCtx(systemId: SystemId, auth: AuthContext): TenantContext {
  return { systemId, accountId: auth.accountId };
}
