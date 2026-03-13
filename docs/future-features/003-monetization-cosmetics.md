# Future Feature: Cosmetic-Only Monetization

## Metadata

| Field                | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| Status               | proposed                                                       |
| Category             | monetization                                                   |
| Estimated Complexity | medium                                                         |
| Dependencies         | User accounts, Friend network (for supporter badge visibility) |
| Related Features     | features.md Section 20                                         |

## Summary

Pluralscape's monetization model is strictly cosmetic. Premium themes, an avatar frame assembler, and a supporter badge provide optional visual enhancements that generate revenue to cover server and infrastructure costs. No functional feature is paywalled -- not now, not ever. All therapeutic, identity management, fronting, communication, and privacy features remain free for all users regardless of payment status.

This is a core value of the project, not just a business decision. Plurality management tools serve a community that includes minors, disabled individuals, and people in financial hardship. Gating functional features behind payment would be antithetical to the project's purpose.

## Motivation

Running a hosted service costs money. Server infrastructure, database hosting, S3 storage, push notification services, and domain/SSL costs are ongoing expenses that grow with the user base. Without a revenue model, the project either becomes unsustainable or must rely on donations alone, which historically leads to funding instability for community tools.

Cosmetic monetization solves this by offering optional visual enhancements that users can purchase to support the project while getting something personally meaningful in return. Plural systems often place high value on visual customization -- member colors, avatars, and themes are important expressions of identity. Cosmetic purchases align with this existing desire rather than creating artificial scarcity.

The key constraint is that revenue covers server costs only. This is not a profit-driven model. If costs are covered, there is no pressure to upsell or expand the premium offering into functional territory.

## User Stories

- As a system, I want to purchase premium themes so that I can customize the app's appearance to better reflect our identity.
- As a system, I want to use an avatar frame assembler so that member avatars can have unique visual treatments (borders, shapes, backgrounds) that distinguish them.
- As a system, I want a supporter badge visible on the friend network so that friends can see we support the project, and so we feel good about contributing.
- As a user who cannot afford to pay, I want confidence that I will never be locked out of any feature so that I can use the app without anxiety about future paywalls.
- As a self-hosted user, I want the same functional features as hosted users so that choosing to self-host does not mean a degraded experience (cosmetics may not apply to self-hosted instances).
- As a system with littles, I want to know that cosmetic purchases are clearly labeled and require confirmation so that accidental purchases are prevented, especially in Littles Safe Mode.

## Proposed Behavior

### Premium Themes

Users can browse a theme store within the app settings. Themes control:

- Primary and accent colors (or gradient pairs)
- Background patterns or textures
- Font weight and style preferences (within the dynamic typography system)
- Dark mode and light mode variants (each theme includes both)

Themes are applied globally to the app UI. They do not affect member colors (which are user-configured per member) but complement them. A preview mode lets users see a theme applied before purchasing.

Free users have access to a set of default themes (light, dark, high-contrast, and a small selection of community-designed options). Premium themes offer more variety and customization depth (e.g., full gradient control, custom accent color pickers).

### Avatar Frame Assembler

The frame assembler is a compositing tool for member avatars. Users can layer:

- **Border shapes**: Circle, rounded square, hexagon, diamond, shield, star, custom polygon
- **Border styles**: Solid, gradient, animated shimmer, glow
- **Background fills**: Solid color, gradient, pattern, transparent
- **Decorative elements**: Small icons or symbols positioned around the frame edge

Frames are rendered client-side as SVG or Canvas composites overlaid on the member's avatar image. The frame configuration is stored as a JSON object in the member profile (T1 encrypted, like all member data). A set of basic frames (solid circle, solid square) are free. Premium frames include animated effects, complex shapes, and decorative elements.

### Supporter Badge

Systems that have made any purchase (theme or frame) or who maintain an active supporter subscription receive a supporter badge. The badge appears:

- On their system profile when viewed by friends
- Next to their system name in friend lists
- Optionally in the friend network dashboard

The badge is a simple visual indicator (a small icon or border treatment) -- not a ranked tier system. There is one badge, not bronze/silver/gold. The goal is to acknowledge support, not create hierarchy.

Badge visibility is T3 (server-visible) because the server needs to know supporter status to include the badge in friend-facing data. The badge is a boolean flag on the account, not a detailed purchase history.

### Purchase Flow

Purchases are handled through platform-native payment systems:

- **iOS**: Apple In-App Purchases (required by App Store policy)
- **Android**: Google Play Billing or direct payment (Stripe) if sideloaded
- **Web**: Stripe checkout

All purchase flows include:

