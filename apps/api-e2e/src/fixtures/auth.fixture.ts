/**
 * Playwright fixtures for authenticated API requests.
 *
 * Each test using `registeredAccount` gets a freshly registered account
 * with a unique email and valid session token. Tests needing IDOR
 * verification also get `secondRegisteredAccount` / `secondAuthHeaders`.
 */
import crypto from "node:crypto";

import { test as base, type APIRequestContext } from "@playwright/test";

import { ensureCryptoReady } from "./crypto.fixture.js";
import { asAuthHeaders } from "./http.constants.js";

import type { AuthHeaders } from "./http.constants.js";

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

export interface AuthFixtures {
  /** A freshly registered account with session token. */
  registeredAccount: AccountInfo;
  /** Pre-built Authorization header for the registered account. */
  authHeaders: AuthHeaders;
  /** A second freshly registered account for IDOR / cross-account tests. */
  secondRegisteredAccount: AccountInfo;
  /** Pre-built Authorization header for the second account. */
  secondAuthHeaders: AuthHeaders;
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
    await ensureCryptoReady();
    const account = await registerUniqueAccount(request);
    await use(account);
  },
  authHeaders: async ({ registeredAccount }, use) => {
    await use(asAuthHeaders({ Authorization: `Bearer ${registeredAccount.sessionToken}` }));
  },
  secondRegisteredAccount: async ({ request }, use) => {
    const account = await registerUniqueAccount(request);
    await use(account);
  },
  secondAuthHeaders: async ({ secondRegisteredAccount }, use) => {
    await use(asAuthHeaders({ Authorization: `Bearer ${secondRegisteredAccount.sessionToken}` }));
  },
});

export { expect } from "@playwright/test";
