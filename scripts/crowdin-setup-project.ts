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

const VALID_SCOPES = ["languages", "glossary", "mt", "qa"] as const;
type Scope = (typeof VALID_SCOPES)[number];

interface SetupSummary {
  languages: { added: string[]; removed: string[]; total: number };
  glossary: { added: number; updated: number; removed: number; total: number };
  mt: { deeplId: number; googleId: number };
  qa: { categoriesEnabled: readonly string[] };
}

function parseScopes(raw: string | undefined): readonly Scope[] {
  if (!raw) return VALID_SCOPES;
  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const invalid = requested.filter((s) => !(VALID_SCOPES as readonly string[]).includes(s));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown --only scope(s): ${invalid.join(", ")}. Valid: ${VALID_SCOPES.join(", ")}`,
    );
  }
  return requested as readonly Scope[];
}

const SUMMARY_FORMATTERS: Record<Scope, (s: Partial<SetupSummary>) => string | null> = {
  languages: (s) =>
    s.languages
      ? `  Languages: +${String(s.languages.added.length)} -${String(s.languages.removed.length)} total=${String(s.languages.total)}`
      : null,
  glossary: (s) =>
    s.glossary
      ? `  Glossary: +${String(s.glossary.added)} ~${String(s.glossary.updated)} -${String(s.glossary.removed)} total=${String(s.glossary.total)}`
      : null,
  mt: (s) =>
    s.mt ? `  MT engines: DeepL=#${String(s.mt.deeplId)} Google=#${String(s.mt.googleId)}` : null,
  qa: (s) => (s.qa ? `  QA categories: ${s.qa.categoriesEnabled.join(", ")}` : null),
};

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      only: { type: "string" },
    },
  });

  const scopes = parseScopes(values.only);
  const env = loadCrowdinEnv(process.env);

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
    for (const scope of VALID_SCOPES) {
      const line = SUMMARY_FORMATTERS[scope](summary);
      if (line) console.log(line);
    }
  }
}

main().catch((err: unknown) => {
  console.error("crowdin:setup failed:", err);
  process.exit(1);
});
