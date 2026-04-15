import { PWHASH_SALT_BYTES, getSodium } from "@pluralscape/crypto";
import { accounts } from "@pluralscape/db/pg";
import { SaltFetchSchema } from "@pluralscape/validation";
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { equalizeAntiEnumTiming } from "../../lib/anti-enum-timing.js";
import { getDb } from "../../lib/db.js";
import { hashEmail } from "../../lib/email-hash.js";
import { toHex } from "../../lib/hex.js";
import { parseJsonBody } from "../../lib/parse-json-body.js";
import { envelope } from "../../lib/response.js";
import { createCategoryRateLimiter } from "../../middleware/rate-limit.js";

import { ANTI_ENUM_SALT_SECRET_DEFAULT, ANTI_ENUM_SALT_SECRET_ENV } from "./auth.constants.js";

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
  // so the same email always gets the same fake salt (prevents enumeration)
  const adapter = getSodium();
  const secret = process.env[ANTI_ENUM_SALT_SECRET_ENV] ?? ANTI_ENUM_SALT_SECRET_DEFAULT;
  const secretBytes = new TextEncoder().encode(secret);
  const emailBytes = new TextEncoder().encode(parsed.email.toLowerCase().trim());

  const fakeSalt = adapter.genericHash(PWHASH_SALT_BYTES, emailBytes, secretBytes);
  await equalizeAntiEnumTiming(startTime);
  return c.json(envelope({ kdfSalt: toHex(fakeSalt) }));
});
