// Client-side helpers for Smart Highlights.
// Renders text-snippet highlights as translucent overlay rectangles on the
// page image so the original text stays fully readable underneath.

export type HighlightPriority = "high" | "medium" | "low";
export type HighlightKind =
  | "definition" | "concept" | "law" | "formula" | "equation" | "fact"
  | "vocabulary" | "process" | "step" | "cause_effect" | "example"
  | "exam_relevant" | "diagram_label" | "comparison" | "objective" | "custom";

export interface PageHighlight {
  id: string;
  text: string;
  priority: HighlightPriority;
  kind: HighlightKind;
  note?: string;
  source: "ai" | "user";
  /** Client-only: exact drawn rectangle for manually added highlights (not persisted). */
  box?: HighlightBox;
}

export interface HighlightBox {
  x: number; // 0..1 relative to rendered image width
  y: number;
  w: number;
  h: number;
}

export const PRIORITY_COLORS: Record<
  HighlightPriority,
  { fill: string; border: string; chip: string; label: string }
> = {
  high: {
    fill: "rgba(239, 68, 68, 0.22)",
    border: "rgba(220, 38, 38, 0.85)",
    chip: "bg-red-100 text-red-800 border-red-200",
    label: "High priority",
  },
  medium: {
    fill: "rgba(245, 158, 11, 0.22)",
    border: "rgba(217, 119, 6, 0.85)",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    label: "Medium priority",
  },
  low: {
    fill: "rgba(59, 130, 246, 0.18)",
    border: "rgba(37, 99, 235, 0.8)",
    chip: "bg-blue-100 text-blue-800 border-blue-200",
    label: "Low priority",
  },
};

