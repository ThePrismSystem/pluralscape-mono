import { z } from "zod/v4";

import { MAX_ENCRYPTED_PHOTO_DATA_SIZE } from "./validation.constants.js";

const MAX_PHOTOS_PER_MEMBER = 50;

export const CreateMemberPhotoBodySchema = z
  .object({
    encryptedData: z.string().min(1).max(MAX_ENCRYPTED_PHOTO_DATA_SIZE),
    sortOrder: z.int().min(0).optional(),
  })
  .readonly();

export const ReorderPhotosBodySchema = z
  .object({
    order: z
      .array(
        z.object({
          id: z.string().min(1),
          sortOrder: z.int().min(0),
        }),
      )
      .min(1)
      .max(MAX_PHOTOS_PER_MEMBER),
  })
  .readonly();
