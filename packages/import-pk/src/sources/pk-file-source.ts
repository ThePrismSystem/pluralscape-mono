/**
 * File-based PK import source.
 *
 * Parses a PluralKit JSON export file and yields documents per collection.
 * The `privacy-bucket` collection yields a synthetic "privacy-scan" document
 * containing member privacy data extracted from the file — PK has no
 * first-class privacy bucket concept, so we synthesise one from per-member
 * privacy fields.
 *
 * Memory: the entire file is read into memory and parsed with `JSON.parse`.
 * PK exports are typically small (tens of KB to a few MB for large systems),
 * so this is acceptable.
 */
import { readFileSync } from "node:fs";

import { PKPayloadSchema } from "../validators/pk-payload.js";

import { PK_COLLECTION_NAMES } from "./pk-collections.js";

import type { PKPayload } from "../validators/pk-payload.js";
import type { ImportDataSource, SourceEvent } from "@pluralscape/import-core";

export interface PkFileImportSourceArgs {
  readonly filePath: string;
}

export function createPkFileImportSource(args: PkFileImportSourceArgs): ImportDataSource {
  let parsed: PKPayload | null = null;

  function parse(): PKPayload {
    if (parsed !== null) return parsed;
    const raw = readFileSync(args.filePath, "utf-8");
    const json: unknown = JSON.parse(raw);
    parsed = PKPayloadSchema.parse(json);
    return parsed;
  }

  return {
    mode: "file",

    listCollections(): Promise<readonly string[]> {
      return Promise.resolve([...PK_COLLECTION_NAMES]);
    },

    async *iterate(collection: string): AsyncGenerator<SourceEvent> {
      await Promise.resolve();
      const payload = parse();

      switch (collection) {
        case "member": {
          for (const member of payload.members) {
            yield {
              kind: "doc",
              collection,
              sourceId: member.id,
              document: member,
            };
          }
          break;
        }
        case "group": {
          for (const group of payload.groups) {
            yield {
              kind: "doc",
              collection,
              sourceId: group.id,
              document: group,
            };
          }
          break;
        }
        case "switch": {
          for (let i = 0; i < payload.switches.length; i += 1) {
            const sw = payload.switches[i];
            if (sw === undefined) continue;
            yield {
              kind: "doc",
              collection,
              sourceId: sw.id ?? `switch-${String(i)}`,
              document: sw,
            };
          }
          break;
        }
        case "privacy-bucket": {
          // Yield a synthetic privacy-scan document containing member
          // privacy data. The privacy-bucket batch mapper uses this to
          // synthesise a "PK Private" bucket.
          const members = payload.members.map((m) => ({
            pkMemberId: m.id,
            privacy: m.privacy as Record<string, string> | undefined,
          }));
          yield {
            kind: "doc",
            collection,
            sourceId: "synthetic:privacy-scan",
            document: { type: "privacy-scan" as const, members },
          };
          break;
        }
        // Unknown collection: yield nothing.
      }
    },

    close(): Promise<void> {
      parsed = null;
      return Promise.resolve();
    },
  };
}
