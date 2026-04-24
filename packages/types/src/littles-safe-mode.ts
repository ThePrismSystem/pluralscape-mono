import type { BlobId, SafeModeContentId, SystemId } from "./ids.js";

/** Feature flags controlling UI simplification in Littles Safe Mode. */
export interface SafeModeUIFlags {
  readonly largeButtons: boolean;
  readonly iconDriven: boolean;
  readonly noDeletion: boolean;
  readonly noSettings: boolean;
  readonly noAnalytics: boolean;
}

/** A content item for Littles Safe Mode — links, videos, or media. */
export interface SafeModeContentItem {
  readonly id: SafeModeContentId;
  readonly systemId: SystemId;
  readonly contentType: "link" | "video" | "media";
  readonly url: string | null;
  readonly blobRef: BlobId | null;
  readonly title: string;
  readonly description: string;
  readonly sortOrder: number;
}

/** Configuration for Littles Safe Mode — simplified UI for littles. */
export interface LittlesSafeModeConfig {
  readonly enabled: boolean;
  readonly allowedContentIds: readonly SafeModeContentId[];
  readonly simplifiedUIFlags: SafeModeUIFlags;
}
