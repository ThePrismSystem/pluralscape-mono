import { I18nManager } from "react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  I18nManager: {
    allowRTL: vi.fn(),
    forceRTL: vi.fn(),
  },
}));

import { applyLayoutDirection } from "../rtl.js";

const mockAllowRTL = vi.mocked(I18nManager.allowRTL);
const mockForceRTL = vi.mocked(I18nManager.forceRTL);

describe("applyLayoutDirection", () => {
  it("calls forceRTL(true) for Arabic", () => {
    applyLayoutDirection("ar");
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it("calls forceRTL(false) for English", () => {
    applyLayoutDirection("en");
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });

  it("calls forceRTL(true) for Hebrew", () => {
    applyLayoutDirection("he");
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it("calls forceRTL(true) for Arabic with region tag", () => {
    applyLayoutDirection("ar-SA");
    expect(mockForceRTL).toHaveBeenCalledWith(true);
  });

  it("calls forceRTL(false) for French", () => {
    applyLayoutDirection("fr");
    expect(mockForceRTL).toHaveBeenCalledWith(false);
  });
});
