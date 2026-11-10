"use client";

import { useEffect, useState } from "react";

export type CaptionStyle = {
  text_color: string; highlight_color: string; future_color: string;
  background_color: string; background_opacity: number; outline_color: string;
  outline_width: number; font_percent: number; bold: boolean; background: boolean;
  words_per_page: number; characters_per_page: number;
  behavior: "static" | "pulse" | "highlight" | "reveal" | "word";
  highlight_scale: number; margin_percent: number;
};
export type CaptionSettings = {
  subtitle_mode?: "kinetic" | "classic" | "off";
  subtitle_size?: "sm" | "md" | "lg";
  subtitle_position?: "bottom" | "center" | "top";
  subtitle_style?: Partial<CaptionStyle>;
};
const defaults: CaptionStyle = {
  text_color: "#ffffff", highlight_color: "#fcd34d", future_color: "#999999",
  background_color: "#000000", background_opacity: 62, outline_color: "#000000",
  outline_width: 2, font_percent: 3.4, bold: false, background: true,
  words_per_page: 4, characters_per_page: 32, behavior: "pulse", highlight_scale: 104, margin_percent: 5,
};
const presets: { name: string; style: Partial<CaptionStyle> }[] = [
  { name: "Studio Pulse", style: {} },
  { name: "Classic Box", style: { behavior: "static", background_opacity: 80 } },
  { name: "Cinema", style: { behavior: "static", background: false, outline_width: 2, font_percent: 3, margin_percent: 8 } },
  { name: "Bold Pop", style: { background: false, bold: true, outline_width: 4, font_percent: 4.4, highlight_color: "#a3e635", highlight_scale: 115 } },
  { name: "Karaoke", style: { behavior: "highlight", highlight_color: "#67e8f9", future_color: "#ffffff", background_opacity: 70 } },
  { name: "Progressive Reveal", style: { behavior: "reveal", highlight_color: "#ffffff", background: false, outline_width: 3 } },
  { name: "One Word", style: { behavior: "word", background: false, bold: true, font_percent: 5.5, outline_width: 4 } },
  { name: "Paper", style: { behavior: "static", text_color: "#171717", background_color: "#ffffff", background_opacity: 95, outline_width: 0, bold: true } },
];
function resolved(value: CaptionSettings): CaptionStyle {
  return { ...defaults, behavior: value.subtitle_mode === "classic" ? "static" : "pulse",
    font_percent: value.subtitle_size === "sm" ? 2.6 : value.subtitle_size === "lg" ? 4.4 : 3.4,
    ...value.subtitle_style };
}

