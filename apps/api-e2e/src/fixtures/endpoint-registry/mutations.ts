/**
 * Endpoint descriptors for system sub-resource mutation endpoints.
 *
 * Covers PUT and DELETE operations for members, groups, custom fronts,
 * fields, channels, timer configs, lifecycle events, snapshots, and
 * innerworld structure (entity types and entities).
 */
import { encryptForApi } from "../crypto.fixture.js";
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
} from "../entity-helpers.js";

import { systemCreateThenDelete, systemCreateThenPut } from "./helpers.js";

import type { EndpointDescriptor } from "./helpers.js";
import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

export const mutationEndpoints: EndpointDescriptor[] = [
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

  // ── Structure mutations ────────────────────────────────────────────
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
];
