import { parseArgs } from "node:util";

import { parseCsvEnum, parseCsvPositiveInts } from "./crowdin/args.js";
import { createCrowdinClient } from "./crowdin/client.js";
import { loadCrowdinEnv } from "./crowdin/env.js";
import { TARGET_LANGUAGE_IDS, type TargetLanguageId } from "./crowdin/languages.js";
import { findMtEngineIds } from "./crowdin/mt.js";
import { planPretranslatePasses, runPretranslate } from "./crowdin/pretranslate.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      files: { type: "string" },
      languages: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const languageIds: TargetLanguageId[] | undefined = values.languages
    ? parseCsvEnum<TargetLanguageId>(values.languages, TARGET_LANGUAGE_IDS, "--languages")
    : undefined;
  const fileIds = values.files ? parseCsvPositiveInts(values.files, "--files") : undefined;

  if (values["dry-run"]) {
    const plan = planPretranslatePasses({
      deeplMtId: 0,
      googleMtId: 0,
      fileIds,
      languageIds,
    });
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          fileIds: fileIds ?? "all",
          passes: plan.map((p) => ({
            label: p.label,
            method: p.method,
            languageIds: p.languageIds,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const env = loadCrowdinEnv(process.env);
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
    fileIds,
    languageIds,
  });

  console.log(JSON.stringify(result, null, 2));
  const anyFailed = result.passes.some((p) => p.status === "failed");
  if (anyFailed) process.exit(1);
}

main().catch((err: unknown) => {
  console.error("crowdin:pretranslate failed:", err);
  process.exit(1);
});
