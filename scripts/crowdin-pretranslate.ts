import { parseArgs } from "node:util";

import { createCrowdinClient } from "./crowdin/client.js";
import { loadCrowdinEnv } from "./crowdin/env.js";
import { applyMtEngines } from "./crowdin/mt.js";
import { runPretranslate } from "./crowdin/pretranslate.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      files: { type: "string" },
      languages: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const env = loadCrowdinEnv(process.env);
  const languageIds = values.languages
    ? values.languages.split(",").map((s) => s.trim())
    : undefined;

  if (values["dry-run"]) {
    console.log(JSON.stringify({ dryRun: true, languageIds, files: values.files }, null, 2));
    return;
  }

  const client = createCrowdinClient(env);
  // MT engine IDs are fetched/created as needed; idempotent with setup.
  const { deeplId, googleId } = await applyMtEngines(client, env.projectId, env);

  const result = await runPretranslate(client, env.projectId, {
    deeplMtId: deeplId,
    googleMtId: googleId,
    languageIds,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((err: unknown) => {
  console.error("crowdin:pretranslate failed:", err);
  process.exit(1);
});
