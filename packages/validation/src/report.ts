import { BUCKET_CONTENT_ENTITY_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { MAX_CURSOR_LENGTH, MAX_LOCALE_LENGTH } from "./validation.constants.js";

/** Maximum length for a report title. */
export const MAX_REPORT_TITLE_LENGTH = 200;

/** Default page size for bucket export. */
export const BUCKET_EXPORT_DEFAULT_LIMIT = 50;

/** Maximum page size for bucket export. */
export const BUCKET_EXPORT_MAX_LIMIT = 100;

// ── Shared field schemas ──────────────────────────────────────────

const titleSchema = z.string().min(1).max(MAX_REPORT_TITLE_LENGTH).optional();
const localeSchema = z.string().max(MAX_LOCALE_LENGTH).optional();

// ── GenerateReportBodySchema ──────────────────────────────────────

const MemberByBucketSchema = z.object({
  reportType: z.literal("member-by-bucket"),
  bucketId: brandedIdQueryParam("bkt_"),
  title: titleSchema,
  locale: localeSchema,
});

const MeetOurSystemSchema = z.object({
  reportType: z.literal("meet-our-system"),
  title: titleSchema,
  locale: localeSchema,
});

/** Validates the body for report generation requests. */
export const GenerateReportBodySchema = z.discriminatedUnion("reportType", [
  MemberByBucketSchema,
  MeetOurSystemSchema,
]);

// ── BucketExportQuerySchema ───────────────────────────────────────

/** Validates query parameters for the bucket export endpoint. */
export const BucketExportQuerySchema = z.object({
  entityType: z.enum(BUCKET_CONTENT_ENTITY_TYPES),
  cursor: z.string().max(MAX_CURSOR_LENGTH).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BUCKET_EXPORT_MAX_LIMIT)
    .default(BUCKET_EXPORT_DEFAULT_LIMIT),
});
