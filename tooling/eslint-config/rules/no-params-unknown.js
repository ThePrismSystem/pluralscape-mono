// Forbids the legacy double-validation pattern in apps/api/src/services/**:
//
// 1. `params: unknown` parameter signatures — replaced by typed
//    `body: z.infer<typeof XBodySchema>` parameters per the canonical
//    pattern (validation lives at the REST/tRPC boundary, not in services).
//
// 2. Imports of `parseAndValidateBlob` from `apps/api/src/lib/encrypted-blob.js` —
//    the helper is being retired in Task 22 of the ps-6phh plan; canonical
//    services use `validateEncryptedBlob(body.encryptedData, MAX)` instead.
//
// Lands in soft mode (every existing violation gets an inline
// `// eslint-disable-next-line` comment). Cluster commits (Tasks 5-15)
// remove those comments as services are converted. Task 22 retires the
// helper and Task 23 asserts the disable-comment count is zero.
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid params: unknown signatures and parseAndValidateBlob imports in services",
    },
    messages: {
      paramsUnknown:
        "params: unknown is the legacy double-validation pattern. Use body: z.infer<typeof XBodySchema> and validate at the route/tRPC boundary.",
      parseAndValidateBlobImport:
        "parseAndValidateBlob is being retired (Task 22 of ps-6phh). Use validateEncryptedBlob(body.encryptedData, MAX) instead.",
    },
    schema: [],
  },
  create(context) {
    function isParamUnknown(param) {
      // Match `Identifier` nodes named `params` whose type annotation is `unknown`.
      return (
        param.type === "Identifier" &&
        param.name === "params" &&
        param.typeAnnotation?.typeAnnotation?.type === "TSUnknownKeyword"
      );
    }
    function checkParams(node) {
      for (const param of node.params ?? []) {
        if (isParamUnknown(param)) {
          context.report({ node: param, messageId: "paramsUnknown" });
        }
      }
    }
    return {
      FunctionDeclaration: checkParams,
      FunctionExpression: checkParams,
      ArrowFunctionExpression: checkParams,
      // Also covers TypeScript interface/type function signatures:
      //   readonly create: (params: unknown) => Promise<T>   ← TSFunctionType
      //   create(params: unknown): Promise<T>                ← TSMethodSignature
      TSFunctionType: checkParams,
      TSMethodSignature: checkParams,
      // Anchor to the encrypted-blob module specifically — substring match
      // would also fire on hypothetical neighbors like `unencrypted-blob`.
      "ImportDeclaration[source.value=/\\/encrypted-blob(\\.js)?$/]"(node) {
        const hasParse = node.specifiers.some(
          (s) => s.type === "ImportSpecifier" && s.imported?.name === "parseAndValidateBlob",
        );
        if (hasParse) {
          context.report({ node, messageId: "parseAndValidateBlobImport" });
        }
      },
    };
  },
};
