---
# types-11ux
title: "Type system: branded IDs, constants, and organization"
status: todo
type: task
priority: low
created_at: 2026-04-16T06:59:06Z
updated_at: 2026-04-16T06:59:06Z
parent: ps-0enb
---

Low-severity types and data package findings from comprehensive audit.

## Findings

- [ ] [TYPES-T-L1] SystemListItem exported but redefined locally — dead/misleading
- [ ] [TYPES-T-L2] SystemDuplicationScope marked @future but never imported
- [ ] [TYPES-T-L3] EntityReference<T>.entityId: string (not branded) — hole in brand system
- [ ] [TYPES-T-L4] DecryptFn/EncryptFn use Uint8Array instead of KdfMasterKey
- [ ] [TYPES-P-L1] ID_PREFIXES and IdPrefixBrandMap manually maintained
- [ ] [TYPES-P-L2] WEBHOOK_EVENT_TYPE_VALUES doesn't use satisfies
- [ ] [TYPES-S-L1] api-constants.ts is large combined file — could split per domain
- [ ] [TYPES-S-L2] MS_PER_MINUTE computed but not exported
- [ ] [DATA-P-L1] 4 older validators hand-rolled vs using shared helpers
- [ ] [DATA-P-L2] index.ts exports raw crypto helpers as public API
