import type { Channel, Notification } from "./index.js";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export class TelegramChannel implements Channel {
  private token: string;
  private chatId: string;

  constructor(token: string, chatId: string) {
    this.token = token;
    this.chatId = chatId;
  }

  async send(notification: Notification): Promise<void> {
    const ctx = notification.context ? `<code>${esc(notification.context)}</code> ` : "";
    const text = `${notification.emoji ?? "⚡"} ${ctx}${esc(notification.summary)}`;

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram API error ${res.status}: ${body}`);
    }
  }
}
