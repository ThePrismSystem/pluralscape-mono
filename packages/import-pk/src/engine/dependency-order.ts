import type { PkCollectionName } from "../sources/pk-collections.js";

export const PK_DEPENDENCY_ORDER: readonly PkCollectionName[] = [
  "member",
  "group",
  "switch",
  "privacy-bucket",
];
