import { describe, expect, it, vi } from "vitest";

import { applyQaChecks, QA_CHECK_CATEGORIES, type QaClient } from "../../crowdin/qa.js";

describe("applyQaChecks", () => {
  it("returns the category list when readback confirms all categories enabled", async () => {
    const enabled = Object.fromEntries(QA_CHECK_CATEGORIES.map((c) => [c, true])) as Record<
      string,
      boolean
    >;
    const client: QaClient = {
      projectsGroupsApi: {
        editProject: vi.fn().mockResolvedValue({}),
        getProject: vi.fn().mockResolvedValue({
          data: { qaChecksIgnorableCategories: enabled },
        }),
      },
    };
    const result = await applyQaChecks(client, 100);
    expect([...result]).toEqual([...QA_CHECK_CATEGORIES]);
  });

  it("throws when readback shows some categories are NOT enabled", async () => {
    const partialEnabled: Record<string, boolean> = { empty_string: true };
    const client: QaClient = {
      projectsGroupsApi: {
        editProject: vi.fn().mockResolvedValue({}),
        getProject: vi.fn().mockResolvedValue({
          data: { qaChecksIgnorableCategories: partialEnabled },
        }),
      },
    };
    await expect(applyQaChecks(client, 100)).rejects.toThrow(/QA check enablement/);
  });
});
