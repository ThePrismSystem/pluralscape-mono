---
# db-pz23
title: Rename frontingReports.format to chartType for clarity
status: scrapped
type: task
priority: low
created_at: 2026-03-13T05:00:31Z
updated_at: 2026-03-13T05:58:32Z
parent: db-hcgk
---

## Reasons for Scrapping

The audit finding L7 stated the enum values were chart types (pie, bar, timeline), but the actual values are `["html", "pdf"]` — which are output formats. The current column name `format` and enum name `FRONTING_REPORT_FORMATS` are correct.
