import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { ANTI_ENUM_SALT_SECRET_MIN_LENGTH } from "./routes/auth/auth.constants.js";
import { DEFAULT_PORT, MAX_PORT } from "./server.constants.js";

const isProduction = process.env["NODE_ENV"] === "production";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    TRUST_PROXY: z
      .enum(["0", "1"])
      .default("0")
      .transform((v) => v === "1"),
    DISABLE_RATE_LIMIT: z
      .enum(["0", "1"])
      .default("0")
      .transform((v) => {
        if (v === "1" && isProduction) {
          process.stderr.write(
            "CRITICAL: DISABLE_RATE_LIMIT=1 is not allowed in production. Forcing rate limiting ON.\n",
          );
          return false;
        }
        return v === "1";
      }),
    CORS_ORIGIN: z.string().optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    EMAIL_HASH_PEPPER: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .optional()
      .refine((v) => !isProduction || v !== undefined, {
        message: "EMAIL_HASH_PEPPER is required in production",
      }),
    EMAIL_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .optional()
      .refine((v) => !isProduction || v !== undefined, {
        message: "EMAIL_ENCRYPTION_KEY is required in production",
      }),
    WEBHOOK_PAYLOAD_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .optional()
      .refine((v) => !isProduction || v !== undefined, {
        message: "WEBHOOK_PAYLOAD_ENCRYPTION_KEY is required in production",
      }),
    API_KEY_HMAC_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .optional()
      .refine((v) => !isProduction || v !== undefined, {
        message: "API_KEY_HMAC_KEY is required in production",
      }),
    // Anti-enumeration salt secret. Mixed into the BLAKE2B of an unknown
    // email to produce a deterministic fake KDF salt so login probes
    // can't distinguish existing accounts by salt stability. Must be at
    // least 32 chars so a leaked default isn't trivially usable. Required
    // in production — the dev default ("pluralscape-dev-...") is explicitly
    // rejected here so a forgotten override can't ship to a prod build.
    ANTI_ENUM_SALT_SECRET: z
      .string()
      .min(ANTI_ENUM_SALT_SECRET_MIN_LENGTH, {
        message: `ANTI_ENUM_SALT_SECRET must be at least ${String(ANTI_ENUM_SALT_SECRET_MIN_LENGTH)} characters`,
      })
      .optional()
      .refine((v) => !isProduction || v !== undefined, {
        message: "ANTI_ENUM_SALT_SECRET is required in production",
      })
      .refine((v) => !isProduction || !v?.startsWith("pluralscape-dev-"), {
        message: "ANTI_ENUM_SALT_SECRET must not be the development default in production",
      }),
    BLOB_STORAGE_S3_BUCKET: z.string().optional(),
    BLOB_STORAGE_S3_REGION: z.string().default("us-east-1"),
    BLOB_STORAGE_S3_ENDPOINT: z
      .string()
      .refine((v) => URL.canParse(v), { message: "Invalid URL" })
      .optional(),
    BLOB_STORAGE_S3_FORCE_PATH_STYLE: z
      .enum(["0", "1"])
      .default("0")
      .transform((v) => v === "1"),
    BLOB_STORAGE_PATH: z.string().default("./data/blobs"),
    VALKEY_URL: z
      .string()
      .refine((v) => URL.canParse(v), { message: "Invalid URL" })
      .optional(),
    // Explicit opt-in to the per-process in-memory cache fallback in
    // NODE_ENV=production. Without this flag, `getI18nDeps()` refuses to
    // construct the fallback so operators can't silently degrade a
    // multi-replica deployment. Only safe for single-instance production.
    ALLOW_IN_MEMORY_CACHE: z.enum(["0", "1"]).optional(),
    EMAIL_PROVIDER: z.enum(["resend", "smtp", "stub"]).default("stub"),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(MAX_PORT).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_SECURE: z
      .enum(["0", "1"])
      .default("0")
      .transform((v) => v === "1"),
    CROWDIN_DISTRIBUTION_HASH: z
      .string()
      .min(1)
      .optional()
      .refine((v) => !isProduction || v !== undefined, {
        message: "CROWDIN_DISTRIBUTION_HASH is required in production",
      }),
    // Overridable base URL for the Crowdin OTA CDN. Defaults to the public
    // distribution host; E2E tests point this at a local stub server so the
    // suite doesn't depend on the live CDN being reachable.
    CROWDIN_OTA_BASE_URL: z
      .string()
      .refine((v) => URL.canParse(v), { message: "Invalid URL" })
      .default("https://distributions.crowdin.net"),
  },
  runtimeEnv: process.env,
});
