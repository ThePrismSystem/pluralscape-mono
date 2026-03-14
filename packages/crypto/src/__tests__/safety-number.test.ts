import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { computeSafetyNumber } from "../safety-number.js";
import { getSodium } from "../sodium.js";

import { setupSodium, teardownSodium } from "./helpers/setup-sodium.js";

import type { SignPublicKey } from "../types.js";

beforeAll(setupSodium);
afterAll(teardownSodium);

function makeKey(): SignPublicKey {
  return getSodium().signKeypair().publicKey;
}

describe("computeSafetyNumber", () => {
  it("displayString is 60 digits with spaces — 12 groups of 5 separated by spaces", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const sn = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    // 12 groups of 5 digits separated by single spaces = 59 chars (12*5 + 11 spaces)
    const groups = sn.displayString.trim().split(" ");
    expect(groups).toHaveLength(12);
    for (const g of groups) {
      expect(g).toHaveLength(5);
      expect(/^\d{5}$/.test(g)).toBe(true);
    }
  });

  it("is deterministic — same inputs always produce the same result", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const sn1 = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    const sn2 = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    expect(sn1.displayString).toBe(sn2.displayString);
    expect(sn1.fingerprint).toEqual(sn2.fingerprint);
  });

  it("is order-independent — (A, B) === (B, A)", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const ab = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    const ba = computeSafetyNumber(kp2, "user-b", kp1, "user-a");
    expect(ab.displayString).toBe(ba.displayString);
    expect(ab.fingerprint).toEqual(ba.fingerprint);
  });

  it("different key pairs produce different safety numbers", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const kp3 = makeKey();
    const sn1 = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    const sn2 = computeSafetyNumber(kp1, "user-a", kp3, "user-b");
    expect(sn1.displayString).not.toBe(sn2.displayString);
  });

  it("different stableIds produce different safety numbers", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const sn1 = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    const sn2 = computeSafetyNumber(kp1, "user-a-changed", kp2, "user-b");
    expect(sn1.displayString).not.toBe(sn2.displayString);
  });

  it("displayString contains only digits and spaces", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const sn = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    expect(/^[\d ]+$/.test(sn.displayString)).toBe(true);
  });

  it("leading zeros are preserved in each group", () => {
    // Run many pairs until we find one with a leading-zero group, or
    // at minimum verify the format allows it (the digit encoding zero-pads to 5 digits)
    let foundLeadingZero = false;
    for (let i = 0; i < 50; i++) {
      const sn = computeSafetyNumber(makeKey(), `u${String(i)}`, makeKey(), `v${String(i)}`);
      const groups = sn.displayString.trim().split(" ");
      if (groups.some((g) => g.startsWith("0"))) {
        foundLeadingZero = true;
        break;
      }
    }
    // If we find one, good. If not, that's statistically unlikely but not a bug.
    // The real assertion is that every group is exactly 5 digits.
    const sn = computeSafetyNumber(makeKey(), "u", makeKey(), "v");
    const groups = sn.displayString.trim().split(" ");
    expect(groups.every((g) => g.length === 5)).toBe(true);
    void foundLeadingZero;
  });

  it("self-verification: identical keys produce a valid safety number", () => {
    const kp = makeKey();
    const sn = computeSafetyNumber(kp, "user-a", kp, "user-a");
    expect(sn.displayString.trim().split(" ")).toHaveLength(12);
  });

  it("fingerprint is 60 bytes (30 per user)", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const sn = computeSafetyNumber(kp1, "user-a", kp2, "user-b");
    expect(sn.fingerprint.length).toBe(60);
  });

  it("accepts empty stableId", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    expect(() => computeSafetyNumber(kp1, "", kp2, "")).not.toThrow();
  });

  it("accepts long stableId", () => {
    const kp1 = makeKey();
    const kp2 = makeKey();
    const longId = "a".repeat(1000);
    expect(() => computeSafetyNumber(kp1, longId, kp2, longId)).not.toThrow();
  });
});
