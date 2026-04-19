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
}

export function diffLanguages(
  desired: readonly string[],
  current: readonly string[],
): LanguageDiff {
  const desiredSet = new Set(desired);
  const currentSet = new Set(current);
  const toAdd = desired.filter((id) => !currentSet.has(id));
  const toRemove = current.filter((id) => !desiredSet.has(id));
  return { toAdd, toRemove };
}

/**
 * Minimal structural slice of `CrowdinClient` exercised by
 * {@link applyTargetLanguages}. The real SDK client satisfies this interface.
 */
export interface LanguagesClient {
  projectsGroupsApi: {
    getProject(projectId: number): Promise<{ data: { targetLanguageIds?: string[] } }>;
    editProject(projectId: number, patch: unknown): Promise<unknown>;
  };
}

/**
 * Replace the project's target language list with the canonical set.
 * PATCH op "replace" on /targetLanguageIds is idempotent.
 */
export async function applyTargetLanguages(
  client: LanguagesClient,
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
