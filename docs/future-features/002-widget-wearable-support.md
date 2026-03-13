# Future Feature: Widget and Wearable Support

## Metadata

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| Status               | proposed                                                               |
| Category             | integration                                                            |
| Estimated Complexity | medium                                                                 |
| Dependencies         | Fronting engine (M4), Mobile app (M8)                                  |
| Related Features     | features.md Section 19, features.md Section 2 (Fronting and Analytics) |

## Summary

Widget and wearable support brings Pluralscape's most frequently used interactions -- viewing the current fronter and logging switches -- to home screen widgets and smartwatch companions. This eliminates the friction of opening the full app for quick fronting actions, making it easier for systems to maintain accurate front logs throughout the day.

The initial scope covers home screen widgets for iOS and Android (current fronter display and quick switch) and an Apple Watch companion app (fronter glance and switch action). WearOS support may follow based on community demand.

## Motivation

Front logging is most accurate when it is low-friction. Many systems report that the biggest barrier to consistent logging is the time it takes to unlock their phone, open the app, navigate to the fronting screen, and tap through the switch flow. This delay means switches often go unlogged, especially during busy periods or rapid switching episodes.

Home screen widgets reduce this to a single glance (who is fronting) or a single tap (log a switch). Wearable companions go further by making fronting data available with a wrist raise, without even reaching for a phone. For systems that experience frequent switches or want to maintain detailed front histories, this reduction in friction can meaningfully improve the quality of their data and reduce the compulsive pressure that comes from knowing they "should" log but finding it inconvenient.

## User Stories

- As a system member, I want to see who is currently fronting on my home screen without opening the app so that I can quickly check fronting status throughout the day.
- As a system member, I want to tap a widget to log a switch so that I can record fronting changes in under two seconds.
- As a system member, I want to see the current fronter on my Apple Watch so that I can glance at my wrist during situations where pulling out my phone is impractical (therapy sessions, work meetings, etc.).
- As a system member, I want to log a switch from my Apple Watch so that I can record changes immediately, even when my phone is not accessible.
- As a system, I want the widget to show co-fronting status so that the display reflects our actual experience, not just a single fronter.
- As a system, I want the widget to show each fronter's color so that I can identify who is fronting at a glance without reading names.
- As a system member, I want the widget to be protected by device authentication so that someone who picks up my phone cannot see who is fronting.

## Proposed Behavior

### Home Screen Widgets

**Current Fronter Widget (small)**: Displays the name and color of the current fronter(s). If multiple members are co-fronting, shows all names (truncated with count if space is limited). Tapping the widget opens the app to the fronting screen.

**Quick Switch Widget (medium)**: Shows the current fronter(s) at the top, with a row of recent/favorite members below for one-tap switching. Tapping a member logs them as fronting (additive -- does not end other fronting sessions unless configured to do so). Long-pressing a member opens options (end current front, start co-front, etc.).

**Timeline Widget (large)**: Shows a condensed version of the day's fronting timeline, color-coded by member. Tapping opens the full timeline view in the app.

### Apple Watch Companion

**Fronter Glance**: A watch face complication showing the current fronter's name and color. Supports multiple complication styles (circular, rectangular, inline).

**Switch Action**: From the watch app, the user sees the current fronter(s) and a list of recent/favorite members. Tapping a member logs a switch. Haptic confirmation on successful log.

**Notification Mirroring**: Switch notifications from the phone are mirrored to the watch with member name and color.

### Data Sync

Widgets and watch companions need access to a small subset of data: current fronting sessions, member names, member colors, and the list of recent/favorite members for quick switch. This data is synced from the main app via platform-specific mechanisms:

- **iOS**: App Groups shared container (UserDefaults or Core Data) for widgets; WatchConnectivity framework for Apple Watch.
- **Android**: SharedPreferences or ContentProvider for widgets.

The sync is one-directional for display (app to widget/watch) and bidirectional for actions (switch logged on widget/watch syncs back to app, then to server via normal sync).

## Technical Considerations

### React Native Widget Libraries

React Native does not natively support home screen widgets. Options include:

