export type NotificationNavigationIntent =
  | { type: 'individual'; accountId: string; quotaWindowId: string }
  | { type: 'burst' };

let pendingIntent: NotificationNavigationIntent | null = null;

export const navigationIntentStore = {
  setIntent(intent: NotificationNavigationIntent) {
    pendingIntent = intent;
  },

  getAndClearIntent(): NotificationNavigationIntent | null {
    const current = pendingIntent;
    pendingIntent = null;
    return current;
  },

  peekIntent(): NotificationNavigationIntent | null {
    return pendingIntent;
  },

  clear() {
    pendingIntent = null;
  },
};
