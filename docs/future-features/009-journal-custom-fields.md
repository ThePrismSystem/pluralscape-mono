# Future Feature: Custom Fields on Journal Entries

## Metadata

| Field                | Value                                                                                |
| -------------------- | ------------------------------------------------------------------------------------ |
| Status               | proposed                                                                             |
| Category             | journaling                                                                           |
| Estimated Complexity | medium                                                                               |
| Dependencies         | Custom fields system (FieldDefinition/FieldValue), journal entries, analytics engine |
| Related Features     | features.md Section 1 (custom fields), features.md Section 7 (journaling)            |

## Summary

Extends the existing FieldDefinition/FieldValue custom fields system to support journal entries as a target entity. Currently, custom fields only apply to members. This feature adds a new entity scope for journal entries, enabling quick-entry numeric fields (e.g., "anxiety level 1-10", "dissociation intensity 1-5") that can be filled in alongside a journal entry. Numeric fields are surfaced through chart and trend analytics, with aggregate views segmented by the member who authored the entry.

Field definitions are created at the system level (not per-entry), matching the existing pattern for member custom fields. This means every journal entry can be tagged with the same set of fields, enabling consistent longitudinal tracking.

## Motivation

Journal entries capture qualitative experiences, but many systems also want to track quantitative self-reported data over time. Dissociation intensity, emotional states, energy levels, and symptom severity are all things systems commonly track in external apps or spreadsheets. By attaching custom numeric fields directly to journal entries, Pluralscape can become the single place where both narrative and quantitative self-tracking live together.

This is especially valuable for systems working with therapists. Trends in self-reported data over weeks or months can surface patterns that are hard to notice in free-text entries alone. Combining a dissociation intensity rating with the fronting context of who wrote the entry allows per-member trend analysis -- a protector's anxiety levels over time, or a little's comfort ratings session by session.

## Proposed Behavior

### Defining Fields

In the system settings, alongside the existing custom fields management for members, a new section allows defining fields scoped to journal entries. The creation form is the same (name, type, validation rules) but includes a scope selector set to "journal entry." Initially, only numeric types (integer, decimal, scale) are supported for journal entry fields, since the primary use case is quantitative tracking. Text and select fields may be added later.

### Filling In Fields During Entry Creation

When composing a journal entry, a collapsible "Quick Fields" section appears below the rich text editor. Each defined journal field is shown as a compact input (slider for scales, number input for integers/decimals). All fields are optional. The section remembers whether it was expanded or collapsed from the previous entry.

### Viewing Fields on Existing Entries

When viewing a journal entry, any filled-in field values are displayed in a compact bar below the entry metadata (date, author, tags). Unfilled fields are not shown in the read view.

### Analytics and Charts

A dedicated analytics view (accessible from the journaling section) lets the user select a field and a date range. The view renders a line chart showing values over time, with data points labeled by entry date. A filter allows narrowing by authoring member, so the user can see one member's trend in isolation or compare across members. Aggregate statistics (mean, min, max, standard deviation) are shown alongside the chart. This reuses the analytics chart infrastructure built for other metrics.

### Aggregate Views Per Member

Each member's profile includes a section showing their journal field averages and trends -- aggregated from entries they authored. This provides a per-member lens on the same data available in the global analytics view.

## Technical Considerations

### FieldDefinition Extension

The existing `FieldDefinition` model gains an `entityScope` discriminator field. Currently all definitions are implicitly scoped to "member." This feature adds "journal-entry" as a second scope value. The discriminator is stored as a T1-encrypted field within the definition blob. Existing member-scoped definitions do not require migration -- they default to "member" scope.

### FieldValue FK Extension

`FieldValue` currently references a `memberId` to associate a value with a member. For journal-entry-scoped fields, a new optional `journalEntryId` foreign key is added. A FieldValue has exactly one of `memberId` or `journalEntryId` set, enforced by a check constraint. The field definition's `entityScope` must match the FK that is populated.

### Analytics Queries

Analytics queries aggregate FieldValues by field definition ID, filtered by entity scope "journal-entry." Grouping by author is achieved by joining through the journal entry to its author (member or structure entity). Date range filtering uses the journal entry's `createdAt` timestamp. All analytics computation happens client-side on decrypted data -- the server never sees field names, values, or aggregations.

### Chart Rendering

Charts reuse the existing analytics chart infrastructure. The journal analytics view passes the same data format (timestamp + value pairs) that the chart components already accept. Member-colored data series allow visual comparison across authors.

## Privacy and Encryption Implications

All custom field data follows the existing T1 encryption model. Field definitions (including name, description, and validation rules) are stored as encrypted blobs. Field values (the actual numeric ratings) are encrypted alongside the journal entry data. The server cannot see field names, values, or any analytics derived from them.

Analytics are computed entirely client-side. The app decrypts field values locally, runs aggregation queries in-memory or against the local SQLite database, and renders charts from the results. No analytics data is ever sent to the server.

Field definitions and values sync between devices using the same CRDT mechanism as other encrypted data. The `entityScope` discriminator is part of the encrypted blob, so the server cannot distinguish member-scoped definitions from journal-entry-scoped definitions.

## Open Questions

- Should fields be pre-filled based on the most recent previous entry's values, to speed up data entry for fields that change incrementally? This could be helpful but might also introduce bias (anchoring to the previous value).
- Should there be "quick entry" templates that bundle common field combinations (e.g., a "daily check-in" template with anxiety, dissociation, and energy fields pre-selected)? How would these interact with future feature 011 (member templates)?
- How should field values be handled when an entry has multiple authors due to co-fronting? Options include: one set of values per entry (reflecting the collective experience), one set per author (each co-fronter rates independently), or letting the authors decide per entry.
- Should field definitions support a "default value" or "not applicable" option, distinct from leaving the field blank? Blank could mean "skipped" while N/A means "this field does not apply to this entry."
- Should there be an import mechanism for historical data from external tracking apps (e.g., CSV import of mood ratings with timestamps)?
