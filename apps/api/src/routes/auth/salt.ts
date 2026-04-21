import { PWHASH_SALT_BYTES, getSodium } from "@pluralscape/crypto";
import { accounts } from "@pluralscape/db/pg";
import { SaltFetchSchema } from "@pluralscape/validation";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { env } from "../../env.js";
import { equalizeAntiEnumTiming } from "../../lib/anti-enum-timing.js";
import { getDb } from "../../lib/db.js";
import { hashEmail } from "../../lib/email-hash.js";
import { toHex } from "../../lib/hex.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";

export const saltRoute = new Hono();

saltRoute.use("*", createCategoryRateLimiter("authHeavy"));

saltRoute.post("/", async (c) => {
  const startTime = performance.now();
  const body = await parseJsonBody(c);
  const parsed = SaltFetchSchema.parse(body);

  const emailHash = hashEmail(parsed.email);
  const db = await getDb();

  const [account] = await db
    .select({ kdfSalt: accounts.kdfSalt })
    .from(accounts)
    .where(eq(accounts.emailHash, emailHash))
    .limit(1);

  if (account) {
    await equalizeAntiEnumTiming(startTime);
    return c.json(envelope({ kdfSalt: account.kdfSalt }));
  }

  // Deterministic fake salt: BLAKE2B(PWHASH_SALT_BYTES, email, secret)
  // so the same email always gets the same fake salt (prevents enumeration).
  // env.ANTI_ENUM_SALT_SECRET is validated at boot (required and >=32 chars
  // in production; dev default rejected). Fall through to the dev default
  // only when the env var is unset outside production.
  //
  // The dynamic import is only reached when env.ANTI_ENUM_SALT_SECRET is
  // undefined, which Zod refines in env.ts guarantee cannot happen in
  // production — so the dev-constants module is dead code in prod bundles.
  const adapter = getSodium();
  let secret: string;
  if (env.ANTI_ENUM_SALT_SECRET !== undefined) {
    secret = env.ANTI_ENUM_SALT_SECRET;
  } else if (process.env["NODE_ENV"] !== "production") {
    const { ANTI_ENUM_SALT_SECRET_DEFAULT } = await import("../../lib/dev-constants.js");
    secret = ANTI_ENUM_SALT_SECRET_DEFAULT;
  } else {
    // Should never reach here — Zod refines in env.ts guarantee
    // ANTI_ENUM_SALT_SECRET is set in production.
    throw new Error("ANTI_ENUM_SALT_SECRET is required in production");
  }
  const secretBytes = new TextEncoder().encode(secret);
  const emailBytes = new TextEncoder().encode(parsed.email.toLowerCase().trim());

  const fakeSalt = adapter.genericHash(PWHASH_SALT_BYTES, emailBytes, secretBytes);
  await equalizeAntiEnumTiming(startTime);
  return c.json(envelope({ kdfSalt: toHex(fakeSalt) }));
});