function normalizeForMatch(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Locate every occurrence of a snippet in the page's transcription, then map
 * character offsets to approximate line boxes on the image.
 * `lineBoxes` are per-line bounding boxes (0..1 space) derived from the image
 * via canvas analysis (dark-text rows).
 */
export function snippetToBoxes(
  snippet: string,
  fullText: string,
  lineBoxes: LineBox[],
): HighlightBox[] {
  if (!snippet || lineBoxes.length === 0) return [];
  const normSnippet = normalizeForMatch(snippet);
  if (!normSnippet) return [];

  // Find occurrences in the normalized full text while tracking original index.
  const normFull = normalizeForMatch(fullText);
  const boxes: HighlightBox[] = [];
  let idx = normFull.indexOf(normSnippet);
  if (idx === -1) return [];
  let guard = 0;
  while (idx !== -1 && guard < 6) {
    // Map normalized offsets back to approximate original char offsets
    const startOrig = approxOriginalIndex(fullText, normFull, idx);
    const endOrig = approxOriginalIndex(fullText, normFull, idx + normSnippet.length);
    if (startOrig >= 0 && endOrig > startOrig) {
      boxes.push(...rangeToBoxes(fullText, startOrig, endOrig, lineBoxes));
    }
    idx = normFull.indexOf(normSnippet, idx + normSnippet.length);
    guard++;
  }
  return boxes;
}

/** Approximate mapping from normalized index back to original string index. */
function approxOriginalIndex(original: string, normalized: string, normIdx: number): number {
  // Build a quick map lazily: walk original, collapsing whitespace, until we
  // have consumed normIdx normalized chars.
  let normCount = 0;
  let i = 0;
  const target = Math.min(normIdx, normalized.length);
  while (i < original.length && normCount < target) {
    const ch = original[i];
    if (/\s/.test(ch)) {
      // collapse consecutive whitespace into a single space
      let j = i;
      while (j < original.length && /\s/.test(original[j])) j++;
      if (normCount < target) {
        normCount++;
        if (normCount >= target) return j; // highlight ends at whitespace end
        i = j;
        continue;
      }
    } else {
      normCount++;
    }
    i++;
  }
  return i;
}

function rangeToBoxes(
  fullText: string,
  startChar: number,
  endChar: number,
  lineBoxes: LineBox[],
): HighlightBox[] {
  // Split the range into lines based on newlines in the source text.
  const lines: Array<{ start: number; end: number; text: string }> = [];
  let lineStart = 0;
  for (let i = 0; i <= fullText.length; i++) {
    if (fullText[i] === "\n" || i === fullText.length) {
      lines.push({ start: lineStart, end: i, text: fullText.slice(lineStart, i) });
      lineStart = i + 1;
    }
  }
  const touched = lines.filter((l) => l.end > startChar && l.start < endChar);
  const boxes: HighlightBox[] = [];
  for (const line of touched) {
    const lb = lineBoxes[lines.indexOf(line)];
    if (!lb) continue;
    // Fraction of the line covered horizontally
    const lineLen = Math.max(1, line.text.length);
    const from = Math.max(0, startChar - line.start);
    const to = Math.min(lineLen, endChar - line.start);
    if (to <= from) continue;
    const xFrac = from / lineLen;
    const wFrac = Math.min(1 - xFrac, (to - from) / lineLen);
    boxes.push({
      x: lb.x + xFrac * lb.w,
      y: lb.y,
      w: Math.max(0.01, wFrac * lb.w),
      h: lb.h,
    });
  }
  return boxes;
}

export interface LineBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Detect text line bounding boxes on the page image using canvas pixel
 * analysis: rows with dark pixels are text lines. Works on the compressed
 * JPEGs stored in the app. Returns boxes in 0..1 relative space.
 */
export async function detectLineBoxes(imageUrl: string): Promise<LineBox[]> {
  const img = await loadImage(imageUrl);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return [];

  // Downscale for analysis speed
  const scale = Math.min(1, 700 / W);
  const aw = Math.max(64, Math.round(W * scale));
  const ah = Math.max(64, Math.round(H * scale));
  const canvas = document.createElement("canvas");
  canvas.width = aw;
  canvas.height = ah;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, aw, ah);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, aw, ah).data;
  } catch {
    return [];
  }

  // Luminance + darkness count per row
  const darkThreshold = 120;
  const rowDark = new Float32Array(ah);
  for (let y = 0; y < ah; y++) {
    let dark = 0;
    for (let x = 0; x < aw; x++) {
      const i = (y * aw + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < darkThreshold) dark++;
    }
    rowDark[y] = dark / aw;
  }

  // Group consecutive rows with enough dark pixels into "text bands"
  const bands: Array<{ y0: number; y1: number }> = [];
  const minDark = 0.015;
  let y = 0;
  while (y < ah) {
    if (rowDark[y] > minDark) {
      const y0 = y;
      while (y < ah && rowDark[y] > minDark) y++;
      bands.push({ y0, y1: y });
    } else {
      y++;
    }
  }

  // For each band, find horizontal extent of dark pixels, and split into
  // multiple line boxes when the band is tall (multi-line paragraph block)
  const lineBoxes: LineBox[] = [];
  const minBandH = 3;
  for (const band of bands) {
    const bandH = band.y1 - band.y0;
    if (bandH < minBandH) continue;

    // Horizontal extent
    let minX = aw;
    let maxX = 0;
    for (let yy = band.y0; yy < band.y1; yy++) {
      for (let x = 0; x < aw; x++) {
        const i = (yy * aw + x) * 4;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < darkThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    if (maxX <= minX) continue;

    // If band is tall, estimate number of lines inside it by finding internal
    // light gaps at smaller threshold.
    const subBands = splitBand(data, aw, band.y0, band.y1, minX, maxX);
    for (const sb of subBands) {
      lineBoxes.push({
        x: minX / aw,
        y: sb.y0 / ah,
        w: (maxX - minX) / aw,
        h: Math.max(2, sb.y1 - sb.y0) / ah,
      });
    }
  }
  return lineBoxes;
}

function splitBand(
  data: Uint8ClampedArray,
  aw: number,
  y0: number,
  y1: number,
  minX: number,
  maxX: number,
): Array<{ y0: number; y1: number }> {
  const darkThreshold = 120;
  const rowDark: number[] = [];
  for (let y = y0; y < y1; y++) {
    let dark = 0;
    for (let x = minX; x <= maxX; x++) {
      const i = (y * aw + x) * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum < darkThreshold) dark++;
    }
    rowDark.push(dark / Math.max(1, maxX - minX));
  }
  // average line height heuristic: a text line is usually >= 0.7% of image h
  const sub: Array<{ y0: number; y1: number }> = [];
  const gapThreshold = 0.004; // fraction of band rows that must be light to split
  let start = 0;
  let gap = 0;
  for (let r = 0; r < rowDark.length; r++) {
    if (rowDark[r] > 0.01) {
      if (start >= 0 && gap >= Math.max(2, rowDark.length * gapThreshold)) {
        sub.push({ y0: y0 + start, y1: y0 + r - gap });
      }
      start = r;
      gap = 0;
    } else {
      gap++;
    }
  }
  if (start >= 0 && start < rowDark.length) {
    sub.push({ y0: y0 + start, y1: y0 + rowDark.length });
  }
  return sub.length > 0 ? sub : [{ y0, y1 }];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Generate a local id for user-created highlights. */
export function newHighlightId(): string {
  return `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
