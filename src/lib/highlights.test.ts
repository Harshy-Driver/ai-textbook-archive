import { describe, it, expect } from "vitest";
import { snippetToBoxes, PRIORITY_COLORS, newHighlightId } from "./highlights";
import type { LineBox } from "./highlights";

const LINES: LineBox[] = [
  { x: 0.1, y: 0.05, w: 0.8, h: 0.04 },
  { x: 0.1, y: 0.1, w: 0.8, h: 0.04 },
  { x: 0.1, y: 0.15, w: 0.8, h: 0.04 },
];

const FULL_TEXT = "Newton's First Law:\nAn object remains at rest unless a force acts on it.\nForce = mass x acceleration";

describe("snippetToBoxes", () => {
  it("returns a box covering the exact snippet on its line", () => {
    const boxes = snippetToBoxes("An object remains at rest", FULL_TEXT, LINES);
    expect(boxes.length).toBe(1);
    const b = boxes[0];
    // Snippet starts at the beginning of line 2 and stops before the line's end
    expect(b.y).toBeCloseTo(0.1, 5);
    expect(b.x).toBeCloseTo(0.1, 5);
    expect(b.x + b.w).toBeLessThan(0.9);
    expect(b.w).toBeGreaterThan(0.01);
  });

  it("matches snippets despite differing whitespace", () => {
    const boxes = snippetToBoxes("object   remains\nat rest", FULL_TEXT, LINES);
    expect(boxes.length).toBe(1);
  });

  it("splits multi-line snippets into one box per touched line", () => {
    const boxes = snippetToBoxes(
      "Newton's First Law: An object remains",
      FULL_TEXT,
      LINES,
    );
    expect(boxes.length).toBe(2);
    expect(boxes[0].y).toBeCloseTo(0.05, 5);
    expect(boxes[1].y).toBeCloseTo(0.1, 5);
  });

  it("returns [] for text that is not on the page (never invents placement)", () => {
    expect(snippetToBoxes("Photosynthesis converts light", FULL_TEXT, LINES)).toEqual([]);
  });

  it("returns [] when no line boxes are available", () => {
    expect(snippetToBoxes("Force", FULL_TEXT, [])).toEqual([]);
  });

  it("finds every occurrence of a repeated snippet", () => {
    const text = "force acts\nforce acts again";
    const lines: LineBox[] = [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ];
    const boxes = snippetToBoxes("force acts", text, lines);
    expect(boxes.length).toBe(2);
  });
});

describe("priority styling", () => {
  it("gives each priority a distinct translucent fill that keeps text readable", () => {
    const fills = Object.values(PRIORITY_COLORS).map((c) => c.fill);
    expect(new Set(fills).size).toBe(3);
    for (const fill of fills) {
      // rgba with alpha < 0.4 → original text stays visible underneath
      const m = fill.match(/([\d.]+)\)$/);
      expect(m).not.toBeNull();
      const alpha = Number(m![1]);
      expect(alpha).toBeLessThan(0.4);
      expect(alpha).toBeGreaterThan(0);
    }
  });
});

describe("newHighlightId", () => {
  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newHighlightId()));
    expect(ids.size).toBe(200);
  });
});
