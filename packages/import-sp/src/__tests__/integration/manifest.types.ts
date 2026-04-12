export interface ManifestEntry {
  readonly ref: string;
  readonly sourceId: string;
  readonly fields: Record<string, unknown>;
}

export interface Manifest {
  readonly systemId: string;
  readonly mode: "minimal" | "adversarial";
  readonly privacyBuckets: readonly ManifestEntry[];
  readonly customFields: readonly ManifestEntry[];
  readonly customFronts: readonly ManifestEntry[];
  readonly members: readonly ManifestEntry[];
  readonly groups: readonly ManifestEntry[];
  readonly frontHistory: readonly ManifestEntry[];
  readonly comments: readonly ManifestEntry[];
  readonly notes: readonly ManifestEntry[];
  readonly polls: readonly ManifestEntry[];
  readonly channelCategories: readonly ManifestEntry[];
  readonly channels: readonly ManifestEntry[];
  readonly chatMessages: readonly ManifestEntry[];
  readonly boardMessages: readonly ManifestEntry[];
}

export type ManifestCollectionKey = keyof Omit<Manifest, "systemId" | "mode">;
