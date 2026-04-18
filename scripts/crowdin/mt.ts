import type { CrowdinClient } from "./client.js";
import type { CrowdinEnv } from "./env.js";
import { type TargetLanguageId } from "./languages.js";

export type Engine = "deepl" | "google";

/**
 * Maps Crowdin target-language IDs to MT engines.
 * DeepL Free supports most European languages + Japanese/Korean/Chinese but not Arabic.
 * Google Translate covers the remaining locales including Arabic and dialectal Spanish.
 *
 * Typed as `Record<TargetLanguageId, Engine>` so the compiler enforces
 * exhaustive coverage whenever `TARGET_LANGUAGE_IDS` changes.
 */
export const ENGINE_ROUTING: Record<TargetLanguageId, Engine> = {
  ar: "google",
  "es-419": "google",
  de: "deepl",
  "es-ES": "deepl",
  fr: "deepl",
  it: "deepl",
  ja: "deepl",
  ko: "deepl",
  nl: "deepl",
  "pt-BR": "deepl",
  ru: "deepl",
  "zh-CN": "deepl",
};

/** Display names for Crowdin MT engine entries created by this script. */
const DEEPL_MT_NAME = "Pluralscape DeepL";
const GOOGLE_MT_NAME = "Pluralscape Google Translate";

/**
 * Read-only lookup for engine IDs. Returns null if either engine is missing.
 *
 * Separated from {@link applyMtEngines} so runtime workflows (e.g.,
 * crowdin-sync pre-translate step) never attempt engine creation — that
 * belongs exclusively to crowdin-setup-project.ts, avoiding a race where
 * two workflows both try to create the same named engine.
 */
export async function findMtEngineIds(
  client: CrowdinClient,
): Promise<{ deeplId: number; googleId: number } | null> {
  const list = await client.machineTranslationApi.listMts();
  const deepl = list.data.find((m) => m.data.name === DEEPL_MT_NAME);
  const google = list.data.find((m) => m.data.name === GOOGLE_MT_NAME);
  if (!deepl || !google) return null;
  return { deeplId: deepl.data.id, googleId: google.data.id };
}

export async function applyMtEngines(
  client: CrowdinClient,
  projectId: number,
  env: CrowdinEnv,
): Promise<{ deeplId: number; googleId: number }> {
  const mtsApi = client.machineTranslationApi;
  const list = await mtsApi.listMts();
  const existingDeepl = list.data.find((m) => m.data.name === DEEPL_MT_NAME);
  const existingGoogle = list.data.find((m) => m.data.name === GOOGLE_MT_NAME);

  const deepl =
    existingDeepl ??
    (await mtsApi.createMt({
      name: DEEPL_MT_NAME,
      type: "deepl",
      credentials: { apiKey: env.deeplApiKey },
      enabledProjectIds: [projectId],
    }));

  const googleCreds = env.googleCredentialsJson
    ? (JSON.parse(env.googleCredentialsJson) as Record<string, unknown>)
    : undefined;
  if (!googleCreds) {
    throw new Error("Google credentials JSON required (set GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON)");
  }
  const google =
    existingGoogle ??
    (await mtsApi.createMt({
      name: GOOGLE_MT_NAME,
      type: "google-automl-v1",
      credentials: { credentials: JSON.stringify(googleCreds) },
      enabledProjectIds: [projectId],
    }));

  return { deeplId: deepl.data.id, googleId: google.data.id };
}
