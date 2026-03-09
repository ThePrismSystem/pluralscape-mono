import type { EntityType } from "./ids.js";

/** Feature flags controlling UI simplification in Littles Safe Mode. */
export interface SafeModeUIFlags {
  readonly hideAnalytics: boolean;
  readonly hideJournal: boolean;
  readonly hideInnerworld: boolean;
  readonly hideCustomFields: boolean;
  readonly simplifiedNavigation: boolean;
  readonly largerTouchTargets: boolean;
}

/** A content item that may be shown or hidden in safe mode. */
export interface SafeModeContentItem {
  readonly entityType: EntityType;
  readonly label: string;
  readonly visible: boolean;
}

/** Configuration for Littles Safe Mode — simplified UI for littles. */
export interface LittlesSafeModeConfig {
  readonly enabled: boolean;
  readonly uiFlags: SafeModeUIFlags;
  readonly hiddenContent: readonly SafeModeContentItem[];
}
