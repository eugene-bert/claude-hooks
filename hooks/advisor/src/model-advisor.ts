import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

type Tier = "haiku" | "sonnet" | "opus";

const CACHE_PATH = `${process.env.HOME}/.claude/model-advisor-cache.json`;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_WORDS = Number(process.env.MODEL_ADVISOR_MIN_WORDS ?? "0");

const VERTEX_MODEL = process.env.MODEL_ADVISOR_VERTEX_MODEL ?? "claude-haiku-4-5@20251001";
const ANTHROPIC_MODEL = process.env.MODEL_ADVISOR_ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";
const BEDROCK_MODEL = process.env.MODEL_ADVISOR_BEDROCK_MODEL ?? "anthropic.claude-haiku-4-5-20251001-v1:0";
const DEFAULT_VERTEX_REGION = process.env.MODEL_ADVISOR_VERTEX_REGION ?? "us-east5";
const DEFAULT_OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4-5";

const DEFAULTS: Record<Tier, string[]> = {
  haiku: ["haiku"],
  sonnet: ["sonnet"],
  opus: ["opus"],
};

function getTierModels(tier: Tier): string[] {
  const env = process.env[`MODEL_ADVISOR_${tier.toUpperCase()}_MODELS`];
  if (env) return env.split(",").map(s => s.trim()).filter(Boolean);
  return DEFAULTS[tier];
}

interface CacheEntry { tier: Tier; ts: number }
type Cache = Record<string, CacheEntry>;

function loadCache(): Cache {
  try { return JSON.parse(readFileSync(CACHE_PATH, "utf8")); } catch { return {}; }
}

function saveCache(cache: Cache): void {
  try { writeFileSync(CACHE_PATH, JSON.stringify(cache)); } catch {}
}

function getCurrentTier(): Tier {
  try {
    const s = JSON.parse(readFileSync(`${process.env.HOME}/.claude/settings.json`, "utf8"));
    const m: string = s.model ?? "";
    if (m.includes("opus")) return "opus";
    if (m.includes("haiku")) return "haiku";
    return "sonnet";
  } catch { return "sonnet"; }
}

