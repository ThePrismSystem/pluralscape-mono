/**
 * Playwright fixtures for authenticated API requests.
 *
 * Each test using `registeredAccount` gets a freshly registered account
 * with a unique email and valid session token. Tests needing IDOR
 * verification also get `secondRegisteredAccount` / `secondAuthHeaders`.
 */
import crypto from "node:crypto";

import { test as base, type APIRequestContext } from "@playwright/test";

interface RegisterData {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  accountType: string;
}

interface RegisterResponse {
  data: RegisterData;
}

interface AccountInfo extends RegisterData {
  email: string;
  password: string;
}

interface AuthFixtures {
  /** A freshly registered account with session token. */
  registeredAccount: AccountInfo;
  /** Pre-built Authorization header for the registered account. */
  authHeaders: Record<string, string>;
  /** A second freshly registered account for IDOR / cross-account tests. */
  secondRegisteredAccount: AccountInfo;
  /** Pre-built Authorization header for the second account. */
  secondAuthHeaders: Record<string, string>;
}

async function registerUniqueAccount(request: APIRequestContext): Promise<AccountInfo> {
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

  const envelope = (await res.json()) as RegisterResponse;
  return { ...envelope.data, email, password };
}

export const test = base.extend<AuthFixtures>({
  registeredAccount: async ({ request }, use) => {
    const account = await registerUniqueAccount(request);
    await use(account);
  },
  authHeaders: async ({ registeredAccount }, use) => {
    await use({ Authorization: `Bearer ${registeredAccount.sessionToken}` });
  },
  secondRegisteredAccount: async ({ request }, use) => {
    const account = await registerUniqueAccount(request);
    await use(account);
  },
  secondAuthHeaders: async ({ secondRegisteredAccount }, use) => {
    await use({ Authorization: `Bearer ${secondRegisteredAccount.sessionToken}` });
  },
});

export { expect } from "@playwright/test";
