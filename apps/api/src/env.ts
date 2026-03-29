import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

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
  },
  runtimeEnv: process.env,
});
