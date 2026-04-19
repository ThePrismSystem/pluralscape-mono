import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { parseCsvEnum } from "./crowdin/args.js";
import { createCrowdinClient } from "./crowdin/client.js";
import { loadCrowdinEnv } from "./crowdin/env.js";
import { GlossarySchema } from "./crowdin/glossary-schema.js";
import { applyGlossary } from "./crowdin/glossary.js";
import { TARGET_LANGUAGE_IDS, applyTargetLanguages } from "./crowdin/languages.js";
import { MtCreationForbiddenError, applyMtEngines } from "./crowdin/mt.js";
import { applyApprovalSettings, type ApprovalSummary } from "./crowdin/project-approval.js";
import { applyQaChecks } from "./crowdin/qa.js";

const VALID_SCOPES = ["languages", "glossary", "mt", "qa", "approval"] as const;
type Scope = (typeof VALID_SCOPES)[number];

interface SetupSummary {
  languages: { added: string[]; removed: string[]; total: number };
  glossary: { added: number; updated: number; removed: number; total: number };
  mt: { deeplId: number; googleId: number };
  qa: { categoriesEnabled: readonly string[] };
  approval: ApprovalSummary;
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
  approval: (s) =>
    s.approval ? `  Approval: exportApprovedOnly=${String(s.approval.exportApprovedOnly)}` : null,
};

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      only: { type: "string" },
    },
  });

  const scopes: readonly Scope[] = values.only
    ? parseCsvEnum(values.only, VALID_SCOPES, "--only")
    : VALID_SCOPES;
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
    try {
      summary.mt = await applyMtEngines(client, env.projectId, env);
    } catch (err) {
      if (err instanceof MtCreationForbiddenError) {
        // Non-fatal: log and continue. Downstream pretranslate will fail with
        // a clear error if engines are genuinely missing, which is distinct
        // from "we could not create them" — the account owner needs to create
        // them once in the Crowdin UI.
        console.warn(`::warning::${err.message}`);
      } else {
        throw err;
      }
    }
  }

  if (scopes.includes("qa")) {
    summary.qa = { categoriesEnabled: await applyQaChecks(client, env.projectId) };
  }

  if (scopes.includes("approval")) {
    summary.approval = await applyApprovalSettings(client, env.projectId);
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
