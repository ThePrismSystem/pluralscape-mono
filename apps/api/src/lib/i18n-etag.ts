import { createHash } from "node:crypto";

import { asEtag, I18N_ETAG_LENGTH, type Etag } from "@pluralscape/types";

/**
 * Deterministic ETag derived from canonical JSON of the translations map.
 * Keys are sorted to guarantee identical output across API instances and
 * across re-serializations, which matters because ETag equality is the
 * only signal the mobile client uses to short-circuit re-downloads.
 */
export function computeTranslationsEtag(translations: Readonly<Record<string, string>>): Etag {
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
