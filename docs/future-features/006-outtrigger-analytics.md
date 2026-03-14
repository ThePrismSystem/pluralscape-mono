# Future Feature: Outtrigger Analytics and Reporting

## Metadata

| Field                | Value                                                                                |
| -------------------- | ------------------------------------------------------------------------------------ |
| Status               | proposed                                                                             |
| Category             | analytics                                                                            |
| Estimated Complexity | high                                                                                 |
| Dependencies         | L5 (outtrigger reason field on fronting sessions)                                    |
| Related Features     | 008-therapist-journal-report (report inclusion), fronting analytics (feature spec 2) |

## Summary

Client-side analytics on decrypted outtrigger reason data from fronting sessions. Provides frequency analysis, per-member pattern detection, sentiment distribution, temporal correlations, and trend visualization. All analysis runs entirely on the client -- the server cannot read encrypted outtrigger data. Includes exportable reports (HTML/PDF) suitable for therapy sessions.

## Motivation

Outtrigger reasons capture why a switch happened -- what external or internal event prompted a change in who is fronting. Over time, this data reveals patterns that are therapeutically valuable: which situations consistently bring specific members forward, whether certain times of day or days of the week correlate with specific switch triggers, and how outtrigger patterns change over months or years. Currently, identifying these patterns requires manual review of individual fronting sessions, which is impractical for systems with frequent switches. Automated analysis surfaces these patterns without requiring manual correlation, and exportable reports make it easy to bring structured insights to therapy sessions.

## Proposed Behavior

### Analytics Dashboard

A dedicated analytics view (accessible from the fronting section) presents outtrigger data through several lenses:

**Frequency Analysis**

- Bar chart or word cloud of most common outtrigger reasons.
- Grouped by similarity (NLP-lite clustering: "work stress", "stressed at work", and "work was stressful" are grouped together).
- Filterable by date range and member.

**Per-Member Patterns**

- Each member has an outtrigger profile showing their most common triggers.
- Comparison view: side-by-side outtrigger profiles for two or more members.
- Highlights members with highly specific triggers vs. members who front for diverse reasons.

**Sentiment Distribution**

- Outtrigger reasons categorized by sentiment (positive, negative, neutral).
- Distribution pie chart showing overall sentiment balance.
- Sentiment trend line over time (are switches becoming more or less stress-driven?).

**Temporal Correlations**

- Heatmap: outtrigger frequency by hour-of-day and day-of-week.
- Per-reason temporal patterns (e.g., "nightmares" clusters in early morning hours).
- Seasonal/monthly trend charts.

**Trend Charts**

- Line charts showing outtrigger category frequency over weeks/months.
- Ability to overlay multiple categories on the same chart.
- Rolling averages to smooth out noise.

### Report Export

Reports can be generated in HTML or PDF format, including:

- Selected charts and visualizations.
- Summary statistics (total switches, most common reasons, trend direction).
- Date range and member filters applied.
- Optional inclusion of raw outtrigger entries (with timestamps and fronting member).

Reports are generated entirely client-side and saved to the device. They are not uploaded to the server.

## Technical Considerations

- **Client-side analysis**: All analytics run on decrypted data in the client. The server has no involvement in analysis. This means analysis performance is bounded by client device capability and dataset size.
- **NLP-lite text clustering**: Grouping similar outtrigger reasons requires some text similarity analysis. Options range from simple (stemming + Levenshtein distance) to moderate (TF-IDF + cosine similarity). Full NLP models are likely too heavy for mobile. A pragmatic approach: normalize text (lowercase, remove punctuation, stem), then cluster by word overlap with a configurable similarity threshold.
- **Sentiment analysis**: Lightweight sentiment classification. Could use a simple lexicon-based approach (positive/negative word lists) rather than a full ML model. Must handle plurality-specific vocabulary (e.g., "triggered" has specific meaning in this context and should not be naively classified).
- **Chart rendering**: Use a cross-platform charting library compatible with React Native (e.g., Victory Native, react-native-chart-kit, or a WebView-based solution like ECharts for more complex visualizations).
- **PDF generation**: Client-side PDF generation from rendered charts and data. Options include react-native-html-to-pdf or similar. Charts may need to be rendered as images first.
- **Performance**: For systems with thousands of switches, analysis should be lazy-loaded and cached. Consider background computation with progress indicators for large datasets.

## Privacy and Encryption Implications

- Outtrigger reason data is among the most sensitive data in the app. Outtrigger reasons may describe trauma triggers, abuse situations, or other deeply personal content. All outtrigger data is T1 encrypted (zero-knowledge). The server never has access to this data in any form.
- All analytics computation happens exclusively on the client, on decrypted data held in memory. No analytics results, intermediate computations, or aggregated statistics are ever sent to the server.
- Generated reports (HTML/PDF) are unencrypted files saved to the device. Users must be warned that exported reports leave the encrypted environment. Reports should include a header noting they contain sensitive decrypted data.
- If outtrigger analytics are optionally included in therapist reports (see feature 008), the same privacy bucket controls apply -- only outtrigger data associated with fronting sessions visible to the therapist's bucket are included.

## Open Questions

- How sophisticated should the text clustering/similarity analysis be? Simple stemming and word overlap may miss semantic similarities ("car accident" and "traffic collision"), but full NLP is too heavy for mobile. Is a middle ground (pre-built synonym lists for common outtrigger themes) worth the maintenance burden?
- Should the system be able to learn and suggest outtrigger categories (user-defined tags like "work", "trauma", "social") that can be assigned to freetext reasons for easier filtering? This would be a structured overlay on unstructured data.
- How should outtrigger analytics integrate with journal entries? If a journal entry was written during the same fronting session that has an outtrigger reason, should the analytics view link to that entry for deeper context?
- What is the minimum dataset size before analytics become meaningful? Should the feature show a "not enough data" state and suggest how many more logged outtrigger reasons are needed for useful analysis?
- Should there be a way to exclude specific outtrigger entries from analysis (e.g., entries the system considers noise, errors, or content that would be triggering to review) without deleting them from the fronting record?
- Should the analytics view for outtrigger data be gated behind an optional trigger warning modal/screen, given that reviewing aggregated outtrigger patterns could surface difficult content?
