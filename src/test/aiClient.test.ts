import { describe, it, expect, vi, afterEach } from "vitest";
import { extractJson, hashString, aiKeyConfigured } from "../convex/aiClient";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("extractJson", () => {
  it("parses a plain JSON object", () => {
    expect(extractJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses JSON wrapped in ```json fences", () => {
    const raw = '```json\n{"readability": "clear", "highlights": []}\n```';
    expect(extractJson<{ readability: string }>(raw)).toEqual({
      readability: "clear",
      highlights: [],
    });
  });

  it("parses JSON wrapped in plain ``` fences", () => {
    const raw = '```\n{"ok": true}\n```';
    expect(extractJson<{ ok: boolean }>(raw)).toEqual({ ok: true });
  });

  it("parses JSON preceded by model prose", () => {
    const raw = 'Here is the JSON you asked for:\n{"title": "Newton\'s Laws"}';
    expect(extractJson<{ title: string }>(raw).title).toBe("Newton's Laws");
  });

  it("parses top-level arrays", () => {
    expect(extractJson<string[]>('["a","b"]')).toEqual(["a", "b"]);
  });

  it("handles braces inside JSON strings", () => {
    expect(extractJson<{ t: string }>('{"t": "use { and } carefully"}')).toEqual({
      t: "use { and } carefully",
    });
  });

  it("handles escaped quotes inside strings", () => {
    expect(extractJson<{ t: string }>('{"t": "say \\"hi\\""}')).toEqual({ t: 'say "hi"' });
  });

  it("throws when no JSON is present", () => {
    expect(() => extractJson("no json here")).toThrow(/did not contain JSON/);
  });

  it("repairs simple truncated objects instead of throwing", () => {
    expect(extractJson<{ a: number }>('{"a": 1')).toEqual({ a: 1 });
  });

  it("repairs JSON truncated mid-string by the model's output limit", () => {
    const raw =
      '{"title": "Forces", "sections": [{"id": "s1", "title": "Must K';
    const parsed = extractJson<{ title: string; sections: Array<{ id: string; title: string }> }>(raw);
    expect(parsed.title).toBe("Forces");
    expect(parsed.sections[0].id).toBe("s1");
  });

  it("repairs JSON truncated after a complete value with dangling key fragment", () => {
    const raw = '{"a": 1, "items": ["one", "two"], "b"';
    const parsed = extractJson<{ a: number; items: string[] }>(raw);
    expect(parsed.a).toBe(1);
    expect(parsed.items).toEqual(["one", "two"]);
  });

  it("repairs JSON truncated mid-array-item string", () => {
    const parsed = extractJson<{ items: string[] }>('{"items": ["one", "two", "th');
    expect(parsed.items).toEqual(["one", "two", "th"]);
  });
});

describe("hashString", () => {
  it("is deterministic", () => {
    expect(hashString("newton laws page 12")).toBe(hashString("newton laws page 12"));
  });

  it("differs for different page transcriptions", () => {
    expect(hashString("Force = mass x acceleration")).not.toBe(
      hashString("Force = mass times acceleration")
    );
  });

  it("handles long page transcriptions without crashing", () => {
    const long = "An object remains at rest unless acted upon by a force. ".repeat(2000);
    expect(typeof hashString(long)).toBe("string");
  });
});

describe("aiKeyConfigured", () => {
  it("is false when OPENROUTER_API_KEY is missing", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(aiKeyConfigured()).toBe(false);
  });

  it("is false when the key is only whitespace", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "   ");
    expect(aiKeyConfigured()).toBe(false);
  });

  it("is true when a real key is present", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-or-v1-test");
    expect(aiKeyConfigured()).toBe(true);
  });
});