- **react-native-widget-extension** (iOS) and **react-native-android-widget** (Android): Community libraries that bridge native widget APIs. Require writing some native code (SwiftUI for iOS, Kotlin/XML for Android).
- **Expo custom dev client**: Expo supports config plugins for adding native modules, which could integrate widget extensions without ejecting.

The widget UI itself must be written in native code (SwiftUI for iOS widgets, Jetpack Glance or XML for Android widgets) since React Native cannot render in widget contexts. The shared data layer (member list, fronting state) is the bridge point.

### Apple Watch

The Apple Watch companion requires a WatchKit app target, which can be added as a native extension to the Expo project. Key considerations:

- **WatchConnectivity**: Bidirectional communication between phone and watch. The phone sends updated fronting state; the watch sends switch actions back.
- **Independent operation**: The watch app should function when the phone is not nearby by caching the last known state. Switches logged offline on the watch sync when connectivity is restored.
- **Battery**: Minimize background refresh frequency. Use complication timeline entries (pre-scheduled updates) rather than polling.

### Background Sync for Widget Data

Widgets need fresh data but cannot run arbitrary code. Platform mechanisms:

- **iOS**: WidgetKit timeline provider requests updates on a schedule (minimum 15 minutes for system-managed, or on-demand via `WidgetCenter.shared.reloadTimelines`). The app updates the shared container on each fronting change, and the widget reads from it.
- **Android**: AppWidgetProvider receives update broadcasts. The app writes to SharedPreferences on fronting changes and triggers a widget update broadcast.

### Minimal Decryption on Widget

The widget data layer stores only the minimum needed: member display names, colors, and fronting session start times. This data is decrypted by the main app and written to the shared container in plaintext. The shared container itself is protected by the device's file protection (iOS) or encrypted SharedPreferences (Android).

This means the widget never performs cryptographic operations and never has access to encryption keys. The trade-off is that a small amount of plaintext data (fronter names and colors) exists in the shared container while the app is installed.

## Privacy and Encryption Implications

Widget and wearable support introduces a privacy surface that must be carefully managed:

- **Plaintext in shared container**: The widget reads plaintext member names and colors from a shared data store. This data is protected by OS-level file protection (iOS: Complete Protection until first unlock; Android: EncryptedSharedPreferences) but is not encrypted with Pluralscape's own keys. This is an acceptable trade-off because the data is on the user's own device, protected by device authentication, and limited to display-only information.
- **Watch data in transit**: Data sent between phone and watch via WatchConnectivity is encrypted by the Bluetooth/Wi-Fi transport layer. No additional Pluralscape-level encryption is applied to watch sync data, since both devices are authenticated to the same user.
- **No server involvement**: Widget and watch data never transits the server. The main app decrypts data locally and shares it with the widget/watch through local OS mechanisms. The server has no knowledge of widget usage.
- **Lock screen visibility**: Widgets on the lock screen could expose fronting information to anyone who sees the device. The app should offer a setting to redact widget content when the device is locked (iOS supports this natively via `redacted(reason: .privacy)`). Android has similar lock screen widget restrictions.
- **Wearable on someone else's wrist**: If a watch is borrowed or stolen, fronting data could be visible. The watch app should respect the device passcode and offer an option to require authentication before showing data.

## Open Questions

- Which platforms should be prioritized first? iOS widgets and Apple Watch are more mature in the React Native ecosystem, but Android has a larger user base in some plural communities.
- How much data should be cached on the watch for independent operation? Just the current fronter, or also the full member list for switching? Caching the full member list means more plaintext data on the watch.
- What is the battery impact of frequent widget updates during rapid switching episodes? Should there be a throttle (e.g., batch updates if more than N switches occur within M minutes)?
- Should the widget support custom fronts (abstract cognitive states) or only member fronting?
- Should the large timeline widget be included in the initial release, or deferred to a follow-up?
- How should the quick switch widget handle systems with hundreds of members? A favorites/recents list is necessary, but what is the right size and selection algorithm?
- Should WearOS (Android watches) be in scope for the initial release, or deferred based on community demand?
