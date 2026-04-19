import { z } from "zod";

/**
 * Minimal structural slice of `CrowdinClient` exercised by
 * {@link applyApprovalSettings}. The real SDK client satisfies this interface.
 */
export interface ProjectApprovalClient {
  projectsGroupsApi: {
    editProject(projectId: number, patch: unknown): Promise<unknown>;
    getProject(projectId: number): Promise<{ data: unknown }>;
  };
}

export interface ApprovalSummary {
  exportApprovedOnly: boolean;
}

const ApprovalReadbackSchema = z
  .object({
    exportApprovedOnly: z.boolean().nullish(),
  })
  .passthrough();

/**
 * Flips the project's export-approved-only setting off, so unapproved
 * translations (whether from MT pretranslate or editor-entered by volunteer
 * translators) land in the daily sync PR without waiting for a separate
 * approval step. Pairs with `autoApproveOption: "all"` on pretranslate to
 * honor the "translations auto-apply immediately" claim in the ops runbook.
 */
export async function applyApprovalSettings(
  client: ProjectApprovalClient,
  projectId: number,
): Promise<ApprovalSummary> {
  await client.projectsGroupsApi.editProject(projectId, [
    { op: "replace", path: "/exportApprovedOnly", value: false },
  ]);
  const project = await client.projectsGroupsApi.getProject(projectId);
  const parsed = ApprovalReadbackSchema.parse(project.data);
  const actual = parsed.exportApprovedOnly ?? false;
  if (actual !== false) {
    throw new Error(
      `exportApprovedOnly did not flip to false on Crowdin (still=${String(actual)}).`,
    );
  }
  return { exportApprovedOnly: false };
}
