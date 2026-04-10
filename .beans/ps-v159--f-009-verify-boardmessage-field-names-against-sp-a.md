---
# ps-v159
title: "F-009: Verify boardMessage field names against SP API"
status: todo
type: task
priority: normal
created_at: 2026-04-10T21:05:42Z
updated_at: 2026-04-10T21:05:42Z
parent: ps-n0tq
---

SPBoardMessage uses writer/readBy but SP API may use writtenBy/writtenFor/read. Internal types are self-consistent but may mismatch real API. Verify against SP source.
