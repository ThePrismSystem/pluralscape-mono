// Forbids hand-rolled request input type names in `@pluralscape/types/entities/**`.
// The canonical chain (per ADR-023) keeps request shapes in `@pluralscape/validation`
// as Zod schemas; consumers use `z.infer<typeof XBodySchema>` instead of importing
// hand-rolled interfaces from `@pluralscape/types`.
//
// Two regex patterns:
// - `Body|Credentials|Params|Args` suffixes are always rejected.
// - `Input` suffix is rejected UNLESS preceded literally by "Encrypted" — this
//   permits the canonical encrypted-input chain types (`MemberEncryptedInput`,
//   `ChannelEncryptedInput`, etc.). The lookbehind only checks for the literal
//   string "Encrypted" immediately before "Input"; in theory a name like
//   `NotEncryptedInput` would slip through, but no such name exists in the
//   domain (the canonical X-prefix is always an entity name).
const REJECTED_BODY_CREDS_PARAMS_ARGS = /^[A-Z]\w*(Body|Credentials|Params|Args)$/;
const REJECTED_BARE_INPUT = /^[A-Z]\w*(?<!Encrypted)Input$/;

// Allow-list — empty (G8 strict, Task 21 of ps-6phh). Drift recurrence
// requires bypassing CI: the regression test in
// `tooling/eslint-config/rules/__tests__/allow-lists-empty.test.js`
// asserts this set is literally empty (Task 23).
const ALLOW_LIST = new Set([]);

export default {
  allowList: ALLOW_LIST,
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
      if (ALLOW_LIST.has(name)) return;
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
