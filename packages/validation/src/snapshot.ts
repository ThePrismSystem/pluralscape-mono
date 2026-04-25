import { z } from "zod/v4";

import { brandedIdQueryParam } from "./branded-id.js";
import { MAX_ENCRYPTED_DATA_SIZE } from "./validation.constants.js";

export const CreateSnapshotBodySchema = z
  .object({
    snapshotTrigger: z.enum(["manual", "scheduled-daily", "scheduled-weekly"]),
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_DATA_SIZE),
  })
  .readonly();

export const DuplicateSystemBodySchema = z
  .object({
    snapshotId: brandedIdQueryParam("snap_"),
  })
  .readonly();
