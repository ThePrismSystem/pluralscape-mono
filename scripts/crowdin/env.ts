import { readFileSync } from "node:fs";

import { z } from "zod";

import { getErrorMessage } from "./errors.js";

const RawEnvSchema = z
  .object({
    CROWDIN_PROJECT_ID: z.string().regex(/^\d+$/, "CROWDIN_PROJECT_ID must be a positive integer"),
    CROWDIN_PERSONAL_TOKEN: z.string().min(1),
    DEEPL_API_KEY: z.string().min(1),
    GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  })
  .refine((e) => e.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON ?? e.GOOGLE_APPLICATION_CREDENTIALS, {
    message:
      "Either GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS must be set",
  });

// client_email is asserted present + non-empty, not format-checked — Google
// service-account emails have valid shapes (punycode, i18n domains) that zod's
// email validator may reject. Upstream Google is authoritative.
const ServiceAccountSchema = z
  .object({
    type: z.literal("service_account"),
    project_id: z.string(),
    private_key: z.string(),
    client_email: z.string().min(1),
  })
  .passthrough();

export type GoogleServiceAccount = z.infer<typeof ServiceAccountSchema>;

export interface CrowdinEnv {
  projectId: number;
  token: string;
  deeplApiKey: string;
  googleCredentialsJson: string;
  googleCredentials: GoogleServiceAccount;
}

export function loadCrowdinEnv(env: Record<string, string | undefined>): CrowdinEnv {
  const parsed = RawEnvSchema.parse(env);

  let rawJson: string;
  if (parsed.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON) {
    rawJson = parsed.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON;
  } else {
    const credsPath = parsed.GOOGLE_APPLICATION_CREDENTIALS!;
    try {
      rawJson = readFileSync(credsPath, "utf8");
    } catch (err) {
      throw new Error(
        `Failed to read GOOGLE_APPLICATION_CREDENTIALS file at "${credsPath}": ${getErrorMessage(err)}`,
      );
    }
  }

  let parsedBlob: unknown;
  try {
    parsedBlob = JSON.parse(rawJson);
  } catch (err) {
    const source = parsed.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON
      ? "GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON"
      : `GOOGLE_APPLICATION_CREDENTIALS file at "${parsed.GOOGLE_APPLICATION_CREDENTIALS!}"`;
    throw new Error(`Failed to parse service-account JSON from ${source}: ${getErrorMessage(err)}`);
  }
  const googleCredentials = ServiceAccountSchema.parse(parsedBlob);

  return {
    projectId: Number(parsed.CROWDIN_PROJECT_ID),
    token: parsed.CROWDIN_PERSONAL_TOKEN,
    deeplApiKey: parsed.DEEPL_API_KEY,
    googleCredentialsJson: rawJson,
    googleCredentials,
  };
}
