/**
 * Endpoint registry for systematic security tests.
 *
 * Each entry describes a protected API endpoint. The security test files
 * iterate this registry to verify auth rejection, IDOR prevention, and
 * error shape across the entire API surface.
 */
import { encryptForApi } from "./crypto.fixture.js";
import {
  createChannel,
  createCustomFront,
  createFieldDefinition,
  createGroup,
  createLifecycleEvent,
  createMember,
  createSnapshot,
  createStructureEntity,
  createStructureEntityType,
  createTimerConfig,
  getSystemId,
} from "./entity-helpers.js";

import type { AuthHeaders, EndpointLabel, HttpMethod } from "./http.constants.js";
import type { APIRequestContext } from "@playwright/test";

export interface EndpointDescriptor {
  method: HttpMethod;
  /** Human-readable label for test names. */
  label: EndpointLabel;
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

function systemCreateThenPut(
  resource: string,
  createFn: (
    request: APIRequestContext,
    headers: AuthHeaders,
    systemId: string,
  ) => Promise<{ id: string; version: number }>,
): Resolver {
  return async (request: APIRequestContext, headers: AuthHeaders) => {
    const systemId = await getSystemId(request, headers);
    const entity = await createFn(request, headers, systemId);
    return {
      url: `/v1/systems/${systemId}/${resource}/${entity.id}`,
      body: { encryptedData: encryptForApi({ name: "Updated" }), version: entity.version },
    };
  };
}

function systemCreateThenDelete(
  resource: string,
  createFn: (
    request: APIRequestContext,
    headers: AuthHeaders,
    systemId: string,
  ) => Promise<{ id: string }>,
): Resolver {
  return async (request: APIRequestContext, headers: AuthHeaders) => {
    const systemId = await getSystemId(request, headers);
    const entity = await createFn(request, headers, systemId);
    return { url: `/v1/systems/${systemId}/${resource}/${entity.id}` };
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

  // ── Account mutations ──────────────────────────────────────────────
  {
    method: "PUT",
    label: "PUT /v1/account",
    systemScoped: false,
    resolve: staticUrl("/v1/account", { encryptedData: "x" }),
  },

  // ── System sub-resource mutations ──────────────────────────────────
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/members/:memberId",
    systemScoped: true,
    resolve: systemCreateThenPut("members", createMember),
  },
  {
    method: "DELETE",
    label: "DELETE /v1/systems/:id/members/:memberId",
    systemScoped: true,
    resolve: systemCreateThenDelete("members", createMember),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/groups/:groupId",
    systemScoped: true,
    resolve: systemCreateThenPut("groups", createGroup),
  },
  {
    method: "DELETE",
    label: "DELETE /v1/systems/:id/groups/:groupId",
    systemScoped: true,
    resolve: systemCreateThenDelete("groups", createGroup),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/custom-fronts/:customFrontId",
    systemScoped: true,
    resolve: systemCreateThenPut("custom-fronts", createCustomFront),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/fields/:fieldId",
    systemScoped: true,
    resolve: systemCreateThenPut("fields", createFieldDefinition),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/channels/:channelId",
    systemScoped: true,
    resolve: systemCreateThenPut("channels", createChannel),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/timer-configs/:timerId",
    systemScoped: true,
    resolve: systemCreateThenPut("timer-configs", createTimerConfig),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/lifecycle-events/:eventId",
    systemScoped: true,
    resolve: systemCreateThenPut("lifecycle-events", createLifecycleEvent),
  },
  {
    method: "DELETE",
    label: "DELETE /v1/systems/:id/lifecycle-events/:eventId",
    systemScoped: true,
    resolve: systemCreateThenDelete("lifecycle-events", createLifecycleEvent),
  },
  {
    method: "DELETE",
    label: "DELETE /v1/systems/:id/snapshots/:snapshotId",
    systemScoped: true,
    resolve: systemCreateThenDelete("snapshots", createSnapshot),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/structure/entity-types/:entityTypeId",
    systemScoped: true,
    resolve: async (
      request: APIRequestContext,
      headers: AuthHeaders,
    ): Promise<{ url: string; body?: unknown }> => {
      const systemId = await getSystemId(request, headers);
      const entityType = await createStructureEntityType(request, headers, systemId);
      return {
        url: `/v1/systems/${systemId}/structure/entity-types/${entityType.id}`,
        body: {
          encryptedData: encryptForApi({ name: "Updated" }),
          sortOrder: 0,
          version: entityType.version,
        },
      };
    },
  },
  {
    method: "DELETE",
    label: "DELETE /v1/systems/:id/structure/entity-types/:entityTypeId",
    systemScoped: true,
    resolve: systemCreateThenDelete("structure/entity-types", createStructureEntityType),
  },
  {
    method: "PUT",
    label: "PUT /v1/systems/:id/structure/entities/:entityId",
    systemScoped: true,
    resolve: async (
      request: APIRequestContext,
      headers: AuthHeaders,
    ): Promise<{ url: string; body?: unknown }> => {
      const systemId = await getSystemId(request, headers);
      const entityType = await createStructureEntityType(request, headers, systemId);
      const entity = await createStructureEntity(request, headers, systemId, entityType.id);
      return {
        url: `/v1/systems/${systemId}/structure/entities/${entity.id}`,
        body: {
          encryptedData: encryptForApi({ name: "Updated" }),
          parentEntityId: null,
          sortOrder: 0,
          version: entity.version,
        },
      };
    },
  },
  {
    method: "DELETE",
    label: "DELETE /v1/systems/:id/structure/entities/:entityId",
    systemScoped: true,
    resolve: async (
      request: APIRequestContext,
      headers: AuthHeaders,
    ): Promise<{ url: string; body?: unknown }> => {
      const systemId = await getSystemId(request, headers);
      const entityType = await createStructureEntityType(request, headers, systemId);
      const entity = await createStructureEntity(request, headers, systemId, entityType.id);
      return { url: `/v1/systems/${systemId}/structure/entities/${entity.id}` };
    },
  },

  // ── Import entity ref batch endpoints ──────────────────────────────
  {
    method: "POST",
    label: "POST /v1/systems/:id/import-entity-refs/lookup-batch",
    systemScoped: true,
    resolve: async (
      request: APIRequestContext,
      headers: AuthHeaders,
    ): Promise<{ url: string; body?: unknown }> => {
      const systemId = await getSystemId(request, headers);
      return {
        url: `/v1/systems/${systemId}/import-entity-refs/lookup-batch`,
        body: {
          source: "simply-plural",
          sourceEntityType: "member",
          sourceEntityIds: ["sp-member-idor-probe"],
        },
      };
    },
  },
  {
    method: "POST",
    label: "POST /v1/systems/:id/import-entity-refs/upsert-batch",
    systemScoped: true,
    resolve: async (
      request: APIRequestContext,
      headers: AuthHeaders,
    ): Promise<{ url: string; body?: unknown }> => {
      const systemId = await getSystemId(request, headers);
      return {
        url: `/v1/systems/${systemId}/import-entity-refs/upsert-batch`,
        body: {
          source: "simply-plural",
          entries: [
            {
              sourceEntityType: "member",
              sourceEntityId: "sp-member-idor-probe",
              pluralscapeEntityId: "mbr_00000000-0000-0000-0000-000000000000",
            },
          ],
        },
      };
    },
  },
];

/** Subset: only system-scoped endpoints (for IDOR tests). */
export const SYSTEM_SCOPED_ENDPOINTS = PROTECTED_ENDPOINTS.filter((ep) => ep.systemScoped);
