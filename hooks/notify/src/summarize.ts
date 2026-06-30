import { readFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
const MODEL = "claude-haiku-4-5-20251001";
const VERTEX_MODEL = "claude-haiku-4-5@20251001";
const DEFAULT_VERTEX_REGION = "us-east5";
const BEDROCK_MODEL = "anthropic.claude-haiku-4-5-20251001-v1:0";
const DEFAULT_OLLAMA_HOST = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-haiku-4-5";

const DEFAULT_PROMPT_TEMPLATE = `You are summarizing what a coding AI assistant just did in a terminal session.

Last tool calls:
{{TOOL_CALLS}}

{{LAST_MESSAGE}}

Determine the situation and write 1-2 sentences in plain English:
- If the assistant finished a task: summarize what was accomplished.
- If the assistant is waiting for user input or has a question: start with "Waiting:" and state what's needed.
- If the assistant hit an error or is blocked: start with "Blocked:" and state what went wrong.

Be specific and concise. No fluff.`;

const PROMPT = (toolCalls: string[], lastMessage: string): string => {
  let template = DEFAULT_PROMPT_TEMPLATE;
  const promptFile = process.env.CLAUDE_NOTIFY_PROMPT_FILE;
  if (promptFile) {
    try {
      template = readFileSync(promptFile, "utf8");
    } catch {}
  } else if (process.env.CLAUDE_NOTIFY_PROMPT) {
    template = process.env.CLAUDE_NOTIFY_PROMPT;
  }
  const lastMsgSection = lastMessage
    ? `Last message from assistant:\n${lastMessage}`
    : "";
  return template
    .replace("{{TOOL_CALLS}}", toolCalls.map(t => `- ${t}`).join("\n"))
    .replace("{{LAST_MESSAGE}}", lastMsgSection);
};

async function summarizeViaOllama(toolCalls: string[], lastMessage: string): Promise<string> {
  const host = process.env.OLLAMA_HOST ?? DEFAULT_OLLAMA_HOST;
  const model = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;

  const res = await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: PROMPT(toolCalls, lastMessage), stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json() as { response: string };
  return data.response.trim();
}

async function summarizeViaBedrock(toolCalls: string[], lastMessage: string): Promise<string> {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  const client = new AnthropicBedrock({ awsRegion: region });

  const msg = await client.messages.create({
    model: BEDROCK_MODEL,
    max_tokens: 150,
    messages: [{ role: "user", content: PROMPT(toolCalls, lastMessage) }],
  });

  const block = msg.content?.[0];
  return block?.type === "text" ? (block as { type: "text"; text: string }).text.trim() : "";
}

async function summarizeViaAnthropic(toolCalls: string[], lastMessage: string): Promise<string> {
  const project =
    process.env.ANTHROPIC_VERTEX_PROJECT ||
    process.env.ANTHROPIC_VERTEX_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT;

  let client: Anthropic | AnthropicVertex;
  let model: string;

  if (project) {
    const region = process.env.ANTHROPIC_VERTEX_REGION || process.env.CLOUD_ML_REGION || DEFAULT_VERTEX_REGION;
    client = new AnthropicVertex({ projectId: project, region });
    model = VERTEX_MODEL;
  } else if (process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    model = MODEL;
  } else {
    throw new Error("No LLM credentials configured");
  }

  const msg = await client.messages.create({
    model,
    max_tokens: 150,
    messages: [{ role: "user", content: PROMPT(toolCalls, lastMessage) }],
  });

  const block = msg.content?.[0];
  return block?.type === "text" ? (block as { type: "text"; text: string }).text.trim() : "";
}

async function summarizeViaOpenRouter(toolCalls: string[], lastMessage: string): Promise<string> {
  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "https://github.com/eugene-bert/claude-hooks",
    },
    body: JSON.stringify({
      model,
      max_tokens: 150,
      messages: [{ role: "user", content: PROMPT(toolCalls, lastMessage) }],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message.content.trim() ?? "";
}

export async function summarizeActions(toolCalls: string[], lastMessage = ""): Promise<string> {
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_HOST) {
    return summarizeViaOllama(toolCalls, lastMessage);
  }
  if (process.env.OPENROUTER_API_KEY) {
    return summarizeViaOpenRouter(toolCalls, lastMessage);
  }
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
    return summarizeViaBedrock(toolCalls, lastMessage);
  }
  return summarizeViaAnthropic(toolCalls, lastMessage);
}
