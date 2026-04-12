export const PK_COLLECTION_NAMES = ["member", "group", "switch", "privacy-bucket"] as const;

export type PkCollectionName = (typeof PK_COLLECTION_NAMES)[number];

export function isPkCollectionName(name: string): name is PkCollectionName {
  return (PK_COLLECTION_NAMES as readonly string[]).includes(name);
}
