import { PAGINATION } from "@pluralscape/types";
import { z } from "zod/v4";

export const AuditLogQuerySchema = z.object({
  event_type: z.string().optional(),
  resource_type: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/)
    .optional(),
  from: z.coerce.number().int().min(0).optional(),
  to: z.coerce.number().int().min(0).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
});