export function SubtitleControls({ value, onChange }: { value: CaptionSettings; onChange: (patch: CaptionSettings) => void }) {
  const style = resolved(value);
  const activePreset = presets.find(preset => JSON.stringify({ ...defaults, ...preset.style }) === JSON.stringify(style))?.name;
  const update = (patch: Partial<CaptionStyle>) => onChange({ subtitle_style: { ...style, ...patch } });
  const field = "rounded border border-border bg-background px-2 py-1 text-xs min-w-0";
  return <details className="rounded-xl border border-border bg-card p-3 text-xs">
    <summary className="cursor-pointer font-semibold">Subtitle styles & behavior · {value.subtitle_mode === "off" ? "Off" : activePreset || "Custom"} <span className="font-normal text-muted-foreground">— customize</span></summary>
    <div className="mt-3 space-y-3">
      <label className="flex items-center gap-2"><input type="checkbox" checked={value.subtitle_mode !== "off"} onChange={e => onChange({ subtitle_mode: e.target.checked ? "kinetic" : "off" })} /> Burn subtitles into video</label>
      <div className="flex flex-wrap gap-1.5" aria-label="Subtitle presets">{presets.map(preset => <button key={preset.name} aria-pressed={activePreset === preset.name} className={`rounded-md border px-2 py-1.5 hover:bg-muted ${activePreset === preset.name ? "border-primary bg-primary/10 text-primary" : "border-border"}`} onClick={() => onChange({ subtitle_mode: "kinetic", subtitle_style: { ...defaults, ...preset.style } })}>{preset.name}</button>)}</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">Behavior<select className={field} value={style.behavior} onChange={e => update({ behavior: e.target.value as CaptionStyle["behavior"] })}><option value="static">Whole page</option><option value="pulse">Pulse active word</option><option value="highlight">Highlight active word</option><option value="reveal">Reveal words progressively</option><option value="word">One word at a time</option></select></label>
        <label className="flex flex-col gap-1">Position<select className={field} value={value.subtitle_position || "bottom"} onChange={e => onChange({ subtitle_position: e.target.value as CaptionSettings["subtitle_position"] })}><option value="bottom">Bottom</option><option value="center">Center</option><option value="top">Top</option></select></label>
        {([
          ["font_percent", "Font size (% of height)", 1.5, 8, 0.1],
          ["words_per_page", "Maximum words / screen", 1, 8, 1],
          ["characters_per_page", "Maximum characters / screen", 12, 80, 1],
          ["margin_percent", "Edge margin (%)", 2, 25, 1],
          ["outline_width", "Outline width", 0, 8, 0.5],
          ["background_opacity", "Background opacity (%)", 0, 100, 1],
          ["highlight_scale", "Pulse scale (%)", 100, 125, 1],
        ] as const).map(([key, label, min, max, step]) => <label key={key} className="flex flex-col gap-1">{label}: {style[key]}<input type="range" min={min} max={max} step={step} value={style[key]} onChange={e => update({ [key]: Number(e.target.value) })} /></label>)}
        {([ ["text_color", "Text"], ["highlight_color", "Active word"], ["future_color", "Upcoming words"], ["background_color", "Background"], ["outline_color", "Outline"] ] as const).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-2">{label}<input aria-label={`${label} color`} type="color" value={style[key]} onChange={e => update({ [key]: e.target.value })} /></label>)}
        <label className="flex items-center gap-2"><input type="checkbox" checked={style.bold} onChange={e => update({ bold: e.target.checked })} /> Bold text</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={style.background} onChange={e => update({ background: e.target.checked })} /> Background box</label>
      </div>
      <p className="text-muted-foreground">Preview uses the export renderer. Word timing is estimated from narration; it is not audio alignment. Long individual words stay intact. Changes are saved with this project; export again to update the MP4.</p>
    </div>
  </details>;
}

type Frame = { start: number; end: number; image: string };
export function SubtitlePreview({ text, aspectRatio, progress, value }: { text: string; aspectRatio: string; progress: number; value: CaptionSettings }) {
  const [result, setResult] = useState<{ key: string; frames: Frame[] }>({ key: "", frames: [] });
  const [error, setError] = useState("");
  const request = JSON.stringify({ text, aspect_ratio: aspectRatio, mode: value.subtitle_mode || "kinetic", size: value.subtitle_size || "md", position: value.subtitle_position || "bottom", style: value.subtitle_style || {} });
  const enabled = value.subtitle_mode !== "off" && !!text.trim();
  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("http://localhost:8000/api/subtitles/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: request, signal: abort.signal });
        if (!response.ok) throw new Error("Subtitle preview unavailable. Check the backend and FFmpeg.");
        const data: { frames: Frame[] } = await response.json();
        await Promise.all(data.frames.map(frame => new Promise<void>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(); image.onerror = reject; image.src = frame.image; })));
        if (!abort.signal.aborted) { setResult({ key: request, frames: data.frames }); setError(""); }
      } catch (error) { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : "Subtitle preview unavailable."); }
    }, 180);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [request, enabled]);
  if (!enabled) return null;
  const frames = result.key === request ? result.frames : [];
  const frame = frames.find(frame => progress >= frame.start && progress < frame.end);
  return <>
    {/* Frames already rendered by libass must bypass image optimization. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {frame && <img src={frame.image} alt="Subtitle preview" draggable={false} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />}
    {!frames.length && <span role="status" className="absolute left-2 bottom-2 z-20 bg-black/80 text-white text-[10px] px-2 py-1 rounded">{error || "Rendering subtitle preview…"}</span>}
  </>;
}
