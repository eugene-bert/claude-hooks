import type { Channel } from "./index.js";

export class DiscordChannel implements Channel {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async send(message: string): Promise<void> {
    const res = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord webhook error ${res.status}: ${body}`);
    }
  }
}
