/**
 * Shared types and resolver-builder helpers for the endpoint registry.
 *
 * All resolver helpers return a {@link Resolver} that creates any prerequisite
 * resources (members, groups, etc.) for a given endpoint and returns the URL
 * and optional request body needed by security tests.
 */
import { encryptForApi } from "../crypto.fixture.js";
import { getSystemId } from "../entity-helpers.js";

import type { AuthHeaders, EndpointLabel, HttpMethod } from "../http.constants.js";
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

export type Resolver = EndpointDescriptor["resolve"];

/** Build a resolver for simple system-scoped list endpoints. */
export function systemList(resource: string): Resolver {
  return async (request: APIRequestContext, headers: AuthHeaders) => {
    const systemId = await getSystemId(request, headers);
    return { url: `/v1/systems/${systemId}/${resource}` };
  };
}

/** Build a resolver for simple non-scoped static endpoints. */
export function staticUrl(url: string, body?: unknown): Resolver {
  return () => Promise.resolve({ url, body });
}

/** Build a system-scoped resolver using a path suffix after the system ID. */
export function systemPath(suffix: string): Resolver {
  return async (request: APIRequestContext, headers: AuthHeaders) => {
    const systemId = await getSystemId(request, headers);
    return { url: `/v1/systems/${systemId}${suffix}` };
  };
}

export function systemCreateThenPut(
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

export function systemCreateThenDelete(
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
