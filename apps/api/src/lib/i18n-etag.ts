import { createHash } from "node:crypto";

import { asEtag, I18N_ETAG_LENGTH, type Etag } from "@pluralscape/types";

/**
 * Deterministic ETag derived from canonical JSON of the translations map.
 * Keys are sorted to guarantee identical output across API instances and
 * across re-serializations, which matters because ETag equality is the
 * only signal the mobile client uses to short-circuit re-downloads.
 *
 * The input is typed `string | undefined` on values to match the defensive
 * loop below — callers that have already proved their map is tight
 * (`Record<string, string>`) still satisfy this wider shape, while callers
 * that built the map from a lookup can pass the result directly without a
 * cast. `undefined` values are dropped before hashing so the output stays
 * identical to a map that never had the key at all.
 */
export function computeTranslationsEtag(
  translations: Readonly<Record<string, string | undefined>>,
): Etag {
  const sortedKeys = Object.keys(translations).sort();
  const canonical = JSON.stringify(
    sortedKeys.reduce<Record<string, string>>((acc, k) => {
      const v = translations[k];
      if (v !== undefined) acc[k] = v;
      return acc;
    }, {}),
  );
  const hex = createHash("sha256").update(canonical).digest("hex").slice(0, I18N_ETAG_LENGTH);
  return asEtag(hex);
}
