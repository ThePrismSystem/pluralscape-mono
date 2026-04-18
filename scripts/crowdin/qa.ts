import type { CrowdinClient } from "./client.js";

export const QA_CHECK_CATEGORIES = [
  "empty_string",
  "empty_suggestion",
  "size",
  "tags",
  "spaces",
  "variables",
  "punctuation",
  "character_case",
  "special_characters",
  "newlines",
  "numbers",
  "format",
  "multiple_spaces",
  "leading_or_trailing_spaces",
  "icu_plurals",
  "specific_terms",
  "duplicate",
] as const;
export type QaCheckCategory = (typeof QA_CHECK_CATEGORIES)[number];

export async function applyQaChecks(
  client: CrowdinClient,
  projectId: number,
): Promise<readonly QaCheckCategory[]> {
  const settings = Object.fromEntries(QA_CHECK_CATEGORIES.map((c) => [c, true])) as Record<
    QaCheckCategory,
    boolean
  >;

  await client.projectsGroupsApi.editProject(projectId, [
    { op: "replace", path: "/qaChecksIgnorableCategories", value: settings },
  ]);

  const project = await client.projectsGroupsApi.getProject(projectId);
  const data = project.data as { qaChecksIgnorableCategories?: Record<string, boolean> | null };
  const actual = data.qaChecksIgnorableCategories ?? {};
  const failed = QA_CHECK_CATEGORIES.filter((c) => actual[c] !== true);
  if (failed.length > 0) {
    throw new Error(`QA check enablement not reflected by Crowdin: ${failed.join(", ")}`);
  }
  return QA_CHECK_CATEGORIES;
}
