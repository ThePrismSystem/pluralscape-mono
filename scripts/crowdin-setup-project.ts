import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { createCrowdinClient } from "./crowdin/client.js";
import { loadCrowdinEnv } from "./crowdin/env.js";
import { GlossarySchema } from "./crowdin/glossary-schema.js";
import { applyGlossary } from "./crowdin/glossary.js";
import { TARGET_LANGUAGE_IDS, applyTargetLanguages } from "./crowdin/languages.js";
import { applyMtEngines } from "./crowdin/mt.js";
import { applyQaChecks } from "./crowdin/qa.js";

interface SetupSummary {
  languages: { added: string[]; removed: string[]; total: number };
  glossary: { added: number; updated: number; removed: number; total: number };
  mt: { deeplId: number; googleId: number };
  qa: { categoriesEnabled: readonly string[] };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      only: { type: "string" },
    },
  });

  const env = loadCrowdinEnv(process.env);
  const scopes = values.only ? values.only.split(",") : ["languages", "glossary", "mt", "qa"];

  if (values["dry-run"]) {
    console.log(
      JSON.stringify({ dryRun: true, env: { projectId: env.projectId }, scopes }, null, 2),
    );
    return;
  }

  const client = createCrowdinClient(env);
  const summary: Partial<SetupSummary> = {};

  if (scopes.includes("languages")) {
    const diff = await applyTargetLanguages(client, env.projectId);
    summary.languages = {
      added: diff.toAdd,
      removed: diff.toRemove,
      total: TARGET_LANGUAGE_IDS.length,
    };
  }

  if (scopes.includes("glossary")) {
    const glossaryFile = path.resolve(import.meta.dirname, "crowdin-glossary.json");
    const raw = readFileSync(glossaryFile, "utf8");
    const parsed = GlossarySchema.parse(JSON.parse(raw) as unknown);
    const diff = await applyGlossary(client, env.projectId, parsed.terms);
    summary.glossary = {
      added: diff.toAdd.length,
      updated: diff.toUpdate.length,
      removed: diff.toRemove.length,
      total: parsed.terms.length,
    };
  }

  if (scopes.includes("mt")) {
    summary.mt = await applyMtEngines(client, env.projectId, env);
  }

  if (scopes.includes("qa")) {
    summary.qa = { categoriesEnabled: await applyQaChecks(client, env.projectId) };
  }

  if (values.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("Crowdin project setup complete:");
    if (summary.languages)
      console.log(
        `  Languages: +${summary.languages.added.length} -${summary.languages.removed.length} total=${summary.languages.total}`,
      );
    if (summary.glossary)
      console.log(
        `  Glossary: +${summary.glossary.added} ~${summary.glossary.updated} -${summary.glossary.removed} total=${summary.glossary.total}`,
      );
    if (summary.mt)
      console.log(`  MT engines: DeepL=#${summary.mt.deeplId} Google=#${summary.mt.googleId}`);
    if (summary.qa) console.log(`  QA categories: ${summary.qa.categoriesEnabled.join(", ")}`);
  }
}

main().catch((err: unknown) => {
  console.error("crowdin:setup failed:", err);
  process.exit(1);
});
