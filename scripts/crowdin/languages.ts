import type { CrowdinClient } from "./client.js";

export const TARGET_LANGUAGE_IDS = [
  "ar",
  "de",
  "es-ES",
  "es-419",
  "fr",
  "it",
  "ja",
  "ko",
  "nl",
  "pt-BR",
  "ru",
  "zh-CN",
] as const;

export type TargetLanguageId = (typeof TARGET_LANGUAGE_IDS)[number];

export interface LanguageDiff {
  toAdd: string[];
  toRemove: string[];
  unchanged: string[];
}

export function diffLanguages(
  desired: readonly string[],
  current: readonly string[],
): LanguageDiff {
  const desiredSet = new Set(desired);
  const currentSet = new Set(current);
  const toAdd = desired.filter((id) => !currentSet.has(id));
  const toRemove = current.filter((id) => !desiredSet.has(id));
  const unchanged = desired.filter((id) => currentSet.has(id));
  return { toAdd, toRemove, unchanged };
}

/**
 * Replace the project's target language list with the canonical set.
 * PATCH op "replace" on /targetLanguageIds is idempotent.
 */
export async function applyTargetLanguages(
  client: CrowdinClient,
  projectId: number,
): Promise<LanguageDiff> {
  const project = await client.projectsGroupsApi.getProject(projectId);
  const current = project.data.targetLanguageIds ?? [];
  const diff = diffLanguages([...TARGET_LANGUAGE_IDS], current);
  if (diff.toAdd.length === 0 && diff.toRemove.length === 0) return diff;
  await client.projectsGroupsApi.editProject(projectId, [
    {
      op: "replace",
      path: "/targetLanguageIds",
      value: [...TARGET_LANGUAGE_IDS],
    },
  ]);
  return diff;
}
