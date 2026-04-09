/**
 * Build SP test export fixtures.
 *
 * Run: `pnpm --filter @pluralscape/import-sp build-fixtures`
 *   or: `tsx packages/import-sp/scripts/build-fixtures.ts`
 *
 * Writes minimal and legacy JSON exports to test-fixtures/.
 * Re-run after schema changes to keep fixtures in sync with the Zod validators
 * in `src/validators/sp-payload.ts`.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(SCRIPT_DIR, "..", "test-fixtures");

const ID_PAD_WIDTH = 8;
const REALISTIC_BASE_TIME_MS = 1_700_000_000_000;

function id(prefix: string, n: number): string {
  return `${prefix}_${String(n).padStart(ID_PAD_WIDTH, "0")}`;
}

function buildMinimal(): unknown {
  return {
    privacyBuckets: [{ _id: id("bk", 1), name: "Public" }],
    customFields: [{ _id: id("cf", 1), name: "Likes", type: "text", order: 0 }],
    members: [
      {
        _id: id("m", 1),
        name: "Aria",
        info: { [id("cf", 1)]: "books" },
        buckets: [id("bk", 1)],
      },
    ],
    frontHistory: [
      {
        _id: id("fh", 1),
        member: id("m", 1),
        custom: false,
        live: true,
        startTime: REALISTIC_BASE_TIME_MS,
        endTime: null,
      },
    ],
  };
}

/**
 * Legacy export: no `privacyBuckets` collection. Members encode privacy
 * exclusively via the `private` / `preventTrusted` boolean pair, which
 * forces the engine into the synthesized-bucket code path.
 *
 * Four members cover every branch in `deriveBucketSourceIds`:
 *   1. `private: true`            → synthetic:private
 *   2. `preventTrusted: true`     → synthetic:public
 *   3. `private: false`           → synthetic:public + synthetic:trusted
 *   4. (no privacy flags)         → synthetic:private (fail-closed default)
 */
function buildLegacyNoBuckets(): unknown {
  return {
    customFields: [{ _id: id("cf", 1), name: "Likes", type: "text", order: 0 }],
    members: [
      { _id: id("m", 1), name: "Private Member", private: true },
      { _id: id("m", 2), name: "Prevented Member", preventTrusted: true },
      { _id: id("m", 3), name: "Public Member", private: false },
      { _id: id("m", 4), name: "Default Member" },
    ],
    frontHistory: [
      {
        _id: id("fh", 1),
        member: id("m", 1),
        custom: false,
        live: true,
        startTime: REALISTIC_BASE_TIME_MS,
        endTime: null,
      },
    ],
  };
}

function writeJson(name: string, data: unknown): void {
  writeFileSync(join(FIXTURE_DIR, name), `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote test-fixtures/${name}`);
}

writeJson("minimal.sp-export.json", buildMinimal());
writeJson("legacy-no-buckets.sp-export.json", buildLegacyNoBuckets());
