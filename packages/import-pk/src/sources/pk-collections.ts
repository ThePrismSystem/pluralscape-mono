export const PK_COLLECTION_NAMES = ["member", "group", "switch", "privacy-bucket"] as const;

export type PkCollectionName = (typeof PK_COLLECTION_NAMES)[number];
