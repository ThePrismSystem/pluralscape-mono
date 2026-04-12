import type { PkCollectionName } from "../sources/pk-collections.js";
import type { ImportCollectionType } from "@pluralscape/types";

const TO_ENTITY_TYPE: Readonly<Record<PkCollectionName, ImportCollectionType>> = {
  member: "member",
  group: "group",
  switch: "fronting-session",
  "privacy-bucket": "privacy-bucket",
};

export function pkCollectionToEntityType(collection: string): ImportCollectionType {
  if (!(collection in TO_ENTITY_TYPE)) {
    throw new Error(`Unknown PK collection: ${collection}`);
  }
  return TO_ENTITY_TYPE[collection as PkCollectionName];
}
