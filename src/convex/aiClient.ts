"use node";

// Shared AI client for Smart Highlights & Study Files.
// Uses OpenRouter (OpenAI-compatible) with the project's OPENROUTER_API_KEY.
// Vision requests go through direct fetch with image_url parts.

const GATEWAY_URL = "https://openrouter.ai/api/v1/chat/completions";

type TextPart = { type: "text"; text: string };
type ImagePart = { type: "image_url"; image_url: { url: string } };
type ContentPart = TextPart | ImagePart;

interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

interface GatewayResponse {
  choices?: Array<{
    message?: { role: string; content?: string | null };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export function aiKeyConfigured(): boolean {
  return apiKeys().length > 0;
}

/**
 * All available OpenRouter keys. A single key is normal; up to 4 spares can
 * be added as OPENROUTER_API_KEY_2 .. OPENROUTER_API_KEY_5 and are used
 * automatically when one is rate-limited or out of credit.
 */
function apiKeys(): string[] {
  const keys: string[] = [];
  const first = process.env.OPENROUTER_API_KEY?.trim();
  if (first) keys.push(first);
  for (let i = 2; i <= 5; i++) {
    const spare = process.env[`OPENROUTER_API_KEY_${i}`]?.trim();
    if (spare) keys.push(spare);
  }
  return keys;
}

/**
 * Vision-capable default model on OpenRouter.
 * Override with OPENROUTER_MODEL (e.g. "anthropic/claude-3.5-sonnet").
 */
function modelName(): string {
  return process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
}

export async function callAI(
  messages: GatewayMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const keys = apiKeys();
  if (keys.length === 0) {
    throw new Error(
      "AI is not configured: add OPENROUTER_API_KEY in the project's Keys/API keys tab.",
    );
  }

  let lastStatus = 0;
  let lastBody = "";
  for (let i = 0; i < keys.length; i++) {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys[i]}`,
        // Optional attribution headers recommended by OpenRouter
        "HTTP-Referer": "https://studyai-uae.app",
        "X-Title": "StudyAI UAE",
      },
      body: JSON.stringify({
        model: modelName(),
        messages,
        max_tokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.2,
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as GatewayResponse;
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error("AI returned an empty response");
      return text;
    }

    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");
    // Rate-limited or out of credit → try the next key, if any
    if (res.status !== 429 && res.status !== 402) break;
  }

  if (lastStatus === 429 || lastStatus === 402) {
    throw new Error(
      keys.length > 1
        ? `All ${keys.length} AI keys are rate-limited or out of credit. Wait a moment or top up a key.`
        : `AI key rate-limited or out of credit (HTTP ${lastStatus}). You can add a spare key as OPENROUTER_API_KEY_2.`,
    );
  }
  throw new Error(`AI gateway error (${lastStatus}): ${lastBody.slice(0, 300)}`);
}

/**
 * Best-effort repair of JSON that an LLM truncated mid-string or mid-object
 * (e.g. when it hits the max output token limit). Tries several cut/close
 * strategies and returns the first candidate that parses, or null.
 */
function closeOpenJson(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let out = text;
  if (inString) out += '"';
  out += stack.reverse().join("");
  return out;
}

function repairTruncatedJson(text: string): string | null {
  const candidates: string[] = [closeOpenJson(text)];

  // Track last comma and last closed string (outside strings)
  let lastComma = -1;
  let lastQuoteClose = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        lastQuoteClose = i;
      }
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === ",") lastComma = i;
  }

  if (lastComma > 0) candidates.push(closeOpenJson(text.slice(0, lastComma)));
  if (lastQuoteClose > 0) candidates.push(closeOpenJson(text.slice(0, lastQuoteClose + 1)));

  for (const candidate of candidates) {
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // try the next strategy
    }
  }
  return null;
}

/** Extract a JSON object/array from a model response that may include fences or prose. */
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  // Strip ```json ... ``` fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Find first { or [ and matching last ] or }
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  let start = -1;
  let openCh = "{";
  let closeCh = "}";
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    start = firstArr;
    openCh = "[";
    closeCh = "]";
  } else if (firstObj !== -1) {
    start = firstObj;
  }
  if (start === -1) throw new Error("AI response did not contain JSON");
  // Scan to the matching close char respecting strings
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as T;
        } catch {
          break; // fall through to repair
        }
      }
    }
  }
  // Second chance: the model likely hit its output limit mid-JSON — repair it
  const repaired = repairTruncatedJson(text.slice(start));
  if (repaired !== null) {
    return JSON.parse(repaired) as T;
  }
  throw new Error(
    "The AI response was incomplete (the model hit its output limit). Try fewer pages at once, or set OPENROUTER_MODEL to a model with a larger output limit.",
  );
}

/** Deterministic FNV-1a hash used to cache page analyses. */
export function hashString(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  const step = Math.max(1, Math.floor(input.length / 2048));
  for (let i = 0; i < input.length; i += step) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
