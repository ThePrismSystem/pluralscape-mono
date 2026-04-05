import { materializeDocument } from "./materialize-document.js";

import type { EventBus, DataLayerEventMap } from "../../event-bus/index.js";
import type { MaterializerDb } from "../base-materializer.js";
import type { DocumentMaterializer } from "../materializer-registry.js";

/**
 * Materializer for the `system-core` document.
 *
 * Handles: system, system-settings, member, member-photo, group,
 * structure-entity-type, structure-entity, relationship, custom-front,
 * fronting-report, field-definition, field-value, innerworld-entity,
 * innerworld-region, timer, lifecycle-event, structure-entity-link,
 * structure-entity-member-link, structure-entity-association,
 * webhook-config, group-membership.
 */
export const systemCoreMaterializer: DocumentMaterializer = {
  documentType: "system-core",

  materialize(
    doc: Record<string, unknown>,
    db: MaterializerDb,
    eventBus: EventBus<DataLayerEventMap>,
  ): void {
    materializeDocument("system-core", doc, db, eventBus);
  },
};
