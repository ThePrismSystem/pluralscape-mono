import { SCOPE_DOMAINS } from "@pluralscape/types";

import type { AuthContext } from "./auth-context.js";
import type { ApiKeyScope, RequiredScope, ScopeDomain, ScopeTier } from "@pluralscape/types";

/** Numeric tier levels — higher number = more privilege. */
const TIER_LEVEL: Record<ScopeTier, number> = { read: 0, write: 1, delete: 2 };

const SCOPE_TIERS: readonly ScopeTier[] = ["read", "write", "delete"];

/** Aggregate scope names indexed by tier. */
const AGGREGATE_SCOPES: Record<ScopeTier, ApiKeyScope> = {
  read: "read-all",
  write: "write-all",
  delete: "delete-all",
};

const VALID_DOMAINS: ReadonlySet<string> = new Set([...SCOPE_DOMAINS, "audit-log"]);

function isScopeTier(value: string): value is ScopeTier {
  return value === "read" || value === "write" || value === "delete";
}

/**
 * Split a per-entity scope like "read:members" into its tier and domain.
 * Only called for per-entity scopes — "full" is handled before this.
 */
function splitScope(
  scope: RequiredScope,
): readonly [tier: ScopeTier, domain: ScopeDomain | "audit-log"] {
  const colonIdx = scope.indexOf(":");
  const tier = scope.slice(0, colonIdx);
  if (!isScopeTier(tier)) {
    throw new Error(`Invalid scope tier in "${scope}"`);
  }
  const domain = scope.slice(colonIdx + 1);
  if (!VALID_DOMAINS.has(domain)) {
    throw new Error(`Invalid scope domain in "${scope}"`);
  }
  return [tier, domain as ScopeDomain | "audit-log"] as const;
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

  const [requiredTier, domain] = splitScope(required);
  const requiredLevel = TIER_LEVEL[requiredTier];

  // audit-log is a read-only domain outside SCOPE_DOMAINS — no write/delete variants exist.
  if (domain === "audit-log") {
    if (requiredTier !== "read") return false;
    return (
      scopes.includes("read:audit-log") ||
      scopes.includes("read-all") ||
      scopes.includes("write-all") ||
      scopes.includes("delete-all")
    );
  }

  // Check aggregate and per-entity scopes: any tier at or above the required level grants access.
  for (const tier of SCOPE_TIERS) {
    if (TIER_LEVEL[tier] >= requiredLevel) {
      if (scopes.includes(AGGREGATE_SCOPES[tier])) return true;
      if (scopes.includes(`${tier}:${domain}`)) return true;
    }
  }

  return false;
}
