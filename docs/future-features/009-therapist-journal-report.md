# Future Feature: Therapist Report from Journal Entries

## Metadata

| Field                | Value                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Status               | proposed                                                                                                                      |
| Category             | journaling                                                                                                                    |
| Estimated Complexity | high                                                                                                                          |
| Dependencies         | Journaling (feature spec 7), fronting history (feature spec 2), privacy buckets (feature spec 4)                              |
| Related Features     | 007-outtrigger-analytics (optional inclusion), 008-traumaversary-tracking (context), fronting history report (feature spec 2) |

## Summary

Generate formatted, shareable reports from selected journal entries for use in therapy sessions. Reports include entry content with authorship attribution, optional fronting context (who was fronting when each entry was written), optional outtrigger analytics, and privacy bucket-controlled entry selection. Reports are generated entirely client-side -- the server never has access to decrypted journal data. Export formats include PDF and email. The feature bridges the gap between the encrypted, private journaling system and the practical need to share specific content with a therapist.

## Motivation

Journal entries are a core therapeutic tool for plural systems. Many therapists ask their clients to share journal excerpts, but the process of manually selecting, copying, and formatting entries is tedious and error-prone. Worse, it often means sharing via unencrypted channels (email, printed screenshots) with no structural context about who wrote what or what was happening at the time. A dedicated report generation feature streamlines this workflow, adds valuable context (fronting data, timeline, authorship), and ensures that privacy bucket controls are respected -- therapists see only what the system has explicitly chosen to share. This reduces session time spent on logistics and increases time spent on therapeutic work.

## User Stories

- As a system, I want to generate a formatted report from my journal entries for a specific date range so that I can share a structured overview with my therapist before our session.
- As a system, I want the report to show which member authored each journal entry so that my therapist can understand the perspectives of different members.
- As a system, I want to include fronting context in the report so that my therapist can see who was fronting when each entry was written, even if the author and fronter were different.
- As a system, I want the report to respect privacy bucket boundaries so that only entries tagged with buckets my therapist has access to are included, preventing accidental disclosure of private content.
- As a system, I want to optionally include outtrigger analytics in the report so that my therapist can see patterns in what triggers switches alongside the journal narrative.

## Proposed Behavior

### Entry Selection

The report generation flow starts with entry selection. Users can select entries by:

- **Date range**: all entries between two dates.
- **Tags**: entries matching specific tags.
- **Manual selection**: checkboxes on individual entries.
- **Combination**: date range filtered by tags, with manual additions/removals.

A preview shows all selected entries before report generation.

### Privacy Bucket Filtering

If the report is being generated for a specific friend/therapist, the user selects the relevant privacy bucket. Only entries tagged with that bucket (or untagged entries, depending on system settings) are eligible for inclusion. Entries outside the bucket are greyed out in the selection UI with an explanation ("This entry is not visible in the selected privacy bucket").

The user can also generate a report without bucket filtering (for personal use or manual sharing).

### Report Content

The generated report includes:

**Header**

- System name (or pseudonym, configurable).
- Date range covered.
- Generation timestamp.
- Privacy bucket used (if applicable).

**Table of Contents**

- Chronological list of included entries with dates, titles, and authors.

**Entry Sections** (one per entry)

- Entry title and timestamp.
- Author attribution (member name, or "System" for system-level entries, or multiple names for co-authored entries).
- Optional fronting context: a compact summary of who was fronting at the time of the entry, pulled from fronting history by cross-referencing the entry's timestamp with fronting session data. Displayed as a small sidebar or header note (e.g., "Fronting at time of writing: Member A, Member B").
- Full entry content (rendered from the block-based rich text format into formatted text).

**Optional: Outtrigger Analytics Section**

- If the user opts to include outtrigger analysis (from feature 007), a summary section is appended with:
  - Top outtrigger reasons for the report's date range.
  - Sentiment distribution chart.
  - Per-member outtrigger patterns for members who authored entries in the report.

**Optional: Traumaversary Context**

- If any traumaversaries (from feature 008) fall within the report's date range, they can be optionally listed for temporal context.

**Footer**

- Note that the report was generated by the user from their encrypted data.
- Reminder that the report contains sensitive decrypted content.

### Export Formats

- **PDF**: Formatted document with styled text, charts (if analytics included), and a clean layout. Generated client-side using a PDF library.
- **Email**: Composed as an email with the report as a PDF attachment or inline HTML body. The email is composed on-device using the system email client -- the app does not send emails through its own servers.

### Report Generation Flow

