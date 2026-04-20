/**
 * Shared helpers for tests that mutate `process.env` to exercise env.ts
 * schema validation. Each helper saves the original values, applies the
 * requested overrides, runs the callback, and restores the originals in a
 * finally block — so tests compose naturally inside describe/it without
 * manual beforeEach/afterEach bookkeeping.
 */

/**
 * Production-required env vars populated with dummy-but-schema-valid
 * values. Tests that flip `NODE_ENV=production` pair this with whichever
 * specific secret they want to probe.
 */
const DEFAULT_PROD_REQUIRED_ENV: Record<string, string> = {
  EMAIL_HASH_PEPPER: "a".repeat(64),
  EMAIL_ENCRYPTION_KEY: "b".repeat(64),
  WEBHOOK_PAYLOAD_ENCRYPTION_KEY: "c".repeat(64),
  API_KEY_HMAC_KEY: "d".repeat(64),
  CROWDIN_DISTRIBUTION_HASH: "test-hash",
  ANTI_ENUM_SALT_SECRET: "z".repeat(36),
};

/**
 * Snapshot the current values for every key in `keys`, then return a
 * restore function that puts them back exactly — including deleting keys
 * that were originally absent.
 */
function snapshotEnv(keys: readonly string[]): () => void {
  const snapshot = new Map<string, string | undefined>();
  for (const key of keys) {
    snapshot.set(key, process.env[key]);
  }
  return () => {
    for (const [key, value] of snapshot) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  };
}

/**
 * Run `fn` with the given env overrides applied on top of the default
 * production-required keys (which themselves default to `NODE_ENV=production`
 * unless an override says otherwise). Keys set to `undefined` in
 * `overrides` are deleted from the environment for the duration of `fn`.
 *
 * Every touched key is restored to its original value afterwards,
 * including across early returns and thrown exceptions.
 *
 * @example
 *   await withProdEnv({ ANTI_ENUM_SALT_SECRET: undefined }, async () => {
 *     await expect(import("../env.js")).rejects.toThrow(/Invalid environment/);
 *   });
 */
export async function withProdEnv<T>(
  overrides: Readonly<Record<string, string | undefined>>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const touchedKeys = new Set<string>(["NODE_ENV", ...Object.keys(DEFAULT_PROD_REQUIRED_ENV)]);
  for (const key of Object.keys(overrides)) touchedKeys.add(key);

  const restore = snapshotEnv([...touchedKeys]);
  try {
    process.env["NODE_ENV"] = "production";
    for (const [key, value] of Object.entries(DEFAULT_PROD_REQUIRED_ENV)) {
      process.env[key] = value;
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
    return await fn();
  } finally {
    restore();
  }
}

/**
 * Variant of {@link withProdEnv} for `NODE_ENV=development` (or any
 * non-production value). Does NOT populate the production-required
 * secrets; they're optional in development.
 */
export async function withEnv<T>(
  nodeEnv: "development" | "test",
  overrides: Readonly<Record<string, string | undefined>>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const touchedKeys = new Set<string>(["NODE_ENV", ...Object.keys(overrides)]);
  const restore = snapshotEnv([...touchedKeys]);
  try {
    process.env["NODE_ENV"] = nodeEnv;
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
    return await fn();
  } finally {
    restore();
  }
}
