// Matches hand-rolled request input type names:
// - *Body, *Credentials, *Params, *Args — always forbidden
// - *Input — forbidden UNLESS preceded by "Encrypted" (canonical chain: XEncryptedInput)
const REJECTED_BODY_CREDS_PARAMS_ARGS = /^[A-Z]\w*(Body|Credentials|Params|Args)$/;
const REJECTED_BARE_INPUT = /^[A-Z]\w*(?<!Encrypted)Input$/;

const WHITELIST = new Set([
  // Class C/D/E auxiliary payloads
  "DeviceInfo",
  "SnapshotContent",
  "ApiKeyEncryptedPayload",
  "ApiKeyEncryptedPayloadMetadata",
  "ApiKeyEncryptedPayloadCrypto",
  "CheckInRecordEncryptedPayload",
  // Discriminated mappings
  "ImportEntityTargetIdMap",
  // Domain helpers
  "AccountType",
  "PendingAccountId",
  "AuditEventType",
  "AuditActor",
  "SetupStepName",
  "EncryptionTier",
  "BlobPurpose",
  "ExportRequestStatus",
  "ExportFormat",
  "ExportSection",
  "DownloadableReport",
  "ExportManifest",
  "MemberReport",
  "SystemOverviewReport",
  "ReportFormat",
  "NotificationEventType",
  "NotificationPayload",
  "SyncDocumentType",
  "DocumentKeyType",
  "SyncIndicatorStatus",
  "SyncState",
  "SyncIndicator",
  "BlobUploadRequest",
  "BlobDownloadRef",
]);

// Allow-list (G8 soft mode — emptied in Task 21 / G8 strict):
const ALLOW_LIST = new Set([
  "LoginCredentials",
  "RegistrationInitiateInput",
  "RegistrationCommitInput",
]);

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
      if (WHITELIST.has(name) || ALLOW_LIST.has(name)) return;
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
