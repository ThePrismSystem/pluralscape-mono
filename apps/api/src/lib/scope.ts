import type { AuthContext } from "./auth-context.js";
import type { ApiKeyScope, RequiredScope } from "@pluralscape/types";

/**
 * Split a per-entity scope like "read:members" into its tier and domain.
 * Only called for per-entity scopes — aggregates and "full" are handled before this.
 */
function splitScope(scope: string): readonly [tier: string, domain: string] {
  const colonIdx = scope.indexOf(":");
  return [scope.slice(0, colonIdx), scope.slice(colonIdx + 1)] as const;
}

/**
 * Check whether an auth context satisfies a required scope.
 *
 * - Session auth always returns true (full access).
 * - API key auth checks the scope hierarchy:
 *   full > delete-all > write-all > read-all > delete:X > write:X > read:X
 */
export function hasScope(auth: AuthContext, required: RequiredScope): boolean {
  if (auth.authMethod === "session") return true;

  const scopes: readonly ApiKeyScope[] = auth.apiKeyScopes;
  if (scopes.includes("full")) return true;
  if (required === "full") return false;

  const [tier, domain] = splitScope(required);

  // Check aggregate scopes with hierarchy: delete-all > write-all > read-all.
  if (tier === "read") {
    if (
      scopes.includes("read-all") ||
      scopes.includes("write-all") ||
      scopes.includes("delete-all")
    )
      return true;
  } else if (tier === "write") {
    if (scopes.includes("write-all") || scopes.includes("delete-all")) return true;
  } else if (tier === "delete") {
    if (scopes.includes("delete-all")) return true;
  }

  // Check per-entity hierarchy: delete:X > write:X > read:X.
  const readScope = `read:${domain}` as ApiKeyScope;
  const writeScope = `write:${domain}` as ApiKeyScope;
  const deleteScope = `delete:${domain}` as ApiKeyScope;

  if (tier === "read")
    return (
      scopes.includes(readScope) || scopes.includes(writeScope) || scopes.includes(deleteScope)
    );
  if (tier === "write") return scopes.includes(writeScope) || scopes.includes(deleteScope);
  return scopes.includes(deleteScope);
}
