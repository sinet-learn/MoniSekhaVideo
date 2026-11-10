import { estimateTextStats } from "./textStats";

export const MAX_SCENE_SECONDS = 10;
export const TARGET_SCENE_SECONDS = 8;

/** Split on dictionary word boundaries, preserving all text and punctuation. */
export function splitNarrationIntoScenes(text: string, measuredSeconds = 0): string[] {
  const source = text.trim();
  if (!source) return [];
  const words = estimateTextStats(source).words;
  const wordsPerChunk = measuredSeconds > MAX_SCENE_SECONDS
    ? Math.max(1, Math.min(18, Math.floor(words * TARGET_SCENE_SECONDS / measuredSeconds)))
    : 18;
  const segments = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("km", { granularity: "word" }).segment(source)
    : Array.from(source.matchAll(/\S+/g), (match) => ({ isWordLike: true, index: match.index! }));
  const result: string[] = [];
  let start = 0;
  let count = 0;
  for (const segment of segments) {
    if (!segment.isWordLike) continue;
    if (count === wordsPerChunk) {
      result.push(source.slice(start, segment.index).trim());
      start = segment.index;
      count = 0;
    }
    count += 1;
  }
  if (source.slice(start).trim()) result.push(source.slice(start).trim());
  return result;
}
