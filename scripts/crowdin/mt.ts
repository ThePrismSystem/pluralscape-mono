import type { CrowdinEnv } from "./env.js";
import { type TargetLanguageId } from "./languages.js";

/**
 * Credential shapes we use with Crowdin MT. DeepL uses `{ apiKey }`; Google
 * service-account creds use `{ credentials }` (stringified JSON).
 */
export type MtCredentials = { apiKey: string } | { credentials: string };

/**
 * Minimal structural slice of `CrowdinClient` exercised by MT operations. The
 * real SDK client satisfies this interface; tests stub it without mocking the
 * SDK's full surface.
 */
export interface MtClient {
  machineTranslationApi: {
    listMts(): Promise<{ data: Array<{ data: { id: number; name: string } }> }>;
    createMt(request: {
      name: string;
      type: string;
      credentials: MtCredentials;
      enabledProjectIds: number[];
    }): Promise<{ data: { id: number; name: string } }>;
    updateMt(mtId: number, patch: unknown): Promise<unknown>;
  };
}

export type Engine = "deepl" | "google";

/**
 * Maps Crowdin target-language IDs to MT engines, or `null` when no MT engine
 * we configure supports that target and the language must be left for human
 * translation. `null` routes are still included in the TM pretranslate pass
 * but excluded from every MT pass.
 *
 * - DeepL Free supports most European languages + Japanese/Korean/Chinese but
 *   not Arabic, and only a single "Spanish" locale (no es-419).
 * - Google's Crowdin integration accepts Arabic but rejects `es-419`
 *   ("Languages [es-419] are not supported by Mt Engine" — HTTP 400 on
 *   applyPreTranslation). LatAm Spanish therefore stays human-translated.
 *
 * Typed as `Record<TargetLanguageId, Engine | null>` so the compiler enforces
 * exhaustive coverage whenever `TARGET_LANGUAGE_IDS` changes.
 */
