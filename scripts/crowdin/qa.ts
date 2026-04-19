import { z } from "zod";

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

/**
 * Minimal structural slice of `CrowdinClient` exercised by {@link applyQaChecks}.
 * The real SDK client satisfies this interface. Tests supply a stub without
 * mocking the full SDK surface — same pattern as ContextApiClient.
 */
export interface QaClient {
  projectsGroupsApi: {
    editProject(projectId: number, patch: unknown): Promise<unknown>;
    getProject(projectId: number): Promise<{ data: unknown }>;
  };
}

const QaReadbackSchema = z
  .object({
    qaChecksIgnorableCategories: z.record(z.string(), z.boolean()).nullish(),
  })
  .passthrough();

export async function applyQaChecks(
  client: QaClient,
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
  const parsed = QaReadbackSchema.parse(project.data);
  const actual = parsed.qaChecksIgnorableCategories ?? {};
  const failed = QA_CHECK_CATEGORIES.filter((c) => actual[c] !== true);
  if (failed.length > 0) {
    throw new Error(`QA check enablement not reflected by Crowdin: ${failed.join(", ")}`);
  }
  return QA_CHECK_CATEGORIES;
}