1. User selects "Generate Therapist Report" from the journaling section.
2. User chooses entry selection method (date range, tags, manual, or combination).
3. User optionally selects a privacy bucket to filter entries.
4. Preview screen shows selected entries with author and fronting context.
5. User toggles optional sections (outtrigger analytics, traumaversary context).
6. User selects export format (PDF or email).
7. Report is generated client-side.
8. Report is saved to device or attached to an email draft.

### Warnings

Before generating the report, a clear warning is displayed:

> This report will contain decrypted data from your encrypted journal. Once exported, this data is no longer protected by the app's encryption. Share only with trusted recipients.

The warning requires explicit acknowledgement before proceeding.

## Technical Considerations

- **Client-side report generation**: The entire report generation pipeline runs on the client. The server is never involved. This means the client must be capable of rendering rich text to PDF, including any charts if outtrigger analytics are included.
- **PDF generation library**: Options include react-native-html-to-pdf (render HTML template to PDF), react-native-pdf-lib (programmatic PDF construction), or a WebView-based approach (render HTML in a hidden WebView, print to PDF). The HTML-to-PDF approach is likely simplest for rich text content.
- **Fronting context lookup**: Cross-referencing journal entry timestamps with fronting session history requires querying the fronting sessions table for overlapping time ranges. This is a range query on the local SQLite database (T3 timestamps for session start/end, T1 encrypted member data decrypted client-side).
- **Rich text rendering**: Journal entries use a block-based rich text format. The report renderer must convert this format to styled HTML (for PDF generation) or plain text (for simple export). Member links in rich text should be rendered as member names (not interactive links) in the report.
- **Co-authored entries**: Entries written during co-fronting may have multiple authors. The report should list all authors and note the co-fronting context. If different co-fronting members authored different blocks within the same entry, per-block attribution should be preserved.
- **Large reports**: For long date ranges with many entries, the report could be substantial (hundreds of pages). Consider pagination, a "summary only" mode (entry titles and authors without full content), and progress indicators during generation.
- **Email composition**: Use the device's native email client (via react-native linking or share sheet). The app composes the email with a subject line and attaches the PDF. No server-side email sending.
- **Report caching**: Generated reports could be cached locally (encrypted) for re-sharing without regeneration. Cached reports should have an expiration or manual deletion option.

## Privacy and Encryption Implications

- **Report generation is entirely client-side.** The server never sees decrypted journal data, selected entries, fronting context, or generated reports. No server API calls are made during report generation beyond normal sync operations.
- **The generated report is unencrypted.** Once exported as a PDF or email, the data leaves the app's encrypted environment. This is by design -- the purpose is to share with a therapist -- but the user must explicitly consent to this. The warning before generation must be clear and prominent.
- **Privacy bucket controls are enforced during selection.** If a bucket is selected, entries outside that bucket cannot be included in the report, even by manual selection. This prevents accidental disclosure of content the system has not authorized for the therapist.
- **Fronting context in reports**: Fronting session timestamps are T3 (server-visible), but the member identities associated with those sessions are T1 encrypted. The report decrypts and includes member names, which is appropriate since the report is being generated for sharing. However, the fronting context shown is limited to what's visible in the selected privacy bucket.
- **Outtrigger data in reports**: Outtrigger reasons are T1 encrypted and extremely sensitive. Including them in a report is opt-in and gated behind an additional confirmation. The report includes only outtrigger data from fronting sessions that overlap with the report's date range and are visible in the selected privacy bucket.
- **No report telemetry**: The app does not track how often reports are generated, how many entries are included, or to whom they are sent. No metadata about report generation is stored server-side.

## Open Questions

- Should generated reports be saveable and versioned within the app? This would allow systems to review what they shared with their therapist previously, but it adds storage and management complexity. Saved reports would need to be encrypted at rest (T1).
- How should entries with multiple authors (co-fronting) be attributed in the report? Options: list all co-fronting members as co-authors, attribute to the member who started the entry, or show per-block authorship if the journal editor tracks it. The most accurate approach (per-block) is also the most complex.
- Should the report include member photos/avatars alongside author attribution? This makes the report more personal and easier for a therapist to follow, but photos may contain identifying information and increase PDF file size. This should be opt-in if supported.
- How should the report handle journal entries that reference other entries, members, or system concepts via links? Should linked content be included inline, referenced as footnotes, or simply rendered as plain text names?
- Should there be a "recurring report" feature that automatically generates a report for the period since the last report (e.g., weekly, before each therapy session)? This would require scheduling logic and possibly background generation, but could significantly reduce friction for systems who regularly share with their therapist.
