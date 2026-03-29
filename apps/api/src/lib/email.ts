import type { EmailAdapter } from "@pluralscape/email";

let cachedAdapter: EmailAdapter | null = null;

/**
 * Get the shared email adapter.
 * Must be initialized via setEmailAdapterForTesting() in tests
 * or via initEmailAdapter() at app startup.
 */
export function getEmailAdapter(): EmailAdapter {
  if (!cachedAdapter) {
    throw new Error("Email adapter not initialized — call initEmailAdapter() at startup");
  }
  return cachedAdapter;
}

/** Initialize the email adapter (called at app startup). */
export function initEmailAdapter(adapter: EmailAdapter): void {
  cachedAdapter = adapter;
}

/** Set the email adapter directly (for testing). */
export function setEmailAdapterForTesting(adapter: EmailAdapter): void {
  cachedAdapter = adapter;
}

/** Reset the email adapter cache (for testing). */
export function _resetEmailAdapterForTesting(): void {
  cachedAdapter = null;
}
