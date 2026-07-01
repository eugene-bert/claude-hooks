export interface Notification {
  summary: string;   // plain text
  context?: string;  // "drone · main · 4m"
  emoji?: string;    // ⚡ | ⏳ | 🚫
}

export interface Channel {
  send(notification: Notification): Promise<void>;
}
