export const DEEP_LINK_PREFIXES = ["pluralscape://", "https://app.pluralscape.org"] as const;

export const NOTIFICATION_ROUTES = {
  friend_request: "/(app)/social/friends",
  message: "/(app)/comms/chat",
  fronting_change: "/(app)/(tabs)",
} as const;
