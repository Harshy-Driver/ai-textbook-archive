import { describe, it, expect, vi } from "vitest";
import {
  renderSectionsHtml,
  buildExportHtml,
  downloadDocx,
  printStudyFile,
} from "./studyFileExport";
import type { StudyFileSection } from "@/convex/studyAi";

const SECTIONS: StudyFileSection[] = [
  {
    id: "about",
    type: "content",
    title: "What This Lesson Is About",
    blocks: [
      { kind: "paragraph", text: "Forces change motion.", sourcePage: "Page 12" },
      { kind: "bullets", items: ["Push", "Pull"], sourcePage: "Page 12" },
      { kind: "numbered", items: ["Step one", "Step two"] },
      {
        kind: "definition",
        term: "Force",
        meaning: "A push or a pull",
        sourcePage: "Page 12",
      },
      {
        kind: "formula",
        formula: "F = m × a",
        symbols: "F force, m mass, a acceleration",
        units: "N, kg, m/s²",
        whenToUse: "Finding force from mass and acceleration",
        example: "A 2 kg mass accelerates at 3 m/s². Find the force.",
        solution: "F = 2 × 3 = 6 N",
        sourcePage: "Page 12",
      },
      {
        kind: "table",
        headers: ["Quantity", "Unit"],
        rows: [
          ["Force", "N"],
          ["Mass", "kg"],
        ],
        sourcePage: "Page 13",
      },
      { kind: "check", question: "State Newton's second law.", hint: "Think F = ma" },
    ],
  },
];

const META = {
  title: "Newton's Laws",
  subject: "physics",
  grade: 10,
  chapterTitle: "Forces and Motion",
  scope: "lesson",
  pageCount: 2,
  createdAt: Date.parse("2026-09-12T00:00:00Z"),
};

describe("renderSectionsHtml", () => {
  it("renders every block kind without crashing and preserves textbook text", () => {
    const html = renderSectionsHtml(SECTIONS, { forExport: true });
    expect(html).toContain("1. ");
    expect(html).toContain("F = m × a");
    expect(html).toContain("A push or a pull");
    expect(html).toContain("Step two");
  });

  it("renders source references only for pages that exist, never invented ones", () => {
    const html = renderSectionsHtml(SECTIONS, { forExport: true });
    expect(html).toContain("Source: Page 12");
    expect(html).toContain("Source: Page 13");
    const withoutSources = renderSectionsHtml(
      [{ ...SECTIONS[0], blocks: [{ kind: "check", question: "Q", hint: "H" }] }],
      { forExport: false },
    );
    expect(withoutSources).not.toContain("Source:");
  });
});

describe("buildExportHtml", () => {
  it("produces a complete styled document with meta and print CSS", () => {
    const html = buildExportHtml(META, SECTIONS);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Newton's Laws");
    expect(html).toContain("Grade 10");
    expect(html).toContain("Forces and Motion");
    expect(html).toContain("@page");
    expect(html).toContain("Generated with StudyAI UAE");
  });

  it("adds a table of contents for longer documents only", () => {
    const long = buildExportHtml(META, [
      SECTIONS[0],
      { ...SECTIONS[0], id: "s2", title: "Must Know" },
      { ...SECTIONS[0], id: "s3", title: "Quick Review" },
      { ...SECTIONS[0], id: "s4", title: "Check Yourself" },
    ]);
    expect(long).toContain("Table of Contents");
    const short = buildExportHtml(META, SECTIONS);
    expect(short).not.toContain("Table of Contents");
  });

  it("escapes HTML-sensitive characters in textbook content", () => {
    const html = buildExportHtml(META, [
      {
        id: "x",
        type: "content",
        title: "Safety",
        blocks: [{ kind: "paragraph", text: "Use <b> carefully & \"quote\" things" }],
      },
    ]);
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("Use <b> carefully");
  });
});

describe("exports", () => {
  it("downloadDocx creates a Word-compatible .doc blob download", () => {
    const clicks: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        clicks.push(el as HTMLAnchorElement);
        el.click = () => {};
      }
      return el;
    });
    const created: { blob: Blob; name: string }[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource) => {
      created.push({ blob: blob as Blob, name: "" });
      return "blob:mock";
    });
    downloadDocx(META, SECTIONS);
    expect(clicks.length).toBe(1);
    expect(created[0].blob.type).toBe("application/msword");
    expect(META.title.replace(/[^\w\s-]/g, "").length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  it("printStudyFile falls back to hidden-iframe printing when popups are blocked", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const appended: HTMLElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "iframe") {
        appended.push(el);
        Object.defineProperty(el, "contentDocument", {
          value: null, // forces the guarded path
        });
      }
      return el;
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(((n: Node) => {
      appended.push(n as HTMLElement);
      return n;
    }) as typeof document.body.appendChild);
    expect(() => printStudyFile(META, SECTIONS)).not.toThrow();
    expect(appended.length).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });
});
