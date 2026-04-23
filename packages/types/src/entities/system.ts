import type { SystemId, SystemSettingsId } from "../ids.js";
import type { ImageSource } from "../image-source.js";
import type { AuditMetadata } from "../utility.js";

/** A plural system — the top-level account entity. */
export interface System extends AuditMetadata {
  readonly id: SystemId;
  readonly name: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly avatarSource: ImageSource | null;
  readonly settingsId: SystemSettingsId;
}

/** @future Multi-system switcher list item — not yet implemented. */
export interface SystemListItem {
  readonly id: SystemId;
  readonly name: string;
  readonly avatarSource: ImageSource | null;
}
