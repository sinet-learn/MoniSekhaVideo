"use client";

import { useState } from "react";
import { Scissors, Loader2 } from "lucide-react";
import { splitNarrationIntoScenes } from "../utils/sceneTiming";

interface SplitScene {
  id: number;
  narration_khmer?: string | null;
  audio_duration?: number;
  audio_error?: string | null;
}

export default function SceneSplitButton({ scene, onSplit }: { scene: SplitScene; onSplit?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const split = async () => {
    const rejectedDuration = Number(scene.audio_error?.match(/Voiceover is ([\d.]+)s/)?.[1] || 0);
    const chunks = splitNarrationIntoScenes(scene.narration_khmer || "", Math.max(scene.audio_duration || 0, rejectedDuration));
    if (chunks.length < 2) { setError("Shorten this line manually; it cannot be split safely at a word boundary."); return; }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${scene.id}/split`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chunks }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Could not split this scene.");
      await onSplit?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not split this scene."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-1">
    <button type="button" disabled={busy} onClick={split} className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-2 py-1 text-[11px] text-amber-600 dark:text-amber-400 disabled:opacity-50">
      {busy ? <Loader2 size={11} className="animate-spin" /> : <Scissors size={11} />} Split into shorter scenes
    </button>
    {error && <p role="alert" className="text-[11px] text-red-500">{error}</p>}
  </div>;
}
