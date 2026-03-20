import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { DEFAULT_PORT, MAX_PORT } from "./server.constants.js";

const isTest = process.env["NODE_ENV"] === "test";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().min(1).max(MAX_PORT).default(DEFAULT_PORT),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
    TRUST_PROXY: z.enum(["0", "1"]).default("0"),
    DISABLE_RATE_LIMIT: z.enum(["0", "1"]).default("0"),
    CORS_ORIGIN: z.string().optional(),
    ALLOWED_ORIGINS: z.string().optional(),
    EMAIL_HASH_PEPPER: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/)
      .optional(),
    BLOB_STORAGE_S3_BUCKET: z.string().optional(),
    BLOB_STORAGE_S3_REGION: z.string().default("us-east-1"),
    BLOB_STORAGE_S3_ENDPOINT: z.string().optional(),
    BLOB_STORAGE_S3_FORCE_PATH_STYLE: z.enum(["0", "1"]).default("0"),
    BLOB_STORAGE_PATH: z.string().default("./data/blobs"),
    VALKEY_URL: z.string().optional(),
  },
  runtimeEnv: isTest
    ? {
        ...process.env,
        NODE_ENV: process.env["NODE_ENV"] ?? "test",
        API_PORT: process.env["API_PORT"] ?? String(DEFAULT_PORT),
        LOG_LEVEL: process.env["LOG_LEVEL"] ?? "info",
        TRUST_PROXY: process.env["TRUST_PROXY"] ?? "0",
        DISABLE_RATE_LIMIT: process.env["DISABLE_RATE_LIMIT"] ?? "0",
        BLOB_STORAGE_S3_REGION: process.env["BLOB_STORAGE_S3_REGION"] ?? "us-east-1",
        BLOB_STORAGE_S3_FORCE_PATH_STYLE: process.env["BLOB_STORAGE_S3_FORCE_PATH_STYLE"] ?? "0",
        BLOB_STORAGE_PATH: process.env["BLOB_STORAGE_PATH"] ?? "./data/blobs",
      }
    : process.env,
});
