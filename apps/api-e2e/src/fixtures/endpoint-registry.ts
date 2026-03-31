/**
 * Endpoint registry for systematic security tests.
 *
 * Each entry describes a protected API endpoint. The security test files
 * iterate this registry to verify auth rejection, IDOR prevention, and
 * error shape across the entire API surface.
 */
import { getSystemId } from "./entity-helpers.js";

import type { AuthHeaders } from "./http.constants.js";
import type { APIRequestContext } from "@playwright/test";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface EndpointDescriptor {
  method: HttpMethod;
  /** Human-readable label for test names. */
  label: string;
  /** Whether this endpoint is system-scoped (IDOR testable). */
  systemScoped: boolean;
  /**
   * Resolve the URL and optional body for this endpoint.
   * Creates any prerequisite resources needed.
   */
  resolve: (
    request: APIRequestContext,
    headers: AuthHeaders,
  ) => Promise<{ url: string; body?: unknown }>;
}

type Resolver = EndpointDescriptor["resolve"];

/** Build a resolver for simple system-scoped list endpoints. */
function systemList(resource: string): Resolver {
  return async (request: APIRequestContext, headers: AuthHeaders) => {
    const systemId = await getSystemId(request, headers);
    return { url: `/v1/systems/${systemId}/${resource}` };
  };
}

/** Build a resolver for simple non-scoped static endpoints. */
function staticUrl(url: string, body?: unknown): Resolver {
  return () => Promise.resolve({ url, body });
}

/** Build a system-scoped resolver using a path suffix after the system ID. */
function systemPath(suffix: string): Resolver {
  return async (request: APIRequestContext, headers: AuthHeaders) => {
    const systemId = await getSystemId(request, headers);
    return { url: `/v1/systems/${systemId}${suffix}` };
  };
}

export const PROTECTED_ENDPOINTS: EndpointDescriptor[] = [
  // ── Account ───────────────────────────────────────────────────────
  {
    method: "GET",
    label: "GET /v1/account",
    systemScoped: false,
    resolve: staticUrl("/v1/account"),
  },
  {
    method: "DELETE",
    label: "DELETE /v1/account",
    systemScoped: false,
    resolve: staticUrl("/v1/account", { password: "x" }),
  },
  {
    method: "GET",
    label: "GET /v1/account/audit-log",
    systemScoped: false,
    resolve: staticUrl("/v1/account/audit-log"),
  },
  {
    method: "GET",
    label: "GET /v1/account/friends",
    systemScoped: false,
    resolve: staticUrl("/v1/account/friends"),
  },
  {
    method: "GET",
    label: "GET /v1/account/friend-codes",
    systemScoped: false,
    resolve: staticUrl("/v1/account/friend-codes"),
  },
  {
    method: "POST",
    label: "POST /v1/account/friend-codes",
    systemScoped: false,
    resolve: staticUrl("/v1/account/friend-codes"),
  },

  // ── Sessions ──────────────────────────────────────────────────────
  {
    method: "GET",
    label: "GET /v1/auth/sessions",
    systemScoped: false,
    resolve: staticUrl("/v1/auth/sessions"),
  },

  // ── Systems ───────────────────────────────────────────────────────
  {
    method: "GET",
    label: "GET /v1/systems",
    systemScoped: false,
    resolve: staticUrl("/v1/systems"),
  },
  {
    method: "POST",
    label: "POST /v1/systems",
    systemScoped: false,
    resolve: staticUrl("/v1/systems"),
  },
  { method: "GET", label: "GET /v1/systems/:id", systemScoped: true, resolve: systemPath("") },

  // ── System sub-resources ──────────────────────────────────────────
  {
    method: "GET",
    label: "GET /v1/systems/:id/members",
    systemScoped: true,
    resolve: systemList("members"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/groups",
    systemScoped: true,
    resolve: systemList("groups"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/custom-fronts",
    systemScoped: true,
    resolve: systemList("custom-fronts"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/fields",
    systemScoped: true,
    resolve: systemList("fields"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/fronting-sessions",
    systemScoped: true,
    resolve: systemList("fronting-sessions"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/channels",
    systemScoped: true,
    resolve: systemList("channels"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/notes",
    systemScoped: true,
    resolve: systemList("notes"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/polls",
    systemScoped: true,
    resolve: systemList("polls"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/webhook-configs",
    systemScoped: true,
    resolve: systemList("webhook-configs"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/blobs",
    systemScoped: true,
    resolve: systemList("blobs"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/buckets",
    systemScoped: true,
    resolve: systemList("buckets"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/relationships",
    systemScoped: true,
    resolve: systemList("relationships"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/api-keys",
    systemScoped: true,
    resolve: systemList("api-keys"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/snapshots",
    systemScoped: true,
    resolve: systemList("snapshots"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/timer-configs",
    systemScoped: true,
    resolve: systemList("timer-configs"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/check-in-records",
    systemScoped: true,
    resolve: systemList("check-in-records"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/lifecycle-events",
    systemScoped: true,
    resolve: systemList("lifecycle-events"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/device-tokens",
    systemScoped: true,
    resolve: systemList("device-tokens"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/notification-configs",
    systemScoped: true,
    resolve: systemList("notification-configs"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/acknowledgements",
    systemScoped: true,
    resolve: systemList("acknowledgements"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/board-messages",
    systemScoped: true,
    resolve: systemList("board-messages"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/structure/entities",
    systemScoped: true,
    resolve: systemPath("/structure/entities"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/structure/entity-types",
    systemScoped: true,
    resolve: systemPath("/structure/entity-types"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/structure/entity-associations",
    systemScoped: true,
    resolve: systemPath("/structure/entity-associations"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/structure/entity-links",
    systemScoped: true,
    resolve: systemPath("/structure/entity-links"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/structure/entity-member-links",
    systemScoped: true,
    resolve: systemPath("/structure/entity-member-links"),
  },
  {
    method: "GET",
    label: "GET /v1/systems/:id/innerworld/regions",
    systemScoped: true,
    resolve: systemPath("/innerworld/regions"),
  },
];

/** Subset: only system-scoped endpoints (for IDOR tests). */
export const SYSTEM_SCOPED_ENDPOINTS = PROTECTED_ENDPOINTS.filter((ep) => ep.systemScoped);
