/**
 * Forbid hand-rolled entity-shape types outside packages/types/src/entities.
 *
 * Detects type aliases or interfaces named `<Entity><Suffix>` where
 * `<Entity>` matches a registered manifest entity and `<Suffix>` is one of:
 * Body, Input, Credentials, Params, Args, Result, Wire, EncryptedFields,
 * EncryptedInput, ServerMetadata.
 *
 * Configuration:
 *   options: [{ manifestEntities: string[] }]
 *
 * In `tooling/eslint-config/index.js`, the production wiring loads the
 * manifest entities via `loadManifestEntities()` (below) which parses
 * `packages/types/src/__sot-manifest__.ts` at lint startup.
 *
 * The rule has no per-consumer allow-list. Adding a needed shape means
 * adding it to packages/types/src/entities/<entity>.ts and importing.
 */

import { readFileSync } from "node:fs";

const FORBIDDEN_SUFFIXES = [
  "Body",
  "Input",
  "Credentials",
  "Params",
  "Args",
  "Result",
  "Wire",
  "EncryptedFields",
  "EncryptedInput",
  "ServerMetadata",
];
const SUFFIX_RE = new RegExp(`^([A-Z][A-Za-z0-9]*?)(${FORBIDDEN_SUFFIXES.join("|")})$`);

function isInTypesPackage(filename) {
  const f = filename.replace(/\\/g, "/");
  return f.includes("packages/types/src/");
}

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid hand-rolled domain-type declarations outside @pluralscape/types",
    },
    messages: {
      noHandRolled:
        "Domain type `{{name}}` is hand-rolled. Import from @pluralscape/types instead. If the shape doesn't exist there, add it to packages/types/src/entities/<entity>.ts.",
    },
    schema: [
      {
        type: "object",
        properties: {
          manifestEntities: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    if (isInTypesPackage(filename)) return {};

    const opts = context.options[0] ?? {};
    const entities = new Set(opts.manifestEntities ?? []);

    function check(node, name) {
      const m = SUFFIX_RE.exec(name);
      if (!m) return;
      const [, entity] = m;
      if (entities.has(entity)) {
        context.report({ node, messageId: "noHandRolled", data: { name } });
      }
    }

    return {
      TSTypeAliasDeclaration(node) {
        check(node, node.id.name);
      },
      TSInterfaceDeclaration(node) {
        check(node, node.id.name);
      },
    };
  },
};

/**
 * Load entity names from the SoT manifest. Used by the production wiring in
 * tooling/eslint-config/index.js. Parses the manifest with a regex over the
 * top-level keys (e.g., `  Member: {`, `  Group: {`).
 *
 * Throws if the manifest file is missing — fail loud rather than silently
 * lint with an empty entity set.
 */
export function loadManifestEntities(manifestPath) {
  const src = readFileSync(manifestPath, "utf8");
  const re = /^\s+([A-Z][A-Za-z0-9]+):\s*\{$/gm;
  const out = new Set();
  let m;
  while ((m = re.exec(src)) !== null) {
    out.add(m[1]);
  }
  if (out.size === 0) {
    throw new Error(
      `loadManifestEntities: no entities found in ${manifestPath}. Manifest format may have changed; update the regex.`,
    );
  }
  return [...out];
}
