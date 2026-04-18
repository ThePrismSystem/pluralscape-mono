import { describe, expect, it, vi } from "vitest";

import type { CrowdinClient } from "../../crowdin/client.js";
import { applyQaChecks, QA_CHECK_CATEGORIES } from "../../crowdin/qa.js";

describe("applyQaChecks", () => {
  it("returns the category list when readback confirms all categories enabled", async () => {
    const enabled = Object.fromEntries(QA_CHECK_CATEGORIES.map((c) => [c, true])) as Record<
      string,
      boolean
    >;
    const client = {
      projectsGroupsApi: {
        editProject: vi.fn().mockResolvedValue({}),
        getProject: vi.fn().mockResolvedValue({
          data: { qaChecksIgnorableCategories: enabled },
        }),
      },
    };
    // CrowdinClient's full SDK types pull in ~50 transitive types that are
    // awkward to mock. The structural shape we actually use (editProject,
    // getProject) is fully exercised by the stub above; the cast is
    // test-only and safe.
    const result = await applyQaChecks(client as unknown as CrowdinClient, 100);
    expect([...result]).toEqual([...QA_CHECK_CATEGORIES]);
  });

  it("throws when readback shows some categories are NOT enabled", async () => {
    const partialEnabled: Record<string, boolean> = { empty_string: true };
    const client = {
      projectsGroupsApi: {
        editProject: vi.fn().mockResolvedValue({}),
        getProject: vi.fn().mockResolvedValue({
          data: { qaChecksIgnorableCategories: partialEnabled },
        }),
      },
    };
    // CrowdinClient's full SDK types pull in ~50 transitive types that are
    // awkward to mock. The structural shape we actually use (editProject,
    // getProject) is fully exercised by the stub above; the cast is
    // test-only and safe.
    await expect(applyQaChecks(client as unknown as CrowdinClient, 100)).rejects.toThrow(
      /QA check enablement/,
    );
  });
});
