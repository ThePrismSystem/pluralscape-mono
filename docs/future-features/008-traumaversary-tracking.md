# Future Feature: Traumaversary Tracking and Reminders

## Metadata

| Field                | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Status               | proposed                                                                            |
| Category             | identity                                                                            |
| Estimated Complexity | medium                                                                              |
| Dependencies         | Notification infrastructure, background jobs (feature spec 17)                      |
| Related Features     | Journaling (feature spec 7), privacy buckets (feature spec 4), calendar integration |

## Summary

A system for tracking recurring dates that hold significance for the system -- traumaversaries, discovery dates, milestones, and other meaningful anniversaries. Includes configurable reminders, calendar view integration, optional journaling prompts, and privacy-controlled sharing. Designed with extreme care for the sensitivity of this data: traumaversary details are T1 encrypted, and even the existence of tracked dates is hidden from the server to the greatest extent possible.

## Motivation

Recurring significant dates are a reality for many plural systems. Traumaversaries (anniversaries of traumatic events), discovery dates (when members were first discovered), and other milestones can bring up strong emotions, dissociative episodes, or increased switching. Being caught off-guard by these dates is distressing. Proactive awareness -- knowing a difficult date is approaching -- allows systems to prepare coping strategies, schedule therapy sessions, arrange support, and warn trusted friends. Currently, systems must track these dates externally (calendar apps, paper notes) which fragments their management tools and may expose sensitive information to non-E2E-encrypted services.

## User Stories

- As a system, I want to track recurring traumaversary dates so that we are not caught off-guard by difficult anniversaries.
- As a system, I want configurable reminders (e.g., 3 days before, 1 day before) so that I have time to prepare coping strategies and arrange support.
- As a system, I want to optionally share upcoming traumaversaries with my therapist via privacy buckets so that they can be aware and prepared for our sessions.
- As a system, I want a journaling prompt to appear on traumaversary dates so that I have a structured space to process my feelings.
- As a system member, I want to associate traumaversaries with specific members so that the members most affected are aware and can be supported.

## Proposed Behavior

### Creating Traumaversaries

A dedicated section (accessible from settings or a calendar view) allows creating tracked dates. Each entry includes:

- **Title**: a short name for the date (e.g., "Discovery day", "Hospital anniversary").
- **Date**: month and day, with an optional year. Year-agnostic dates recur every year. Year-specific dates show "X years ago" context.
- **Description**: optional rich text with additional context.
- **Associated members**: zero or more members for whom this date is particularly significant.
- **Reminder configuration**: list of reminders, each specifying days before the date and notification type (push notification, in-app alert, or both).
- **Journaling prompt**: optional custom prompt text that appears as a suggestion on the date (e.g., "How are you feeling about today?").
- **Privacy bucket assignment**: optional assignment to one or more privacy buckets for sharing with friends/therapist.

### Calendar Integration

A calendar view shows all tracked dates for the current and upcoming months. Traumaversaries are displayed with their title and a subtle indicator. Tapping a date shows full details. The calendar also shows other system events (discovery dates from lifecycle events, etc.) for a unified view.

### Reminders

Reminders fire at the configured intervals before each traumaversary. Reminders include the title and a configurable amount of detail (some systems may want "Upcoming: Discovery day in 3 days" while others may want just "You have an upcoming tracked date in 3 days" to avoid specifics in notifications).

For push notifications (which require server-side scheduling), only the next reminder fire time is stored as T3 metadata. The notification content is generic ("You have an upcoming reminder") -- the actual traumaversary details are loaded from the local encrypted database when the notification is tapped.

### Journaling Integration

On a traumaversary date, an optional journaling prompt appears in the app (not as a push notification -- only when the user opens the app). The prompt uses the custom text if configured, or a gentle default. Dismissing the prompt is always a single tap.

### Sharing

When a traumaversary is assigned to a privacy bucket, friends with access to that bucket can see:

