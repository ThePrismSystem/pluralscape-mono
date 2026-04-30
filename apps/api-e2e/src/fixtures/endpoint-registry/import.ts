/**
 * Endpoint descriptors for import-entity-refs endpoints.
 *
 * Covers bulk lookup and upsert of cross-source entity reference mappings
 * (e.g., Simply Plural member IDs mapped to Pluralscape member IDs).
 */
import { getSystemId } from "../entity-helpers.js";

import type { EndpointDescriptor } from "./helpers.js";
import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

export const importEndpoints: EndpointDescriptor[] = [
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
