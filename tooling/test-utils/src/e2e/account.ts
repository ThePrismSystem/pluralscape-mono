/**
 * Account registration and system discovery helpers for E2E tests.
 */
import crypto from "node:crypto";

import { API_BASE_URL } from "./api-server.js";

import type { SystemId } from "@pluralscape/types";

// ── Registration ─────────────────────────────────────────────────────

interface RegisterData {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  accountType: string;
}

interface RegisterResponse {
  data: RegisterData;
}

export interface RegisteredAccount {
  sessionToken: string;
  recoveryKey: string;
  accountId: string;
  email: string;
  password: string;
}

/**
 * Register a fresh test account against the E2E API server.
 */
export async function registerTestAccount(): Promise<RegisteredAccount> {
  const uuid = crypto.randomUUID();
  const email = `e2e-import-${uuid}@test.pluralscape.local`;
  const password = `E2E-ImportTest-${uuid}`;

  const res = await fetch(`${API_BASE_URL}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      recoveryKeyBackupConfirmed: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Registration failed (${String(res.status)}): ${body}`);
  }

  const envelope = (await res.json()) as RegisterResponse;
  return {
    ...envelope.data,
    email,
    password,
  };
}

// ── System discovery ────────────────────────────────────────────────

interface SystemListItem {
  id: string;
}

interface SystemListResponse {
  data: SystemListItem[];
}

/**
 * Fetch the first system ID for the authenticated account via REST.
 */
export async function getSystemId(sessionToken: string): Promise<SystemId> {
  const res = await fetch(`${API_BASE_URL}/v1/systems`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list systems (${String(res.status)}): ${body}`);
  }

  const body = (await res.json()) as SystemListResponse;
  const first = body.data[0];
  if (!first) {
    throw new Error("No systems found for authenticated account");
  }
  return first.id as SystemId;
}
