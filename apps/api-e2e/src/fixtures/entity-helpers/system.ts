import { expect } from "@playwright/test";

import { encryptForApi } from "../crypto.fixture.js";
import { parseJsonBody } from "../http.constants.js";

import type { AuthHeaders } from "../http.constants.js";
import type { APIRequestContext } from "@playwright/test";

/**
 * Fetch the first system ID for the authenticated account.
 */
export async function getSystemId(
  request: APIRequestContext,
  headers: AuthHeaders,
): Promise<string> {
  const res = await request.get("/v1/systems", { headers });
  expect(res.ok()).toBe(true);
  const body = await parseJsonBody<{ data: Array<{ id: string }> }>(res);
  const first = body.data[0] as { id: string } | undefined;
  if (!first) throw new Error("No systems found for authenticated account");
  return first.id;
}

/**
 * Run the three-step setup wizard so system settings exist.
 *
 * The PIN endpoints require a `system_settings` row which is only
 * created during the setup flow (nomenclature -> profile -> complete).
 */
export async function ensureSystemSetup(
  request: APIRequestContext,
  headers: AuthHeaders,
  systemId: string,
): Promise<void> {
  const nomenclatureRes = await request.post(`/v1/systems/${systemId}/setup/nomenclature`, {
    headers,
    data: { encryptedData: encryptForApi({ terminology: "default" }) },
  });
  expect(nomenclatureRes.ok()).toBe(true);

  const profileRes = await request.post(`/v1/systems/${systemId}/setup/profile`, {
    headers,
    data: { encryptedData: encryptForApi({ name: "E2E System" }) },
  });
  expect(profileRes.ok()).toBe(true);

  const completeRes = await request.post(`/v1/systems/${systemId}/setup/complete`, {
    headers,
    data: {
      encryptedData: encryptForApi({ settings: "default" }),
      recoveryKeyBackupConfirmed: true,
    },
  });
  expect(completeRes.ok()).toBe(true);
}