- Clear pricing with no hidden fees
- Preview before purchase
- Confirmation step with explicit "Buy" action
- Receipt via email
- Refund instructions visible in purchase confirmation

In Littles Safe Mode, the theme store and frame assembler are hidden entirely (no purchase UI is accessible).

## Technical Considerations

### Payment Processing

- **RevenueCat**: Cross-platform subscription and in-app purchase management. Handles Apple/Google receipt validation, subscription lifecycle, and cross-platform entitlement tracking. Avoids building custom receipt validation.
- **Stripe**: Direct payment for web purchases and Android sideloaded installs. Stripe handles PCI compliance and payment method storage.
- **Entitlement sync**: Purchase state (which themes/frames a user owns) must sync across devices. RevenueCat provides this for mobile; Stripe webhooks update the server for web purchases. The server stores a list of owned entitlements (T3, since it needs to gate access).

### Theme Engine

The app already supports dark mode and dynamic typography. The theme engine extends this with:

- A theme configuration schema (JSON) defining color tokens, gradients, and style overrides
- A React Native theme provider that maps configuration to StyleSheet values
- Hot-swappable themes (no app restart required)
- Theme previewing without purchasing (apply temporarily, revert on dismiss)

### Frame Compositing

Avatar frames are rendered as layered composites:

- Base layer: member avatar image (decrypted from blob storage)
- Frame layer: SVG or Canvas overlay defined by the frame configuration
- The composed result can be cached locally for performance
- Frame configuration is a JSON object stored alongside member profile data (T1 encrypted)

Frame rendering must be performant on low-end devices, especially for member lists where many framed avatars appear simultaneously. Consider pre-rendering frame composites at common sizes and caching them.

### Digital Goods Delivery

Purchased themes and frames are not large binary assets -- they are configuration objects (JSON + SVG paths). Delivery is instant: on purchase confirmation, the entitlement is recorded and the configuration is available immediately. No download step is needed.

For animated frames, the animation definitions (CSS keyframes or Lottie JSON) are bundled with the app and unlocked by entitlement, rather than downloaded separately.

### Regional Pricing

Platform stores (Apple, Google) support regional pricing tiers. Stripe supports currency-specific pricing. The pricing should be set to be accessible in lower-income regions while covering costs in aggregate.

## Privacy and Encryption Implications

Monetization introduces a minimal privacy surface that must be managed carefully:

- **Payment information**: Pluralscape never stores payment card details, bank accounts, or billing addresses. All payment processing is delegated to third-party processors (Apple, Google, Stripe) that handle PCI compliance. The server stores only: entitlement list (which items are owned), supporter status (boolean), and a processor-specific customer ID (for refund handling).
- **Supporter status is T3 (server-visible)**: The server needs to know whether a system is a supporter to include the badge in friend-facing data. This is the minimum information needed. The server does not know which specific themes or frames were purchased -- only that the user has supporter status.
- **Theme preferences are T1 (encrypted)**: The specific theme a user has selected is part of their app settings, which are encrypted client-side. The server cannot determine which theme a user is using.
- **Frame configurations are T1 (encrypted)**: Frame configurations are stored as part of member profile data, which is T1 encrypted. The server stores ciphertext and cannot see frame choices.
- **Purchase history**: Detailed purchase history is held by the payment processor, not by Pluralscape's server. The server knows entitlements (what you own) but not transaction details (when you bought it, how much you paid, what payment method you used).
- **No purchase-based analytics**: Pluralscape does not track which themes are popular, which frames are most used, or any purchase funnel metrics. This is consistent with the no-telemetry-without-opt-in principle.
- **Self-hosted instances**: Cosmetic monetization does not apply to self-hosted deployments. Self-hosted users have access to all themes and frames without payment (since there are no server costs to cover). The theme and frame assets are included in the self-hosted binary.

## Open Questions

- What is the right pricing model? One-time purchase per theme/frame, or a monthly supporter subscription that unlocks all cosmetics? A subscription provides more predictable revenue but may feel extractive to users who just want one theme.
- Should regional pricing be set manually per region, or should it follow platform-recommended tiers?
- Should gift purchases be supported (buy a theme for a friend's system)? This adds complexity to the purchase flow and entitlement system but could be a meaningful social feature.
- How should cosmetic entitlements be handled if a user switches between hosted and self-hosted? If they return to hosted, should their purchases still be valid?
- Should community-designed themes be accepted (with revenue sharing or as free contributions)? This could expand the theme library without internal design effort.
- What is the minimum viable set of premium cosmetics for launch? A small, curated set is better than a large, low-quality catalog.
