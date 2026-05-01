/**
 * Endpoint descriptors for system read endpoints.
 *
 * Covers GET /v1/systems, GET /v1/systems/:id, and all system sub-resource
 * list endpoints including members, groups, custom fronts, fields, fronting
 * sessions, channels, notes, polls, webhooks, blobs, buckets, relationships,
 * api-keys, snapshots, timers, check-ins, lifecycle events, device tokens,
 * notifications, acknowledgements, board messages, structure, and innerworld.
 */
import { systemList, systemPath, staticUrl } from "./helpers.js";

import type { EndpointDescriptor } from "./helpers.js";

export const systemEndpoints: EndpointDescriptor[] = [
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
