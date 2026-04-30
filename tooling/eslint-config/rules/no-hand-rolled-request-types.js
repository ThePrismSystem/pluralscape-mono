/**
 * G8 (strict): no hand-rolled `*Body`, `*Input`, `*Credentials`, `*Params`,
 * or `*Args` interfaces or type aliases in `@pluralscape/types/entities/**`.
 * Use `z.infer<typeof XBodySchema>` (or peer schema) from
 * `@pluralscape/validation` instead.
 *
 * Rationale: the canonical chain (see ADR-023) treats Zod schemas as the
 * single source of truth for request shapes. Hand-rolled mirrors drift.
 *
 * The rule has no allow-list. Exceptions require modifying this file
 * directly, which is reviewed at the same level as a feature change.
 *
 * Suffix patterns:
 * - `Body|Credentials|Params|Args` are always rejected.
 * - `Input` is rejected unless the literal substring "Encrypted"
 *   immediately precedes it — permits the canonical encrypted-input
 *   chain (`MemberEncryptedInput`, `ChannelEncryptedInput`, etc.).
 *   Lowercase variants (`UnencryptedInput`) are still rejected because
 *   the lookbehind checks for capital-E "Encrypted".
 */
const REJECTED_BODY_CREDS_PARAMS_ARGS = /^[A-Z]\w*(Body|Credentials|Params|Args)$/;
const REJECTED_BARE_INPUT = /^[A-Z]\w*(?<!Encrypted)Input$/;

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hand-rolled request input types in @pluralscape/types/entities",
    },
    messages: {
      rejectedSuffix:
        "Hand-rolled request type '{{name}}' (suffix Body/Input/Credentials/Params/Args). Use z.infer<typeof XBodySchema> from @pluralscape/validation instead.",
    },
    schema: [],
  },
  create(context) {
    function check(node, name) {
      if (REJECTED_BODY_CREDS_PARAMS_ARGS.test(name) || REJECTED_BARE_INPUT.test(name)) {
        context.report({ node, messageId: "rejectedSuffix", data: { name } });
      }
    }
    return {
      "ExportNamedDeclaration > TSInterfaceDeclaration"(node) {
        if (node.id?.name) check(node, node.id.name);
      },
      "ExportNamedDeclaration > TSTypeAliasDeclaration"(node) {
        if (node.id?.name) check(node, node.id.name);
      },
    };
  },
};
