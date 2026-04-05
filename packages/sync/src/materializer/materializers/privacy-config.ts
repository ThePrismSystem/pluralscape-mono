import { materializeDocument } from "./materialize-document.js";

import type { EventBus, DataLayerEventMap } from "../../event-bus/index.js";
import type { MaterializerDb } from "../base-materializer.js";
import type { DocumentMaterializer } from "../materializer-registry.js";

/**
 * Materializer for the `privacy-config` document.
 *
 * Handles: bucket, bucket-content-tag, friend-connection, friend-code,
 * key-grant, field-bucket-visibility.
 */
export const privacyConfigMaterializer: DocumentMaterializer = {
  documentType: "privacy-config",

  materialize(
    doc: Record<string, unknown>,
    db: MaterializerDb,
    eventBus: EventBus<DataLayerEventMap>,
  ): void {
    materializeDocument("privacy-config", doc, db, eventBus);
  },
};
