import { z } from "zod/v4";

const NullableString = z.string().nullable().optional();
const PKPrivacyFieldSchema = z.enum(["public", "private"]).optional();

const PKPrivacySchema = z
  .object({
    visibility: PKPrivacyFieldSchema,
    name_privacy: PKPrivacyFieldSchema,
    description_privacy: PKPrivacyFieldSchema,
    birthday_privacy: PKPrivacyFieldSchema,
    pronoun_privacy: PKPrivacyFieldSchema,
    avatar_privacy: PKPrivacyFieldSchema,
    banner_privacy: PKPrivacyFieldSchema,
    metadata_privacy: PKPrivacyFieldSchema,
    proxy_privacy: PKPrivacyFieldSchema,
  })
  .optional();

export const PKMemberSchema = z.looseObject({
  id: z.string().min(1),
  uuid: z.string().optional(),
  name: z.string().min(1),
  display_name: NullableString,
  pronouns: NullableString,
  description: NullableString,
  color: NullableString,
  avatar_url: NullableString,
  created: z.string().optional(),
  privacy: PKPrivacySchema,
  proxy_tags: z
    .array(
      z.object({
        prefix: z.string().nullable().optional(),
        suffix: z.string().nullable().optional(),
      }),
    )
    .optional(),
  birthday: NullableString,
  banner: NullableString,
  webhook_avatar_url: NullableString,
  keep_proxy: z.boolean().optional(),
  tts: z.boolean().optional(),
  autoproxy_enabled: z.boolean().optional(),
  message_count: z.number().optional(),
  last_message_timestamp: NullableString,
});

export const PKGroupSchema = z.looseObject({
  id: z.string().min(1),
  uuid: z.string().optional(),
  name: z.string().min(1),
  display_name: NullableString,
  description: NullableString,
  icon: NullableString,
  banner: NullableString,
  color: NullableString,
  members: z.array(z.string()).readonly().optional().default([]),
  privacy: z
    .object({
      name_privacy: PKPrivacyFieldSchema,
      description_privacy: PKPrivacyFieldSchema,
      icon_privacy: PKPrivacyFieldSchema,
      list_privacy: PKPrivacyFieldSchema,
      metadata_privacy: PKPrivacyFieldSchema,
      visibility: PKPrivacyFieldSchema,
      banner_privacy: PKPrivacyFieldSchema,
    })
    .optional(),
});

export const PKSwitchSchema = z.object({
  id: z.string().optional(),
  timestamp: z.iso.datetime(),
  members: z.array(z.string()).readonly(),
});

export const PKPayloadSchema = z.object({
  version: z.number(),
  id: z.string().min(1),
  name: z.string().nullable().optional(),
  members: z.array(PKMemberSchema).readonly(),
  groups: z.array(PKGroupSchema).readonly(),
  switches: z.array(PKSwitchSchema).readonly(),
});

export type PKMember = z.infer<typeof PKMemberSchema>;
export type PKGroup = z.infer<typeof PKGroupSchema>;
export type PKSwitch = z.infer<typeof PKSwitchSchema>;
export type PKPayload = z.infer<typeof PKPayloadSchema>;
