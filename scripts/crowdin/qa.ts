import type { CrowdinClient } from "./client.js";

/**
 * QA checks critical to correct i18n JSON output:
 * - placeholder/ICU consistency — prevents broken `{{variable}}` interpolation
 * - tags consistency — catches malformed HTML/ICU tags
 * - whitespace — trims trailing/leading whitespace differences
 * - spellcheck — flags obvious typos
 */
const QA_CHECK_CATEGORIES = [
  "empty",
  "size",
  "tags",
  "spaces",
  "variables",
  "punctuation",
  "icu",
  "spellcheck",
];

export async function applyQaChecks(client: CrowdinClient, projectId: number): Promise<string[]> {
  await client.projectsGroupsApi.editProject(projectId, [
    {
      op: "replace",
      path: "/qaCheckCategories",
      value: QA_CHECK_CATEGORIES.reduce(
        (acc, cat) => ({ ...acc, [cat]: true }),
        {} as Record<string, boolean>,
      ),
    },
  ]);
  return QA_CHECK_CATEGORIES;
}
