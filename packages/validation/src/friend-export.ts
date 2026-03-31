import { FRIEND_EXPORT_ENTITY_TYPES } from "@pluralscape/types";
import { z } from "zod/v4";

import { MAX_CURSOR_LENGTH } from "./validation.constants.js";

/** Default page size for friend data export. */
const FRIEND_EXPORT_DEFAULT_LIMIT = 50;

/** Maximum page size for friend data export. */
const FRIEND_EXPORT_MAX_LIMIT = 100;

/** Validates query parameters for the friend data export endpoint. */
export const FriendExportQuerySchema = z.object({
  entityType: z.enum(FRIEND_EXPORT_ENTITY_TYPES),
  cursor: z.string().max(MAX_CURSOR_LENGTH).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(FRIEND_EXPORT_MAX_LIMIT)
    .default(FRIEND_EXPORT_DEFAULT_LIMIT),
});
