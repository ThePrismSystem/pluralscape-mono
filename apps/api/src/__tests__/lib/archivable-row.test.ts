import { describe, expect, it } from "vitest";

import { narrowArchivableRow } from "../../lib/archivable-row.js";

import type { UnixMillis } from "@pluralscape/types";

interface SampleLive {
  readonly id: string;
  readonly name: string;
  readonly archived: false;
}

const liveRow = {
  id: "x",
  name: "n",
  archived: false,
  archivedAt: null,
} as const;

const archivedRow = {
  id: "x",
  name: "n",
  archived: true,
  archivedAt: 1_700_000_000_000 as UnixMillis,
} as const;

describe("narrowArchivableRow", () => {
  it("returns the live shape with no archivedAt for non-archived rows", () => {
    const result = narrowArchivableRow<SampleLive>(liveRow);
    expect(result.archived).toBe(false);
    expect("archivedAt" in result).toBe(false);
    expect(result.id).toBe("x");
  });

  it("returns the archived shape with branded archivedAt for archived rows", () => {
    const result = narrowArchivableRow<SampleLive>(archivedRow);
    expect(result.archived).toBe(true);
    if (result.archived) {
      expect(result.archivedAt).toBe(1_700_000_000_000);
    }
  });

  it("throws when archived=true but archivedAt is null (CHECK violation)", () => {
    expect(() =>
      narrowArchivableRow<SampleLive>({
        id: "x",
        name: "n",
        archived: true,
        archivedAt: null,
      }),
    ).toThrow("Archivable row CHECK invariant violated: archived=true with archivedAt=null");
  });

  it("throws when archived=false but archivedAt is non-null (reverse CHECK violation)", () => {
    expect(() =>
      narrowArchivableRow<SampleLive>({
        id: "x",
        name: "n",
        archived: false,
        archivedAt: 1_700_000_000_000 as UnixMillis,
      }),
    ).toThrow("Archivable row CHECK invariant violated: archived=false with non-null archivedAt");
  });
});
