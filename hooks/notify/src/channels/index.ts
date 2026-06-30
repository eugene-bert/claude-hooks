export interface Notification {
  summary: string;   // plain text
  context?: string;  // "drone · main · 4m"
}

export interface Channel {
  send(notification: Notification): Promise<void>;
}
