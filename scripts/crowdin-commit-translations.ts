import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

import { z } from "zod";

import { commitTranslations, parseChangedFiles } from "./crowdin/commit-translations.js";

const LOCALES_DIR = "apps/mobile/locales";
const TRANSLATION_BRANCH = "chore/crowdin-translations";

const envSchema = z.object({
  GH_TOKEN: z.string().min(1),
  GITHUB_REPOSITORY: z.string().min(1),
  GITHUB_OUTPUT: z.string().min(1),
  BASE_SHA: z.string().min(1),
});

async function main(): Promise<void> {
  const env = envSchema.parse(process.env);
  const porcelain = execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", LOCALES_DIR],
    { encoding: "utf8" },
  );
  const sha = await commitTranslations(parseChangedFiles(porcelain), {
    repository: env.GITHUB_REPOSITORY,
    branch: TRANSLATION_BRANCH,
    baseSha: env.BASE_SHA,
    token: env.GH_TOKEN,
    fetch,
    readFile: (path) => readFileSync(path),
  });
  console.log(sha === null ? "No translation changes." : `Committed ${sha}.`);
  appendFileSync(env.GITHUB_OUTPUT, `committed=${String(sha !== null)}\n`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
