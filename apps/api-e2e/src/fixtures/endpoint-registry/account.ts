/**
 * Endpoint descriptors for account and session routes.
 *
 * Covers /v1/account (read, update, delete, audit-log, friends, friend-codes)
 * and /v1/auth/sessions.
 */
import { staticUrl } from "./helpers.js";

import type { EndpointDescriptor } from "./helpers.js";

export const accountEndpoints: EndpointDescriptor[] = [
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

  // ── Account mutations ──────────────────────────────────────────────
  {
    method: "PUT",
    label: "PUT /v1/account",
    systemScoped: false,
    resolve: staticUrl("/v1/account", { encryptedData: "x" }),
  },
];
