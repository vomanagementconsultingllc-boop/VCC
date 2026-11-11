/** Emails a client can switch off. Everything is on unless turned off. */
export const CLIENT_NOTIFICATIONS = [
  { key: "script_ready", label: "A new script is ready for me" },
  { key: "footage_reminder", label: "Reminders when footage is due" },
  { key: "delivered", label: "My video is ready to download" },
  { key: "performance_checkin", label: "Check-in a week after I post" },
] as const;

export type NotificationKey = (typeof CLIENT_NOTIFICATIONS)[number]["key"];

export function wantsEmail(prefs: unknown, key: string): boolean {
  if (prefs && typeof prefs === "object" && key in prefs) {
    return (prefs as Record<string, unknown>)[key] !== false;
  }
  return true;
}
