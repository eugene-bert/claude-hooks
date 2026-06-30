import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import { execSync } from "child_process";

const MODEL = "claude-haiku-4-5-20251001";
const VERTEX_MODEL = "claude-haiku-4-5@20251001";
const DEFAULT_VERTEX_REGION = "us-east5";
const BEDROCK_MODEL = "anthropic.claude-haiku-4-5-20251001-v1:0";
const DEFAULT_OLLAMA_HOST = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2";

const PROMPT = (toolCalls: string[]) => `You are summarizing what a coding AI assistant just did in a terminal session.
Here are the last tool calls it made:

${toolCalls.map(t => `- ${t}`).join("\n")}

Write 1-2 sentences in plain English summarizing what was accomplished. Be specific but concise. No fluff.`;

function getGcloudProject(): string | null {
  try {
    return execSync("gcloud config get-value project 2>/dev/null", { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

async function summarizeViaOllama(toolCalls: string[]): Promise<string> {
  const host = process.env.OLLAMA_HOST ?? DEFAULT_OLLAMA_HOST;
  const model = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;

  const res = await fetch(`${host}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: PROMPT(toolCalls), stream: false }),
  });

  if (!res.ok) throw new Error(`Ollama error ${res.status}`);
  const data = await res.json() as { response: string };
  return data.response.trim();
}

async function summarizeViaBedrock(toolCalls: string[]): Promise<string> {
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
  const client = new AnthropicBedrock({ awsRegion: region });

  const msg = await client.messages.create({
    model: BEDROCK_MODEL,
    max_tokens: 100,
    messages: [{ role: "user", content: PROMPT(toolCalls) }],
  });

  const block = msg.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

async function summarizeViaAnthropic(toolCalls: string[]): Promise<string> {
  const project =
    process.env.ANTHROPIC_VERTEX_PROJECT ||
    process.env.ANTHROPIC_VERTEX_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    getGcloudProject();

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
    max_tokens: 100,
    messages: [{ role: "user", content: PROMPT(toolCalls) }],
  });

  const block = msg.content[0];
  return block.type === "text" ? block.text.trim() : "";
}

export async function summarizeActions(toolCalls: string[]): Promise<string> {
  if (process.env.OLLAMA_MODEL || process.env.OLLAMA_HOST) {
    return summarizeViaOllama(toolCalls);
  }
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
    return summarizeViaBedrock(toolCalls);
  }
  return summarizeViaAnthropic(toolCalls);
}
