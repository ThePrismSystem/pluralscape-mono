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

interface QaPatchOp {
  op: "replace";
  path: string;
  value: unknown;
}

interface ProjectQaResponse {
  data: {
    qaChecksIgnorableCategories?: Record<string, boolean> | null;
  };
}

/**
 * Minimal structural slice of `CrowdinClient` exercised by {@link applyQaChecks}.
 * The real SDK client satisfies this interface; tests can supply a stub without
 * mocking the SDK's full surface.
 */
export interface QaApiClient {
  projectsGroupsApi: {
    editProject(projectId: number, patch: QaPatchOp[]): Promise<unknown>;
    getProject(projectId: number): Promise<ProjectQaResponse>;
  };
}

export async function applyQaChecks(
  client: QaApiClient,
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
  const actual = project.data.qaChecksIgnorableCategories ?? {};
  const failed = QA_CHECK_CATEGORIES.filter((c) => actual[c] !== true);
  if (failed.length > 0) {
    throw new Error(`QA check enablement not reflected by Crowdin: ${failed.join(", ")}`);
  }
  return QA_CHECK_CATEGORIES;
}
