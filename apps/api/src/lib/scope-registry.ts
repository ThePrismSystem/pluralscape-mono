import { REST_ENTRIES } from "./scope-registry/rest-entries.js";
import { TRPC_ENTRIES } from "./scope-registry/trpc-entries.js";

import type { RequiredScope } from "@pluralscape/types";

/** A single scope entry in the registry. */
export interface ScopeEntry {
  readonly scope: RequiredScope;
}

/** Central registry mapping REST routes and tRPC procedures to their required scopes. */
export interface ScopeRegistry {
  /** Keyed by `"METHOD /path/with/:params"` (no `/v1` prefix). */
  readonly rest: ReadonlyMap<string, ScopeEntry>;
  /** Keyed by `"router.procedure"` or `"router.sub.procedure"`. */
  readonly trpc: ReadonlyMap<string, ScopeEntry>;
}

function buildRegistry(): ScopeRegistry {
  const rest = new Map<string, ScopeEntry>();
  for (const [key, scope] of REST_ENTRIES) {
    if (rest.has(key)) {
      throw new Error(`Duplicate REST scope registry key: "${key}"`);
    }
    rest.set(key, { scope });
  }

  const trpc = new Map<string, ScopeEntry>();
  for (const [key, scope] of TRPC_ENTRIES) {
    if (trpc.has(key)) {
      throw new Error(`Duplicate tRPC scope registry key: "${key}"`);
    }
    trpc.set(key, { scope });
  }

  return { rest, trpc };
}

/** Central registry of required scopes for all REST routes and tRPC procedures. */
export const SCOPE_REGISTRY: ScopeRegistry = buildRegistry();
