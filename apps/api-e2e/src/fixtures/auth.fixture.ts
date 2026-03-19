/**
 * Playwright fixtures for authenticated API requests.
 *
 * Each test using `registeredAccount` gets a freshly registered account
 * with a unique email and valid session token.
 */
import crypto from "node:crypto";

import { test as base, type APIRequestContext } from "@playwright/test";

interface RegisterResponse {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  accountType: string;
}

interface AuthFixtures {
  /** A freshly registered account with session token. */
  registeredAccount: RegisterResponse & { email: string; password: string };
  /** Pre-built Authorization header for the registered account. */
  authHeaders: Record<string, string>;
}

async function registerUniqueAccount(
  request: APIRequestContext,
): Promise<RegisterResponse & { email: string; password: string }> {
  const uuid = crypto.randomUUID();
  const email = `e2e-${uuid}@test.pluralscape.local`;
  const password = `E2E-TestPass-${uuid}`;

  const res = await request.post("/v1/auth/register", {
    data: {
      email,
      password,
      recoveryKeyBackupConfirmed: true,
    },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Registration failed (${String(res.status())}): ${body}`);
  }

  const data = (await res.json()) as RegisterResponse;
  return { ...data, email, password };
}

export const test = base.extend<AuthFixtures>({
  registeredAccount: async ({ request }, use) => {
    const account = await registerUniqueAccount(request);
    await use(account);
  },
  authHeaders: async ({ registeredAccount }, use) => {
    await use({ Authorization: `Bearer ${registeredAccount.sessionToken}` });
  },
});

export { expect } from "@playwright/test";
