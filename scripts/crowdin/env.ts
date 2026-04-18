import { z } from "zod";

const EnvSchema = z
  .object({
    CROWDIN_PROJECT_ID: z.string().regex(/^\d+$/, "CROWDIN_PROJECT_ID must be a positive integer"),
    CROWDIN_PERSONAL_TOKEN: z.string().min(1),
    DEEPL_API_KEY: z.string().min(1),
    GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional(),
  })
  .refine(
    (env) => env.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON || env.GOOGLE_APPLICATION_CREDENTIALS,
    {
      message:
        "Either GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS must be set",
    },
  );

export interface CrowdinEnv {
  projectId: number;
  token: string;
  deeplApiKey: string;
  googleCredentialsJson?: string;
  googleCredentialsPath?: string;
}

export function loadCrowdinEnv(env: Record<string, string | undefined>): CrowdinEnv {
  const parsed = EnvSchema.parse(env);
  return {
    projectId: Number(parsed.CROWDIN_PROJECT_ID),
    token: parsed.CROWDIN_PERSONAL_TOKEN,
    deeplApiKey: parsed.DEEPL_API_KEY,
    googleCredentialsJson: parsed.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON,
    googleCredentialsPath: parsed.GOOGLE_APPLICATION_CREDENTIALS,
  };
}
