export interface SubtitlePart {
  text: string;
  kind: "word" | "space" | "punctuation";
  word_index: number;
  break_before: boolean;
}

export interface SubtitlePage {
  start_word: number;
  end_word: number;
  part_start: number;
  part_end: number;
  text: string;
  start: number;
  end: number;
}

export interface SubtitleWords {
  text: string;
  parts: SubtitlePart[];
  words: { text: string; weight: number }[];
  timing: "estimated";
  pages?: SubtitlePage[];
}

/** Lossless dictionary fallback while the server's khmer-nltk result is loading. */
export function fallbackSubtitleWords(text: string): SubtitleWords {
  const source = text.replace(/\u200b/g, "");
  const segments = typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter("km", { granularity: "word" }).segment(source))
    : [{ segment: source, isWordLike: /[\p{L}\p{N}]/u.test(source) }];
  const parts: SubtitlePart[] = [];
  const words: SubtitleWords["words"] = [];
  let previousKind = "";
  let display = "";
  for (const segment of segments) {
    const kind = /^\s+$/.test(segment.segment) ? "space" : segment.isWordLike ? "word" : "punctuation";
    const boundary = previousKind === "word" && kind === "word";
    const wordIndex = kind === "word" ? words.length : kind === "punctuation" ? words.length - 1 : -1;
    if (kind === "word") words.push({ text: segment.segment, weight: Math.max(1, Array.from(segment.segment).filter((char) => /[\p{L}\p{N}]/u.test(char)).length) });
    parts.push({ text: segment.segment, kind, word_index: wordIndex, break_before: boundary });
    display += (boundary ? "\u200b" : "") + segment.segment;
    previousKind = kind;
  }
  const subtitle: SubtitleWords = { text: display, parts, words, timing: "estimated" };
  subtitle.pages = paginateSubtitleWords(subtitle);
  return subtitle;
}

/** Word lengths approximate relative speaking time; they are not forced alignment. */
export function estimatedSubtitleWord(words: SubtitleWords["words"], progress: number): number {
  if (!words.length) return -1;
  const weights = words.map(({ weight }) => Number.isFinite(weight) && weight > 0 ? weight : 1);
  const target = Math.max(0, Math.min(0.999999, progress)) * weights.reduce((total, weight) => total + weight, 0);
  let elapsed = 0;
  for (let index = 0; index < weights.length; index += 1) {
    elapsed += weights[index];
    if (target < elapsed) return index;
  }
  return weights.length - 1;
}


/** Match the server's four-word/32-character pages for the loading fallback. */
export function paginateSubtitleWords(subtitle: SubtitleWords): SubtitlePage[] {
  if (subtitle.pages) return subtitle.pages;
  if (!subtitle.words.length) return [];
  const positions = subtitle.parts.flatMap((part, index) => part.kind === "word" ? [index] : []);
  const boundaries = [0];
  for (const position of positions.slice(1)) {
    let cursor = position;
    while (cursor > boundaries[boundaries.length - 1] && subtitle.parts[cursor - 1].kind === "space") cursor -= 1;
    let opening = cursor;
    while (opening > boundaries[boundaries.length - 1] && subtitle.parts[opening - 1].kind === "punctuation" && Array.from(subtitle.parts[opening - 1].text).every((char) => "([{«“‘".includes(char))) opening -= 1;
    boundaries.push(opening < cursor ? opening : position);
  }
  boundaries.push(subtitle.parts.length);
  const display = (start: number, end: number) => subtitle.parts.slice(boundaries[start], boundaries[end])
    .map((part, index) => (index > 0 && part.break_before ? "\u200b" : "") + part.text).join("").trim();
  const cumulative = [0];
  for (const { weight } of subtitle.words) cumulative.push(cumulative[cumulative.length - 1] + (Number.isFinite(weight) && weight > 0 ? weight : 1));
  const total = cumulative[cumulative.length - 1];
  const pages: SubtitlePage[] = [];
  const emit = (start: number, end: number) => pages.push({
    start_word: start, end_word: end, part_start: boundaries[start], part_end: boundaries[end],
    text: display(start, end), start: cumulative[start] / total, end: cumulative[end] / total,
  });
  let start = 0;
  for (let index = 0; index < subtitle.words.length; index += 1) {
    const end = index + 1;
    const length = Array.from(display(start, end).replace(/\u200b/g, "")).length;
    if (index > start && (end - start > 4 || length > 32)) { emit(start, index); start = index; }
    const trailing = subtitle.parts.slice(positions[index] + 1, boundaries[end]);
    if (trailing.some((part) => part.kind === "punctuation" && /[។៕.!?]/u.test(part.text))) {
      emit(start, end);
      start = end;
    }
  }
  if (start < subtitle.words.length) emit(start, subtitle.words.length);
  return pages;
}

export function subtitlePageForWord(subtitle: SubtitleWords, wordIndex: number): SubtitlePage | undefined {
  const pages = paginateSubtitleWords(subtitle);
  return pages.find((page) => wordIndex >= page.start_word && wordIndex < page.end_word)
    || (wordIndex < 0 ? pages[0] : pages[pages.length - 1]);
}
