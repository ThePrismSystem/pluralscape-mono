/**
 * Endpoint registry for systematic security tests.
 *
 * Each entry describes a protected API endpoint. The security test files
 * iterate this registry to verify auth rejection, IDOR prevention, and
 * error shape across the entire API surface.
 *
 * This barrel composes per-domain shards from ./endpoint-registry/:
 *   - account   — /v1/account and /v1/auth/sessions
 *   - system    — /v1/systems and system sub-resource list endpoints
 *   - mutations — PUT/DELETE on system sub-resources and structure
 *   - import    — /v1/systems/:id/import-entity-refs/*
 */
import { accountEndpoints } from "./endpoint-registry/account.js";
import { importEndpoints } from "./endpoint-registry/import.js";
import { mutationEndpoints } from "./endpoint-registry/mutations.js";
import { systemEndpoints } from "./endpoint-registry/system.js";

export type { EndpointDescriptor } from "./endpoint-registry/helpers.js";

export const PROTECTED_ENDPOINTS = [
  ...accountEndpoints,
  ...systemEndpoints,
  ...mutationEndpoints,
  ...importEndpoints,
];

/** Subset: only system-scoped endpoints (for IDOR tests). */
export const SYSTEM_SCOPED_ENDPOINTS = PROTECTED_ENDPOINTS.filter((ep) => ep.systemScoped);
