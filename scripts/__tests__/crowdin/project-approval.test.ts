import { describe, expect, it, vi } from "vitest";

import {
  applyApprovalSettings,
  type ProjectApprovalClient,
} from "../../crowdin/project-approval.js";

describe("applyApprovalSettings", () => {
  it("patches /exportApprovedOnly to false and verifies via readback", async () => {
    const editProject = vi.fn().mockResolvedValue({});
    const client: ProjectApprovalClient = {
      projectsGroupsApi: {
        editProject,
        getProject: vi.fn().mockResolvedValue({ data: { exportApprovedOnly: false } }),
      },
    };
    const result = await applyApprovalSettings(client, 100);
    expect(result.exportApprovedOnly).toBe(false);
    expect(editProject).toHaveBeenCalledTimes(1);
    const [, patch] = editProject.mock.calls[0] ?? [];
    expect(patch).toEqual([{ op: "replace", path: "/exportApprovedOnly", value: false }]);
  });

  it("throws when readback does not reflect the patch", async () => {
    const client: ProjectApprovalClient = {
      projectsGroupsApi: {
        editProject: vi.fn().mockResolvedValue({}),
        getProject: vi.fn().mockResolvedValue({ data: { exportApprovedOnly: true } }),
      },
    };
    await expect(applyApprovalSettings(client, 100)).rejects.toThrow(/exportApprovedOnly/);
  });
});
