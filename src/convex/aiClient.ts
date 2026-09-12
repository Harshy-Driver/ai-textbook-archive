"use node";

// Shared AI client for Smart Highlights & Study Files.
// Uses the VLY integration gateway (OpenAI-compatible) with the project's
// VLY_INTEGRATION_KEY. Vision requests go through direct fetch since the
// bundled completion() helper only accepts string content.

const GATEWAY_URL = "https://integrations.vly.ai/v1/llm";

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
  return !!process.env.VLY_INTEGRATION_KEY && !!process.env.VLY_INTEGRATION_KEY.trim();
}

export async function callAI(
  messages: GatewayMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const key = process.env.VLY_INTEGRATION_KEY;
  if (!key || !key.trim()) {
    throw new Error(
      "AI is not configured: add VLY_INTEGRATION_KEY in the project's Keys/API keys tab.",
    );
  }

  const res = await fetch(`${GATEWAY_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.VLY_AI_MODEL || "gpt-4o-mini",
      messages,
      max_tokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI gateway error (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as GatewayResponse;
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("AI returned an empty response");
  return text;
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
        return JSON.parse(text.slice(start, i + 1)) as T;
      }
    }
  }
  throw new Error("AI response contained invalid JSON");
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