export const ENGINE_ROUTING: Record<TargetLanguageId, Engine | null> = {
  ar: "google",
  "es-419": null,
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

/**
 * Display names of the Crowdin MT engine entries. These must match the
 * names given to the engines in the Crowdin UI — the lookup is by name
 * (not id) so a rename here without a UI rename (or vice versa) will cause
 * `findMtEngineIds` to miss them and pretranslate to fail. Current values
 * match the engines created manually in the Pluralscape Crowdin account.
 */
const DEEPL_MT_NAME = "deepl";
const GOOGLE_MT_NAME = "google";

/**
 * Thrown when the Crowdin API refuses programmatic MT engine creation
 * (seen as HTTP 405 on `POST /mts` for personal accounts). Callers treat
 * this as a non-fatal signal: the workflow continues, but MT engines must
 * be created manually in the Crowdin UI before pretranslate will work.
 */
export class MtCreationForbiddenError extends Error {
  constructor(engineName: string) {
    super(
      `Crowdin rejected MT engine creation for "${engineName}" (HTTP 405). ` +
        `This account tier likely does not allow programmatic MT engine creation. ` +
        `Create the engine once in the Crowdin UI (Account settings → Machine translation engines), ` +
        `name it exactly "${engineName}", then re-run crowdin:setup — subsequent runs will PATCH the existing engine.`,
    );
    this.name = "MtCreationForbiddenError";
  }
}

function isMethodNotAllowed(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === 405;
}

function assertUnique(name: string, ids: readonly number[]): void {
  if (ids.length > 1) {
    throw new Error(
      `Multiple MT engines named "${name}" exist (ids=${ids.join(", ")}). Remove duplicates in the Crowdin UI before re-running setup.`,
    );
  }
}

/**
 * Read-only lookup for engine IDs. Returns null if either engine is missing.
 *
 * Separated from {@link applyMtEngines} so runtime workflows (e.g.,
 * crowdin-sync pre-translate step) never attempt engine creation — that
 * belongs exclusively to crowdin-setup-project.ts, avoiding a race where
 * two workflows both try to create the same named engine.
 */
export async function findMtEngineIds(
  client: MtClient,
): Promise<{ deeplId: number; googleId: number } | null> {
  const list = await client.machineTranslationApi.listMts();
  const deeplMatches = list.data.filter((m) => m.data.name === DEEPL_MT_NAME);
  const googleMatches = list.data.filter((m) => m.data.name === GOOGLE_MT_NAME);
  assertUnique(
    DEEPL_MT_NAME,
    deeplMatches.map((m) => m.data.id),
  );
  assertUnique(
    GOOGLE_MT_NAME,
    googleMatches.map((m) => m.data.id),
  );
  const deepl = deeplMatches[0];
  const google = googleMatches[0];
  if (!deepl || !google) return null;
  return { deeplId: deepl.data.id, googleId: google.data.id };
}

export async function applyMtEngines(
  client: MtClient,
  projectId: number,
  env: CrowdinEnv,
): Promise<{ deeplId: number; googleId: number }> {
  const mtsApi = client.machineTranslationApi;
  const list = await mtsApi.listMts();
  const deeplMatches = list.data.filter((m) => m.data.name === DEEPL_MT_NAME);
  const googleMatches = list.data.filter((m) => m.data.name === GOOGLE_MT_NAME);
  assertUnique(
    DEEPL_MT_NAME,
    deeplMatches.map((m) => m.data.id),
  );
  assertUnique(
    GOOGLE_MT_NAME,
    googleMatches.map((m) => m.data.id),
  );
  const existingDeepl = deeplMatches[0];
  const existingGoogle = googleMatches[0];

  // googleCredentials is the shape-validated service-account object from env.ts;
  // we serialize it once here and hand the JSON string to Crowdin.
  const googleCredsJson = JSON.stringify(env.googleCredentials);

  let deeplId: number;
  if (existingDeepl) {
    // PATCH credentials + enabledProjectIds on reuse so a rotated DeepL key or
    // a newly-cloned project gets picked up automatically, instead of
    // silently running against a stale engine. On account tiers that reject
    // programmatic MT mutation (HTTP 405), skip the PATCH and reuse the
    // existing engine as-is — the operator is expected to keep credentials
    // and enabled projects in sync via the Crowdin UI.
    try {
      await mtsApi.updateMt(existingDeepl.data.id, [
        { op: "replace", path: "/credentials", value: { apiKey: env.deeplApiKey } },
        { op: "replace", path: "/enabledProjectIds", value: [projectId] },
      ]);
    } catch (err) {
      if (!isMethodNotAllowed(err)) throw err;
      console.warn(
        `::warning::Crowdin rejected MT engine PATCH for "${DEEPL_MT_NAME}" (HTTP 405). ` +
          `Reusing engine id=${String(existingDeepl.data.id)} as-is. ` +
          `Keep credentials and enabledProjects in sync via the Crowdin UI.`,
      );
    }
    deeplId = existingDeepl.data.id;
  } else {
    try {
      const created = await mtsApi.createMt({
        name: DEEPL_MT_NAME,
        type: "deepl",
        credentials: { apiKey: env.deeplApiKey },
        enabledProjectIds: [projectId],
      });
      deeplId = created.data.id;
    } catch (err) {
      if (isMethodNotAllowed(err)) throw new MtCreationForbiddenError(DEEPL_MT_NAME);
      throw err;
    }
  }

  let googleId: number;
  if (existingGoogle) {
    try {
      await mtsApi.updateMt(existingGoogle.data.id, [
        { op: "replace", path: "/credentials", value: { credentials: googleCredsJson } },
        { op: "replace", path: "/enabledProjectIds", value: [projectId] },
      ]);
    } catch (err) {
      if (!isMethodNotAllowed(err)) throw err;
      console.warn(
        `::warning::Crowdin rejected MT engine PATCH for "${GOOGLE_MT_NAME}" (HTTP 405). ` +
          `Reusing engine id=${String(existingGoogle.data.id)} as-is. ` +
          `Keep credentials and enabledProjects in sync via the Crowdin UI.`,
      );
    }
    googleId = existingGoogle.data.id;
  } else {
    try {
      const created = await mtsApi.createMt({
        name: GOOGLE_MT_NAME,
        type: "google-automl-v1",
        credentials: { credentials: googleCredsJson },
        enabledProjectIds: [projectId],
      });
      googleId = created.data.id;
    } catch (err) {
      if (isMethodNotAllowed(err)) throw new MtCreationForbiddenError(GOOGLE_MT_NAME);
      throw err;
    }
  }

  return { deeplId, googleId };
}
