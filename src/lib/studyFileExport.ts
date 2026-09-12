// Study file export: printable HTML, styled PDF (via print), and DOCX
// (Word-compatible HTML document). No external dependencies needed.

import type { StudyFileSection } from "@/convex/studyAi";

export interface StudyFileMeta {
  title: string;
  subject: string;
  grade: number;
  chapterTitle?: string;
  unitTitle?: string;
  scope: string;
  pageCount: number;
  createdAt: number;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sourceTag(src?: string | null): string {
  return src ? `<span class="src">Source: ${esc(src)}</span>` : "";
}

/** Render sections to HTML shared by the print view and the DOCX. */
export function renderSectionsHtml(
  sections: StudyFileSection[],
  opts: { forExport: boolean },
): string {
  const html: string[] = [];
  let sectionNo = 0;
  for (const section of sections) {
    sectionNo++;
    html.push(
      `<h2 id="sec-${section.id}">${opts.forExport ? `${sectionNo}. ` : ""}${esc(section.title)}</h2>`,
    );
    for (const block of section.blocks) {
      switch (block.kind) {
        case "paragraph":
          html.push(`<p>${esc(block.text)}</p>${sourceTag(block.sourcePage)}`);
          break;
        case "bullets":
          html.push(
            `<ul>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>${sourceTag(block.sourcePage)}`,
          );
          break;
        case "numbered":
          html.push(
            `<ol>${block.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ol>${sourceTag(block.sourcePage)}`,
          );
          break;
        case "definition":
          html.push(
            `<div class="def"><span class="term">${esc(block.term)}</span>: ${esc(block.meaning)}</div>${sourceTag(block.sourcePage)}`,
          );
          break;
        case "formula":
          html.push(
            `<div class="formula"><div class="fx">${esc(block.formula)}</div>
             <table class="fx-table">
               <tr><th>What each symbol means</th><td>${esc(block.symbols)}</td></tr>
               <tr><th>SI units</th><td>${esc(block.units)}</td></tr>
               <tr><th>When to use it</th><td>${esc(block.whenToUse)}</td></tr>
               ${block.example ? `<tr><th>Example problem</th><td>${esc(block.example)}</td></tr>` : ""}
               ${block.solution ? `<tr><th>Solution</th><td>${esc(block.solution)}</td></tr>` : ""}
             </table></div>${sourceTag(block.sourcePage)}`,
          );
          break;
        case "table":
          html.push(
            `<table class="tbl"><thead><tr>${block.headers
              .map((h) => `<th>${esc(h)}</th>`)
              .join("")}</tr></thead><tbody>${block.rows
              .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
              .join("")}</tbody></table>${sourceTag(block.sourcePage)}`,
          );
          break;
        case "check":
          html.push(
            `<div class="check"><span class="q">${esc(block.question)}</span><span class="hint">Answer hint: ${esc(block.hint)}</span></div>`,
          );
          break;
      }
    }
  }
  return html.join("\n");
}

export function buildExportHtml(meta: StudyFileMeta, sections: StudyFileSection[]): string {
  const toc = sections
    .map((s, i) => `<li><a href="#sec-${s.id}">${i + 1}. ${esc(s.title)}</a></li>`)
    .join("");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(meta.title)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1c1917; line-height: 1.55; max-width: 800px; margin: 0 auto; padding: 24px; }
  .cover { text-align: center; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 3px double #8b6f47; }
  .cover h1 { font-size: 26px; margin: 6px 0; }
  .cover .meta { color: #57534e; font-size: 13px; }
  .badge { display: inline-block; background: #f5f0e6; border: 1px solid #d6c9a8; color: #6b5b3e; border-radius: 999px; padding: 2px 10px; font-size: 11px; margin: 0 3px; font-family: Arial, sans-serif; }
  .toc { background: #faf7f0; border: 1px solid #e7dfcd; border-radius: 8px; padding: 14px 20px; margin-bottom: 26px; }
  .toc h2 { margin: 0 0 8px; font-size: 15px; }
  .toc ol { margin: 0; padding-left: 20px; }
  .toc li { margin: 3px 0; font-size: 13px; }
  h2 { font-size: 18px; color: #6b4f2a; border-bottom: 1px solid #e0d5bd; padding-bottom: 4px; margin-top: 28px; page-break-after: avoid; }
  p { margin: 8px 0; }
  ul, ol { margin: 8px 0 8px 4px; padding-left: 22px; }
  li { margin: 4px 0; }
  .def { margin: 8px 0; padding: 8px 12px; background: #faf7f0; border-left: 3px solid #c9a96e; border-radius: 4px; }
  .def .term { font-weight: bold; color: #6b4f2a; }
  .formula { margin: 12px 0; border: 1px solid #e0d5bd; border-radius: 8px; overflow: hidden; }
  .formula .fx { font-family: 'Cambria Math', Georgia, serif; font-size: 18px; font-weight: bold; text-align: center; padding: 10px; background: #f5f0e6; }
  .fx-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .fx-table th, .tbl th { background: #faf7f0; text-align: left; }
  .fx-table th, .fx-table td, .tbl th, .tbl td { border: 1px solid #e7dfcd; padding: 6px 10px; vertical-align: top; }
  .tbl { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12.5px; }
  .check { margin: 10px 0; padding: 10px 14px; background: #f0f4f8; border-radius: 8px; border: 1px solid #dbe4ee; }
  .check .q { display: block; font-weight: 600; }
  .check .hint { display: block; color: #57534e; font-size: 12.5px; margin-top: 3px; }
  .src { display: inline-block; font-size: 10.5px; color: #8c7853; font-family: Arial, sans-serif; margin: 2px 0 6px; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e0d5bd; color: #8c7853; font-size: 11px; text-align: center; }
</style>
</head>
<body>
  <div class="cover">
    <div class="meta">${esc(meta.chapterTitle || meta.unitTitle || "StudyAI UAE")}</div>
    <h1>${esc(meta.title)}</h1>
    <div>
      <span class="badge">Grade ${esc(String(meta.grade))}</span>
      <span class="badge">${esc(meta.subject === "physics" ? "Physics" : "Biology")}</span>
      <span class="badge">${esc(meta.scope)}</span>
      <span class="badge">${esc(String(meta.pageCount))} pages</span>
    </div>
  </div>
  ${sections.length > 3 ? `<div class="toc"><h2>Table of Contents</h2><ol>${toc}</ol></div>` : ""}
  ${renderSectionsHtml(sections, { forExport: true })}
  <div class="footer">Generated with StudyAI UAE · Based on your uploaded textbook pages · ${new Date(
    meta.createdAt,
  ).toLocaleDateString()}</div>
</body>
</html>`;
}

function openHtmlWindow(html: string): Window | null {
  const w = window.open("", "_blank");
  if (!w) return null;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}

/** Download as .doc (Word-compatible HTML) — opens fully editable in Word/Google Docs. */
export function downloadDocx(meta: StudyFileMeta, sections: StudyFileSection[]): void {
  const html = buildExportHtml(meta, sections);
  const wordDoc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--></head><body>${html.replace(/^[\s\S]*?<body>/, "").replace(/<\/body>[\s\S]*$/, "")}</body></html>`;
  const blob = new Blob(["\ufeff", wordDoc], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${meta.title.replace(/[^\w\s-]/g, "").trim() || "study-file"}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Open the browser print dialog with the styled study guide (Save as PDF). */
export function printStudyFile(meta: StudyFileMeta, sections: StudyFileSection[]): void {
  const html = buildExportHtml(meta, sections);
  const w = openHtmlWindow(html);
  if (!w) {
    // Popup blocked — fall back to a hidden iframe print
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 60000);
      };
    }
    return;
  }
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
}
