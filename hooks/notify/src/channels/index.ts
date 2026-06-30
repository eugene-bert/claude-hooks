export interface Channel {
  send(message: string): Promise<void>;
}
