import auth from "./en/auth.json";
import common from "./en/common.json";
import fronting from "./en/fronting.json";
import members from "./en/members.json";
import settings from "./en/settings.json";

import type { TranslationResources } from "@pluralscape/i18n";

export const resources: Record<string, TranslationResources> = {
  en: {
    common,
    auth,
    members,
    fronting,
    settings,
  },
};
