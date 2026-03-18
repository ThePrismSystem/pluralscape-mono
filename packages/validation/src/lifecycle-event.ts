import { z } from "zod/v4";

import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

const LIFECYCLE_EVENT_TYPES = [
  "split",
  "fusion",
  "merge",
  "unmerge",
  "dormancy-start",
  "dormancy-end",
  "discovery",
  "archival",
  "subsystem-formation",
  "form-change",
  "name-change",
  "structure-move",
  "innerworld-move",
] as const;

export const CreateLifecycleEventBodySchema = z
  .object({
    eventType: z.enum(LIFECYCLE_EVENT_TYPES),
    occurredAt: z.int().min(0),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();
