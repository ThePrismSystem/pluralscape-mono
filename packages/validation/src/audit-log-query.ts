import { PAGINATION } from "@pluralscape/types";
import { z } from "zod/v4";

import { MAX_CURSOR_LENGTH, MAX_QUERY_PARAM_STRING_LENGTH } from "./validation.constants.js";

export const AuditLogQuerySchema = z.object({
  event_type: z.string().max(MAX_QUERY_PARAM_STRING_LENGTH).optional(),
  resource_type: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .max(MAX_QUERY_PARAM_STRING_LENGTH)
    .optional(),
  from: z.coerce.number().int().min(0).optional(),
  to: z.coerce.number().int().min(0).optional(),
  cursor: z.string().max(MAX_CURSOR_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});
