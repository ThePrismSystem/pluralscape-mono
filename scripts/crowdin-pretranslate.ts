import { parseArgs } from "node:util";

import { createCrowdinClient } from "./crowdin/client.js";
import { loadCrowdinEnv } from "./crowdin/env.js";
import { findMtEngineIds } from "./crowdin/mt.js";
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
  const ids = await findMtEngineIds(client);
  if (!ids) {
    console.error(
      "crowdin:pretranslate: MT engines are not configured. Run `pnpm crowdin:setup` first.",
    );
    process.exit(1);
  }

  const result = await runPretranslate(client, env.projectId, {
    deeplMtId: ids.deeplId,
    googleMtId: ids.googleId,
    languageIds,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status === "failed") process.exit(1);
}

main().catch((err: unknown) => {
  console.error("crowdin:pretranslate failed:", err);
  process.exit(1);
});