- The title and date of the traumaversary.
- The description (if the system has chosen to share it).
- Associated member names (if those members are visible in the bucket).

This allows a therapist to see "Discovery day is coming up on March 15" and prepare accordingly.

## Technical Considerations

- **Data model**: A new `traumaversaries` table with: `id`, `system_id`, `title` (T1 encrypted), `month`, `day`, `year` (nullable), `description` (T1 encrypted), `associated_member_ids` (T1 encrypted), `reminder_config` (T1 encrypted), `journal_prompt` (T1 encrypted), `privacy_bucket_ids` (T2 for shared entries), `created_at`, `updated_at`.
- **Recurring date logic**: Must correctly handle February 29 for year-agnostic dates (skip in non-leap years or show on Feb 28/Mar 1 -- make this configurable). All date calculations should be timezone-aware using the system's configured timezone.
- **Reminder scheduling**: Reminders for the next occurrence are scheduled via the background job system. When a reminder fires, the next one is scheduled. For push notifications, the server needs only the next fire timestamp (T3) and a generic notification payload.
- **Calendar widget**: A month-view calendar component that renders traumaversary markers. Should integrate with any future calendar features (fronting calendar view, etc.).
- **CRDT sync**: Traumaversary data syncs via the standard CRDT sync layer. Conflict resolution follows normal Automerge semantics.
- **Performance**: The number of traumaversaries per system is expected to be small (tens, not thousands), so performance is not a concern for the data model. Calendar rendering should remain efficient.

## Privacy and Encryption Implications

- This is among the most privacy-critical features in the entire application. Traumaversary data may directly describe traumatic events, and even the existence of tracked dates could reveal information about a system's trauma history.
- **Title, description, associated members, reminder config, and journal prompt** are all T1 encrypted (zero-knowledge). The server stores only ciphertext.
- **Month and day fields**: These must also be T1 encrypted. If stored in plaintext, the server could correlate dates across systems or infer the nature of traumaversaries from their dates. The server should not know when traumaversaries occur.
- **Reminder scheduling challenge**: For server-side push notifications, the server needs to know when to fire a reminder. The next fire timestamp is T3 (plaintext metadata). To minimize information leakage, only the single next fire time is stored (not the full reminder schedule or the traumaversary date). After a reminder fires, the client calculates and stores the next fire time. A server observer can see that reminders are firing but cannot determine the underlying pattern or date without sustained observation over multiple years.
- **Privacy bucket sharing**: When shared via a bucket, traumaversary data is T2 encrypted with the bucket's symmetric key. The server can route the data to authorized friends but cannot read it.
- **Existence inference**: Ideally, the server should not be able to determine whether a system has any traumaversaries at all. This is difficult if reminder timestamps are stored as T3 metadata. Consider using a uniform reminder schedule (e.g., always having a next-fire-time entry, even if it's a no-op) to prevent the server from inferring the presence/absence of traumaversaries from metadata patterns.

## Open Questions

- Should traumaversaries be per-member, per-system, or both? Some traumaversaries affect the entire system, while others are specific to individual members. A flexible model (associated members as optional) covers both cases, but the UI should make this distinction clear.
- How should timezone-aware reminders work for systems that travel or have members in different perceived timezones (innerworld time vs. body timezone)? Using the device's current timezone seems most practical, but edge cases exist around timezone changes near a traumaversary date.
- Should there be a "safe mode" or "crisis mode" that suppresses traumaversary reminders? If a system is already in crisis, a traumaversary reminder could be harmful rather than helpful. This could be a manual toggle or integrate with a future crisis/safe mode feature.
- How should the app handle the first year of use, when traumaversary dates that have already passed this year are entered? Should it immediately show "X days until next occurrence" for the following year, or acknowledge that the date passed recently?
- Should traumaversaries support a "severity" or "difficulty level" field to help systems prioritize preparation? This risks being reductive about trauma, but some systems might find it useful for planning purposes.