function loadDotEnv(): void {
  try {
    for (const line of readFileSync(`${process.env.HOME}/.claude/hooks/.env`, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const idx = t.indexOf("=");
      if (idx === -1) continue;
      process.env[t.slice(0, idx).trim()] ??= t.slice(idx + 1).trim();
    }
  } catch {}
}

const CLASSIFY_PROMPT = (prompt: string) =>
  `Classify the complexity of this software engineering task. The task may be in any language. Return ONLY raw JSON with no markdown, no explanation, no code blocks.

{"tier":"haiku"} — trivial: rename a variable, fix a typo, quick factual question, simple git command, minor formatting, short lookup
{"tier":"sonnet"} — standard: implement a feature, debug an issue, write or refactor code, explain a concept, create a component, plan a small task. Also: any slash command starting with "/" (e.g. /init, /review, /security-review, /run) — these invoke tools that analyze codebases and always need at least sonnet
{"tier":"opus"} — complex: system/architecture design, security audit, large-scale refactor across many files, deep analysis, distributed systems, performance optimization at scale, design patterns for complex domains

Examples of opus tasks (in any language):
- "design microservices architecture for payment system with security, API gateway, service mesh"
- "спроектировать архитектуру микросервисов для платёжной системы"
- "conduct a full security audit of the auth system"
- "провести аудит безопасности системы аутентификации"

Task: "${prompt.slice(0, 500)}"

Respond with exactly one of: {"tier":"haiku"} or {"tier":"sonnet"} or {"tier":"opus"}`;

function parseTier(raw: string): Tier {
  const match = raw.match(/"tier"\s*:\s*"(haiku|sonnet|opus)"/);
  if (!match) throw new Error(`Unparseable tier response: ${raw}`);
  return match[1] as Tier;
}

async function classifyViaOllama(prompt: string): Promise<Tier> {
  const res = await fetch(`${DEFAULT_OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: DEFAULT_OLLAMA_MODEL, prompt: CLASSIFY_PROMPT(prompt), stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json() as { response: string };
  return parseTier(data.response);
}

async function classifyViaOpenRouter(prompt: string): Promise<Tier> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "https://github.com/eugene-bert/claude-hooks",
    },
    body: JSON.stringify({
      model: DEFAULT_OPENROUTER_MODEL,
      max_tokens: 30,
      messages: [{ role: "user", content: CLASSIFY_PROMPT(prompt) }],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json() as { choices: { message: { content: string } }[] };
  return parseTier(data.choices[0]?.message.content ?? "");
}

async function classifyViaAnthropic(prompt: string): Promise<Tier> {
  const project =
    process.env.ANTHROPIC_VERTEX_PROJECT ||
    process.env.ANTHROPIC_VERTEX_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT;

  let client: Anthropic | AnthropicVertex | AnthropicBedrock;
  let model: string;

  if (project) {
    const region = process.env.ANTHROPIC_VERTEX_REGION || process.env.CLOUD_ML_REGION || DEFAULT_VERTEX_REGION;
    client = new AnthropicVertex({ projectId: project, region });
    model = VERTEX_MODEL;
  } else if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
    client = new AnthropicBedrock({ awsRegion: process.env.AWS_REGION ?? "us-east-1" });
    model = BEDROCK_MODEL;
  } else if (process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    model = ANTHROPIC_MODEL;
  } else {
    throw new Error("No LLM credentials");
  }

  const msg = await (client as Anthropic).messages.create({
    model,
    max_tokens: 30,
    messages: [{ role: "user", content: CLASSIFY_PROMPT(prompt) }],
  });

  const block = msg.content?.[0];
  const text = block?.type === "text" ? (block as { type: "text"; text: string }).text.trim() : "";
  return parseTier(text);
}

async function classify(prompt: string): Promise<Tier> {
  if (process.env.OLLAMA_HOST || process.env.OLLAMA_MODEL) return classifyViaOllama(prompt);
  if (process.env.OPENROUTER_API_KEY) return classifyViaOpenRouter(prompt);
  return classifyViaAnthropic(prompt);
}

async function main(): Promise<void> {
  loadDotEnv();

  let input: { prompt?: string } = {};
  try { input = JSON.parse(readFileSync("/dev/stdin", "utf8")); } catch {}

  const prompt = (input.prompt ?? "").trim();
  if (prompt.split(/\s+/).length < MIN_WORDS) process.exit(0);

  const hash = createHash("sha256").update(prompt).digest("hex").slice(0, 16);
  const cache = loadCache();
  const now = Date.now();

  let tier: Tier;
  if (cache[hash] && now - cache[hash].ts < CACHE_TTL_MS) {
    tier = cache[hash].tier;
  } else {
    try {
      tier = await classify(prompt);
      cache[hash] = { tier, ts: now };
      for (const k of Object.keys(cache)) {
        if (now - cache[k].ts > CACHE_TTL_MS) delete cache[k];
      }
      saveCache(cache);
    } catch {
      process.exit(0);
    }
  }

  if (tier === getCurrentTier()) {
    if (process.env.MODEL_ADVISOR_VERBOSE === "true") {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: `SYSTEM INSTRUCTION: Output this line verbatim at the very start of your response, before anything else: "[model-advisor] ✓ ${tier.toUpperCase()} ok"`,
        },
      }));
    }
    process.exit(0);
  }

  const models = getTierModels(tier);
  const primary = models[0];
  const fallbacks = models.slice(1);
  const fallbackLine = fallbacks.length
    ? `\nFallback: ${fallbacks.map(m => `\`/model ${m}\``).join(" → ")}`
    : "";

  const fallbackNote = fallbacks.length ? ` (fallback: ${fallbacks.map(m => `/model ${m}`).join(", ")})` : "";
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: `SYSTEM INSTRUCTION: Output this line verbatim at the very start of your response, before anything else: "[model-advisor] ${getCurrentTier().toUpperCase()} → ${tier.toUpperCase()}: \`/model ${primary}\`${fallbackNote}"`,
    },
  }));
}

main().catch(() => process.exit(0));
