/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Project, useProjectContext } from "../../context/ProjectContext";
import { 
  FolderCheck, 
  Image as ImageIcon, 
  AudioLines, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Music, 
  Type, 
  Plus, 
  Trash2, 
  Copy, 
  Film, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Scissors, 
  Sparkles, 
  Sliders, 
  Loader2,
  ChevronRight,
  Move,
  ZoomIn,
  ZoomOut,
  FileAudio,
  FileText,
  X,
  GripVertical,
  RefreshCw,
  Video,
  Clapperboard,
  VideoOff,
  Camera,
  Upload
} from "lucide-react";
import Link from "next/link";
import { type SubtitleWords } from "../../utils/subtitleWords";
import { SubtitleControls, SubtitlePreview, type CaptionStyle } from "../SubtitleEditor";

interface AssemblyTabProps {
  activeProject: Project;
  refreshProjectData?: () => Promise<void>;
}

interface SceneCouplingItem {
  id: number;
  scene_number: number;
  coupling_status: "ready" | "missing_audio" | "missing_image" | "uncoupled" | "overlong_audio";
  image_path: string;
  image_exists: boolean;
  image_mtime?: number;
  audio_path: string;
  audio_exists: boolean;
  audio_status: string;
  audio_error?: string | null;
  duration_limit_exceeded?: boolean;
  video_status?: "idle" | "queued" | "processing" | "completed" | "failed";
  video_error?: string | null;
  video_prompt?: string | null;
  video_model?: string | null;
  audio_mtime?: number;
  duration: number;
  volume: number;
  narration_khmer: string;
  subtitle?: SubtitleWords;
  image_prompt_english: string;
  animation?: {
    has_video: boolean;
    video_path?: string | null;
    video_type?: "ai_video" | "camera_motion" | null;
    has_ai_video?: boolean;
    has_motion_video?: boolean;
  };
}

interface BgmFile {
  filename: string;
  relative_path: string;
  duration: number;
  size_bytes: number;
}

interface TextOverlayItem {
  id: string;
  text: string;
  font_family: string;
  font_size: number;
  color: string;
  bg_color: string;
  position?: "bottom" | "center" | "top";
  x_percent: number; // 0 to 100
  y_percent: number; // 0 to 100
  start_time: number;
  duration: number;
}

interface BgmClip {
  id: string;
  relative_path: string;
  filename: string;
  start_time: number;
  duration: number;
  media_offset?: number;
  volume?: number;
}

interface TimelineState {
  bgm: BgmClip | null;
  bgm_clips: BgmClip[];
  text_overlays: TextOverlayItem[];
  scene_volumes: Record<string, number>;
  master_voice_volume?: number;
  master_bgm_volume: number;
  ducking: boolean;
  animation_mode?: "camera" | "ai_video" | "none";
  subtitle_mode?: "kinetic" | "classic" | "off";
  subtitle_size?: "sm" | "md" | "lg";
  subtitle_position?: "bottom" | "center" | "top";
  subtitle_style?: Partial<CaptionStyle>;
  scene_motions?: Record<string, "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "auto" | "none">;
}

const FONT_OPTIONS = [
  { id: "Arial, sans-serif", label: "Sans (Universal)" },
  { id: "Georgia, serif", label: "Serif (Editorial)" },
  { id: "'Impact', sans-serif", label: "Impact (Bold Title)" },
  { id: "'Khmer OS Battambang', 'Khmer Sangam MN', 'Kantumruy Pro', sans-serif", label: "Khmer Battambang" },
  { id: "'Khmer Sangam MN', 'Kantumruy Pro', sans-serif", label: "Khmer Standard" },
];

const COLOR_PRESETS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Yellow", value: "#FACC15" },
  { label: "Cyan", value: "#38BDF8" },
  { label: "Coral", value: "#F87171" },
  { label: "Black", value: "#000000" },
];

const BG_PRESETS = [
  { label: "Translucent Dark", value: "rgba(0,0,0,0.65)" },
  { label: "Solid Black", value: "rgba(0,0,0,0.95)" },
  { label: "Solid White", value: "rgba(255,255,255,0.9)" },
  { label: "Transparent", value: "transparent" },
];

export default function AssemblyTab({ activeProject, refreshProjectData }: AssemblyTabProps) {
  const { reorderScenes } = useProjectContext();
  const [scenesData, setScenesData] = useState<SceneCouplingItem[]>([]);
  const [bgmFiles, setBgmFiles] = useState<BgmFile[]>([]);
  const [totalDuration, setTotalDuration] = useState<number>(0);
  const [coupledCount, setCoupledCount] = useState<number>(0);
  const [finalVideoVersion, setFinalVideoVersion] = useState(0);
  const [hasFinalVideo, setHasFinalVideo] = useState<boolean>(false);
  const [isDismissedRenderBanner, setIsDismissedRenderBanner] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<"all" | "ready" | "incomplete">("all");
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);
  const [isUploadingBgm, setIsUploadingBgm] = useState<boolean>(false);
  const [isBgmGenOpen, setIsBgmGenOpen] = useState<boolean>(false);
  const [bgmPrompt, setBgmPrompt] = useState<string>("");
  const [bgmGenDuration, setBgmGenDuration] = useState<number>(30);
  const [isGeneratingBgm, setIsGeneratingBgm] = useState<boolean>(false);
  const [bgmGenError, setBgmGenError] = useState<string | null>(null);

  // Master Voiceover & Auto-sync state
  const [masterAudioPath, setMasterAudioPath] = useState<string | null>(null);
  const [masterAudioExists, setMasterAudioExists] = useState<boolean>(false);
  const [audioCacheBuster, setAudioCacheBuster] = useState<number>(() => Date.now());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const sceneIdsOrder = useMemo(() => {
    return (activeProject.scenes || []).map((s) => `${s.id}:${s.scene_number}`).join(",");
  }, [activeProject.scenes]);

  // Scene reorder drag & drop states
  const [draggedSceneIdx, setDraggedSceneIdx] = useState<number | null>(null);
  const [dragOverSceneIdx, setDragOverSceneIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
  const [dragHandleActiveIdx, setDragHandleActiveIdx] = useState<number | null>(null);

  const handleSceneDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSceneIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleSceneDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedSceneIdx === null || draggedSceneIdx === index) {
      setDragOverSceneIdx(null);
      setDropPosition(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "before" : "after";
    setDragOverSceneIdx(index);
    setDropPosition(pos);
  };

  const handleSceneDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSceneIdx === null || draggedSceneIdx === targetIndex) {
      setDraggedSceneIdx(null);
      setDragOverSceneIdx(null);
      setDropPosition(null);
      return;
    }

    const currentScenes = [...scenesData];
    const sourceScene = filteredScenes[draggedSceneIdx];
    const targetScene = filteredScenes[targetIndex];
    if (!sourceScene || !targetScene) return;

    const sourceIdxInFull = currentScenes.findIndex((s) => s.id === sourceScene.id);
    const targetIdxInFull = currentScenes.findIndex((s) => s.id === targetScene.id);
    if (sourceIdxInFull === -1 || targetIdxInFull === -1) return;

    const [draggedItem] = currentScenes.splice(sourceIdxInFull, 1);
    let insertIndex = targetIdxInFull;
    if (dropPosition === "after" && sourceIdxInFull < targetIdxInFull) {
      insertIndex = targetIdxInFull;
    } else if (dropPosition === "before" && sourceIdxInFull > targetIdxInFull) {
      insertIndex = targetIdxInFull;
    } else if (dropPosition === "after" && sourceIdxInFull > targetIdxInFull) {
      insertIndex = targetIdxInFull + 1;
    } else if (dropPosition === "before" && sourceIdxInFull < targetIdxInFull) {
      insertIndex = targetIdxInFull - 1;
    }
    insertIndex = Math.max(0, Math.min(currentScenes.length, insertIndex));
    currentScenes.splice(insertIndex, 0, draggedItem);

    const newOrderedIds = currentScenes.map((s) => s.id);

    setDraggedSceneIdx(null);
    setDragOverSceneIdx(null);
    setDropPosition(null);
    setDragHandleActiveIdx(null);

    if (reorderScenes) {
      await reorderScenes(newOrderedIds);
    }
  };

  const handleSceneDragEnd = () => {
    setDraggedSceneIdx(null);
    setDragOverSceneIdx(null);
    setDropPosition(null);
    setDragHandleActiveIdx(null);
  };
  
  // Timeline zoom level (pixels per second)
  const [zoomPxPerSec, setZoomPxPerSec] = useState<number>(35);

  // Timeline configuration
  const [timeline, setTimeline] = useState<TimelineState>({
    bgm: null,
    bgm_clips: [],
    text_overlays: [],
    scene_volumes: {},
    master_voice_volume: 1.0,
    master_bgm_volume: 0.35,
    ducking: true,
    animation_mode: "camera",
    subtitle_mode: "kinetic",
    subtitle_size: "md",
    subtitle_position: "bottom",
    scene_motions: {},
  });

  const [isVoiceVolOpen, setIsVoiceVolOpen] = useState<boolean>(false);
  const [isBgmVolOpen, setIsBgmVolOpen] = useState<boolean>(false);
  const voiceVolPopoverRef = useRef<HTMLDivElement>(null);
  const bgmVolPopoverRef = useRef<HTMLDivElement>(null);

  // Selected elements for timeline editing
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedBgmId, setSelectedBgmId] = useState<string | null>(null);
  const isBgmSelected = !!selectedBgmId;

  // Draggable Playhead Scrubber state
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState<boolean>(false);

  // Right-click context menu for BGM
  const [bgmContextMenu, setBgmContextMenu] = useState<{ visible: boolean; x: number; y: number; clipId?: string } | null>(null);

  // Dragging states
  const [isDraggingCanvasText, setIsDraggingCanvasText] = useState<boolean>(false);
  const [canvasDragStart, setCanvasDragStart] = useState<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null);
  
  // Timeline clip dragging
  const [timelineDrag, setTimelineDrag] = useState<{
    type: "text_move" | "text_trim_left" | "text_trim_right" | "bgm_move" | "bgm_trim_left" | "bgm_trim_right";
    id?: string;
    startMouseX: number;
    initialStartTime: number;
    initialDuration: number;
    initialMediaOffset?: number;
  } | null>(null);

  // Render job status
  const [renderJob, setRenderJob] = useState<{
    status: "idle" | "rendering" | "completed" | "failed";
    progress: number;
    output_path: string | null;
    error: string | null;
  }>({
    status: "idle",
    progress: 0,
    output_path: null,
    error: null,
  });

  // Interactive Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [auditioningSceneId, setAuditioningSceneId] = useState<number | null>(null);



  // Audio references
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const singleAuditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const playheadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // DOM references
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const timelineLanesRef = useRef<HTMLDivElement>(null);

  const slug = activeProject.slug || `project-${activeProject.id}`;
  const aspectRatio = activeProject.aspect_ratio || "16:9";

  const getAssetUrl = (path: string, timestamp?: number) => {
    if (!path) return "";
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    const t = timestamp !== undefined ? timestamp : audioCacheBuster;
    return `http://localhost:8000/static/${cleanPath}${t ? `?t=${t}` : ""}`;
  };

  // Fetch assembly coupling status & timeline
  const fetchAssemblyStatus = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsSyncing(true);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/assembly-status`);
      if (res.ok) {
        const data = await res.json();
        setScenesData(data.scenes || []);
        setBgmFiles(data.bgm_files || []);
        setTotalDuration(data.total_duration || 0);
        setCoupledCount(data.coupled_count || 0);
        setHasFinalVideo(data.has_final_video || false);
        setFinalVideoVersion(data.final_video_mtime || 0);
        if (data.master_audio_path) {
          setMasterAudioPath(data.master_audio_path);
          setMasterAudioExists(Boolean(data.master_audio_exists));
        } else {
          setMasterAudioPath(null);
          setMasterAudioExists(false);
        }
        if (data.audio_cache_buster) {
          setAudioCacheBuster(data.audio_cache_buster);
        }
        if (data.render_job) setRenderJob(data.render_job);

        // Load timeline configuration from server if exists
        if (data.timeline_data && Object.keys(data.timeline_data).length > 0) {
          const rawOverlays = data.timeline_data.text_overlays || [];
          const normalizedOverlays: TextOverlayItem[] = rawOverlays.map((t: any) => ({
            ...t,
            x_percent: t.x_percent ?? 50,
            y_percent: t.y_percent ?? (t.position === "top" ? 15 : t.position === "center" ? 50 : 85),
          }));

          let rawClips: BgmClip[] = [];
          if (Array.isArray(data.timeline_data.bgm_clips) && data.timeline_data.bgm_clips.length > 0) {
            rawClips = data.timeline_data.bgm_clips.map((c: any, i: number) => ({
              id: c.id || `bgm_${Date.now()}_${i}`,
              relative_path: c.relative_path,
              filename: c.filename,
              start_time: Math.max(0, c.start_time ?? 0),
              duration: Math.max(0.5, c.duration ?? 30),
              media_offset: Math.max(0, c.media_offset ?? 0),
              volume: c.volume ?? 1.0,
            }));
          } else if (data.timeline_data.bgm) {
            const rawBgm = data.timeline_data.bgm;
            rawClips = [{
              id: `bgm_${Date.now()}`,
              relative_path: rawBgm.relative_path,
              filename: rawBgm.filename,
              start_time: Math.max(0, rawBgm.start_time ?? 0),
              duration: Math.max(0.5, rawBgm.duration ?? 30),
              media_offset: Math.max(0, rawBgm.media_offset ?? 0),
              volume: rawBgm.volume ?? 1.0,
            }];
          }

          setTimeline({
            bgm: rawClips[0] || null,
            bgm_clips: rawClips,
            text_overlays: normalizedOverlays,
            scene_volumes: data.timeline_data.scene_volumes || {},
            master_voice_volume: data.timeline_data.master_voice_volume ?? 1.0,
            master_bgm_volume: data.timeline_data.master_bgm_volume ?? 0.35,
            ducking: data.timeline_data.ducking ?? true,
            animation_mode: data.timeline_data.animation_mode ?? "camera",
            subtitle_mode: data.timeline_data.subtitle_mode ?? "kinetic",
            subtitle_size: data.timeline_data.subtitle_size ?? "md",
            subtitle_position: data.timeline_data.subtitle_position ?? "bottom",
            subtitle_style: data.timeline_data.subtitle_style || {},
            scene_motions: data.timeline_data.scene_motions || {},
          });
        }
      }
    } catch (err) {
      console.error("Failed to load assembly status:", err);
    } finally {
      setIsLoadingStatus(false);
      if (showIndicator) {
        setTimeout(() => setIsSyncing(false), 500);
      }
    }
  }, [activeProject.id, sceneIdsOrder]);

  useEffect(() => {
    fetchAssemblyStatus();
  }, [fetchAssemblyStatus]);

  // Auto-sync polling whenever any scene is currently processing audio in the background
  const isAnySceneProcessing = useMemo(() => {
    return scenesData.some(s => s.audio_status === "processing" || s.audio_status === "pending" || s.video_status === "queued" || s.video_status === "processing");
  }, [scenesData]);

  useEffect(() => {
    if (!isAnySceneProcessing) return;
    const interval = setInterval(() => {
      fetchAssemblyStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [isAnySceneProcessing, fetchAssemblyStatus]);

  // Auto-refresh when tab gains focus or visibility (e.g. user generated voice in Voice tab and switched here)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchAssemblyStatus();
      }
    };
    const handleFocus = () => {
      fetchAssemblyStatus();
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchAssemblyStatus]);

  // Poll render status if rendering
  useEffect(() => {
    if (renderJob.status !== "rendering") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/render-status`);
        if (res.ok) {
          const job = await res.json();
          setRenderJob(job);
          if (job.status === "completed") {
            setHasFinalVideo(true);
            setFinalVideoVersion(Date.now());
            setIsDismissedRenderBanner(false);
            clearInterval(interval);
          } else if (job.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling render error:", err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [renderJob.status, activeProject.id]);

  // Always keep a ref to the latest timeline state to eliminate stale closures
  const timelineRef = useRef<TimelineState>(timeline);
  timelineRef.current = timeline;
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist timeline configuration to backend
  const persistTimelineState = async (stateToSave: TimelineState) => {
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/timeline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stateToSave),
      });
    } catch (err) {
      console.error("Failed to save timeline:", err);
    }
  };

  // State update with debounced persistence to avoid slider network floods
  const saveTimelineState = (newTimeline: TimelineState, immediate = false) => {
    timelineRef.current = newTimeline;
    setTimeline(newTimeline);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (immediate) {
      persistTimelineState(newTimeline);
    } else {
      saveTimeoutRef.current = setTimeout(() => {
        persistTimelineState(newTimeline);
      }, 250);
    }
  };

  // Animation controls
  const [animatingSceneNumber, setAnimatingSceneNumber] = useState<number | null>(null);

  const [animationSceneId, setAnimationSceneId] = useState<number | null>(null);
  const [animationPrompt, setAnimationPrompt] = useState("");
  const [animationProvider, setAnimationProvider] = useState<"camera" | "flow">("camera");
  const [cameraMotion, setCameraMotion] = useState("auto");
  const [animationModel, setAnimationModel] = useState("veo-lite");
  const [isSubmittingAnimation, setIsSubmittingAnimation] = useState(false);
  const [animationError, setAnimationError] = useState<string | null>(null);
  const animationScene = scenesData.find((scene) => scene.id === animationSceneId);
  const animationBusy = animationScene?.video_status === "queued" || animationScene?.video_status === "processing";
  const animationHasInput = Boolean(animationScene?.image_exists && animationScene?.audio_exists && animationScene.audio_status === "completed" && animationScene.duration > 0);
  const animationAspectSupported = animationProvider === "camera" || aspectRatio === "16:9" || aspectRatio === "9:16";

  const openAnimationDialog = (scene: SceneCouplingItem) => {
    setAnimationSceneId(scene.id);
    setAnimationPrompt(scene.video_prompt || "Animate this image with subtle, natural movement. Preserve the characters, composition and illustration style. Do not add text or speech.");
    setCameraMotion(timeline.scene_motions?.[String(scene.scene_number)] || "auto");
    setAnimationModel(scene.video_model || "veo-lite");
    setAnimationError(null);
  };

  const handleGenerateAnimation = async () => {
    if (!animationScene || animationBusy || isSubmittingAnimation) return;
    setIsSubmittingAnimation(true);
    setAnimationError(null);
    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${animationScene.id}/${animationProvider === "camera" ? "generate-motion" : "generate-video"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(animationProvider === "camera" ? { motion_type: cameraMotion } : { provider: "flow", prompt: animationPrompt.trim(), model: animationModel }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : "Could not start animation generation.");
      setScenesData((prev) => prev.map((scene) => scene.id === animationScene.id ? { ...scene, video_status: result.status, video_error: null } : scene));
      saveTimelineState({ ...timeline, animation_mode: animationProvider === "camera" ? "camera" : "ai_video" }, true);
      await fetchAssemblyStatus();
    } catch (error) {
      setAnimationError(error instanceof Error ? error.message : "Could not start animation generation.");
    } finally {
      setIsSubmittingAnimation(false);
    }
  };

  const handleAnimationModeChange = (mode: "camera" | "ai_video" | "none") => {
    const updated: TimelineState = { ...timeline, animation_mode: mode };
    saveTimelineState(updated, true);
  };

  const handleSceneMotionChange = (sceneNumber: number, motion: "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "auto" | "none") => {
    const nextMotions = { ...(timeline.scene_motions || {}), [String(sceneNumber)]: motion };
    const updated: TimelineState = { ...timeline, scene_motions: nextMotions };
    saveTimelineState(updated, true);
  };

  const handleGenerateSceneMotion = async (scene: SceneCouplingItem, motionType: string = "auto") => {
    setAnimatingSceneNumber(scene.scene_number);
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${scene.id}/generate-motion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motion_type: motionType }),
      });
      if (res.ok) {
        fetchAssemblyStatus(true);
      }
    } catch (err) {
      console.error("Failed to generate scene motion:", err);
    } finally {
      setAnimatingSceneNumber(null);
    }
  };

  const handleUploadSceneVideo = async (scene: SceneCouplingItem, file: File) => {
    setAnimatingSceneNumber(scene.scene_number);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`http://localhost:8000/api/scenes/${scene.id}/upload-video`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchAssemblyStatus(true);
      }
    } catch (err) {
      console.error("Failed to upload scene video:", err);
    } finally {
      setAnimatingSceneNumber(null);
    }
  };

  const handleDeleteSceneVideo = async (scene: SceneCouplingItem) => {
    setAnimatingSceneNumber(scene.scene_number);
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${scene.id}/animation-video`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchAssemblyStatus(true);
      }
    } catch (err) {
      console.error("Failed to delete scene animation video:", err);
    } finally {
      setAnimatingSceneNumber(null);
    }
  };

  // Close context menu and volume popovers on any outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setBgmContextMenu(null);
      if (voiceVolPopoverRef.current && !voiceVolPopoverRef.current.contains(e.target as Node)) {
        setIsVoiceVolOpen(false);
      }
      if (bgmVolPopoverRef.current && !bgmVolPopoverRef.current.contains(e.target as Node)) {
        setIsBgmVolOpen(false);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  // Computes accumulated start times for each coupled scene
  const sceneTimelineMap = useMemo(() => {
    let accumulated = 0;
    return scenesData.map(s => {
      const start = accumulated;
      const dur = (s.audio_exists && s.duration > 0) ? s.duration : (s.coupling_status === "ready" ? s.duration : 3.0);
      accumulated += dur;
      return {
        ...s,
        timeline_start: start,
        timeline_end: start + dur,
        effective_dur: dur,
      };
    });
  }, [scenesData]);

  // TIMELINE DURATION CLAMPING:
  // Strictly capped to ~10s headroom above video speech duration, with minimum 30s!
  // It will NOT stretch to 3 minutes just because an uploaded mp3 is 3 minutes long.
  // And as new scenes are added/coupled, the timeline dynamically and smoothly expands with them!
  const maxTimelineDuration = useMemo(() => {
    const videoSceneDur = totalDuration > 0 ? totalDuration : 20.0;
    const maxBgmEnd = timeline.bgm_clips.reduce((max, c) => Math.max(max, c.start_time + c.duration), 0);
    const maxTextEnd = timeline.text_overlays.reduce((max, t) => Math.max(max, t.start_time + t.duration), 0);
    const maxContent = Math.max(videoSceneDur, maxBgmEnd, maxTextEnd);
    return Math.max(30.0, Math.ceil(maxContent + 10.0));
  }, [totalDuration, timeline.bgm_clips, timeline.text_overlays]);

  // Current active scene at playhead
  const currentSceneAtPlayhead = useMemo(() => {
    const found = sceneTimelineMap.find(s => currentTime >= s.timeline_start && currentTime < s.timeline_end);
    return found || sceneTimelineMap[0];
  }, [sceneTimelineMap, currentTime]);

  // Current active text overlay at playhead
  const activeOverlayAtPlayhead = useMemo(() => {
    if (selectedTextId) {
      const selected = timeline.text_overlays.find(t => t.id === selectedTextId);
      if (selected) return selected;
    }
    return timeline.text_overlays.find(t => currentTime >= t.start_time && currentTime < t.start_time + t.duration);
  }, [timeline.text_overlays, currentTime, selectedTextId]);

  // Selected text item object
  const selectedTextItem = useMemo(() => {
    return timeline.text_overlays.find(t => t.id === selectedTextId) || null;
  }, [timeline.text_overlays, selectedTextId]);

  // Selected BGM item object
  const selectedBgmItem = useMemo(() => {
    return timeline.bgm_clips.find(c => c.id === selectedBgmId) || null;
  }, [timeline.bgm_clips, selectedBgmId]);

  // Master voiceover track URL
  const masterAudioUrl = useMemo(() => {
    if (masterAudioPath && masterAudioExists) {
      return getAssetUrl(masterAudioPath, audioCacheBuster);
    }
    return null;
  }, [masterAudioPath, masterAudioExists, audioCacheBuster]);

  // Keep master audio element loaded with current master audio url
  useEffect(() => {
    const voiceAudio = voiceAudioRef.current;
    if (!voiceAudio || !masterAudioUrl) return;
    if (voiceAudio.src !== masterAudioUrl) {
      const wasPlaying = isPlaying;
      const prevTime = currentTime;
      voiceAudio.src = masterAudioUrl;
      voiceAudio.currentTime = Math.min(prevTime, voiceAudio.duration || prevTime);
      if (wasPlaying) {
        voiceAudio.play().catch(() => {});
      }
    }
  }, [masterAudioUrl]);

  // -------------------------------------------------------------
  // AUDIO SYNCHRONIZATION ENGINE (Voiceover + Multi-Clip BGM Preview)
  // -------------------------------------------------------------
  useEffect(() => {
    const currentScene = currentSceneAtPlayhead;
    const voiceAudio = voiceAudioRef.current;
    const bgmAudio = bgmAudioRef.current;

    // 1. VOICEOVER SYNCHRONIZATION
    if (voiceAudio) {
      const masterVoice = timeline.master_voice_volume ?? 1.0;
      if (masterAudioUrl) {
        // Continuous master voiceover: dynamically adjust volume per scene without touching src
        const sceneVolume = currentScene 
          ? (timeline.scene_volumes[String(currentScene.scene_number)] ?? 1.0) 
          : 1.0;
        voiceAudio.volume = Math.min(1.0, Math.max(0.0, sceneVolume * masterVoice));
      } else {
        // Fallback for individual scene tracks if master audio is not compiled
        if (currentScene && currentScene.audio_exists && currentScene.audio_path) {
          const sceneAudioUrl = getAssetUrl(currentScene.audio_path, currentScene.audio_mtime);
          const expectedSceneTime = Math.max(0, currentTime - currentScene.timeline_start);
          const sceneVolume = timeline.scene_volumes[String(currentScene.scene_number)] ?? 1.0;
          voiceAudio.volume = Math.min(1.0, Math.max(0.0, sceneVolume * masterVoice));

          if (voiceAudio.src !== sceneAudioUrl) {
            voiceAudio.src = sceneAudioUrl;
            voiceAudio.currentTime = expectedSceneTime;
            if (isPlaying) {
              voiceAudio.play().catch(() => {});
            }
          } else {
            if (Math.abs(voiceAudio.currentTime - expectedSceneTime) > 0.4) {
              voiceAudio.currentTime = expectedSceneTime;
            }
            if (isPlaying && voiceAudio.paused) {
              voiceAudio.play().catch(() => {});
            } else if (!isPlaying && !voiceAudio.paused) {
              voiceAudio.pause();
            }
          }
        } else {
          if (!voiceAudio.paused) voiceAudio.pause();
        }
      }
    }

    // 2. BACKGROUND MUSIC SYNCHRONIZATION (Multi-Clip Support)
    if (bgmAudio) {
      const activeClip = timeline.bgm_clips.find(
        c => currentTime >= c.start_time && currentTime < (c.start_time + c.duration)
      );

      if (activeClip && activeClip.relative_path) {
        const bgmUrl = getAssetUrl(activeClip.relative_path);
        if (bgmAudio.src !== bgmUrl) {
          bgmAudio.src = bgmUrl;
          bgmAudio.load();
        }

        const hasSpeech = currentScene && currentScene.audio_exists;
        const duckFactor = (timeline.ducking && hasSpeech) ? 0.35 : 1.0;
        const clipVol = activeClip.volume ?? 1.0;
        bgmAudio.volume = Math.min(1.0, Math.max(0.0, timeline.master_bgm_volume * clipVol * duckFactor));

        const offsetWithinClip = currentTime - activeClip.start_time;
        const expectedBgmTime = (activeClip.media_offset || 0) + offsetWithinClip;

        if (Math.abs(bgmAudio.currentTime - expectedBgmTime) > 0.35) {
          bgmAudio.currentTime = expectedBgmTime;
        }

        if (isPlaying && bgmAudio.paused) {
          bgmAudio.play().catch(() => {});
        } else if (!isPlaying && !bgmAudio.paused) {
          bgmAudio.pause();
        }
      } else {
        if (!bgmAudio.paused) bgmAudio.pause();
      }
    }
  }, [currentTime, isPlaying, currentSceneAtPlayhead, timeline.bgm_clips, timeline.master_voice_volume, timeline.master_bgm_volume, timeline.ducking, timeline.scene_volumes, masterAudioUrl]);

  // Master Play / Pause toggler
  const togglePlay = () => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (maxTimelineDuration <= 0) return;
    setIsPlaying(true);
    const startTimestamp = performance.now() - (currentTime * 1000);

    const voiceAudio = voiceAudioRef.current;
    if (voiceAudio && masterAudioUrl) {
      if (currentTime < (voiceAudio.duration || totalDuration || maxTimelineDuration)) {
        voiceAudio.currentTime = currentTime;
        voiceAudio.play().catch(() => {});
      }
    }

    if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);

    playheadIntervalRef.current = setInterval(() => {
      const vAudio = voiceAudioRef.current;
      // When master audio is available and active, its clock is the source of truth
      if (vAudio && masterAudioUrl && !vAudio.paused && !vAudio.ended && vAudio.duration > 0) {
        const audioT = vAudio.currentTime;
        if (audioT >= maxTimelineDuration) {
          stopPlayback();
          setCurrentTime(0);
        } else {
          setCurrentTime(audioT);
        }
      } else {
        const elapsed = (performance.now() - startTimestamp) / 1000;
        if (elapsed >= maxTimelineDuration) {
          stopPlayback();
          setCurrentTime(0);
        } else {
          setCurrentTime(elapsed);
        }
      }
    }, 35);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (playheadIntervalRef.current) {
      clearInterval(playheadIntervalRef.current);
      playheadIntervalRef.current = null;
    }
    if (voiceAudioRef.current) voiceAudioRef.current.pause();
    if (bgmAudioRef.current) bgmAudioRef.current.pause();
  };

  const handleSeek = (time: number) => {
    const clamped = Math.max(0, Math.min(maxTimelineDuration, time));
    setCurrentTime(clamped);

    const voiceAudio = voiceAudioRef.current;
    if (voiceAudio && masterAudioUrl) {
      if (clamped < (voiceAudio.duration || totalDuration || maxTimelineDuration)) {
        voiceAudio.currentTime = clamped;
      }
    }

    const bgmAudio = bgmAudioRef.current;
    if (bgmAudio) {
      const activeClip = timeline.bgm_clips.find(
        c => clamped >= c.start_time && clamped < (c.start_time + c.duration)
      );
      if (activeClip) {
        const offsetWithinClip = clamped - activeClip.start_time;
        const expectedBgmTime = (activeClip.media_offset || 0) + offsetWithinClip;
        bgmAudio.currentTime = expectedBgmTime;
      }
    }

    if (isPlaying) {
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
      const startTimestamp = performance.now() - (clamped * 1000);

      if (voiceAudio && masterAudioUrl) {
        if (clamped < (voiceAudio.duration || totalDuration || maxTimelineDuration)) {
          voiceAudio.currentTime = clamped;
          voiceAudio.play().catch(() => {});
        } else {
          voiceAudio.pause();
        }
      }

      playheadIntervalRef.current = setInterval(() => {
        const vAudio = voiceAudioRef.current;
        if (vAudio && masterAudioUrl && !vAudio.paused && !vAudio.ended && vAudio.duration > 0) {
          const audioT = vAudio.currentTime;
          if (audioT >= maxTimelineDuration) {
            stopPlayback();
            setCurrentTime(0);
          } else {
            setCurrentTime(audioT);
          }
        } else {
          const elapsed = (performance.now() - startTimestamp) / 1000;
          if (elapsed >= maxTimelineDuration) {
            stopPlayback();
            setCurrentTime(0);
          } else {
            setCurrentTime(elapsed);
          }
        }
      }, 35);
    }
  };

  // Single scene isolated voice audition
  const handleAuditionSingleScene = (scene: SceneCouplingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!scene.audio_exists || !scene.audio_path) return;

    if (auditioningSceneId === scene.id) {
      if (singleAuditionAudioRef.current) {
        singleAuditionAudioRef.current.pause();
      }
      setAuditioningSceneId(null);
      return;
    }

    if (isPlaying) stopPlayback();

    setAuditioningSceneId(scene.id);
    if (singleAuditionAudioRef.current) {
      const freshUrl = getAssetUrl(scene.audio_path, scene.audio_mtime || audioCacheBuster);
      singleAuditionAudioRef.current.src = freshUrl;
      const vol = (timeline.scene_volumes[String(scene.scene_number)] ?? 1.0) * (timeline.master_voice_volume ?? 1.0);
      singleAuditionAudioRef.current.volume = Math.min(1.0, Math.max(0.0, vol));
      singleAuditionAudioRef.current.currentTime = 0;
      singleAuditionAudioRef.current.play().catch(() => {});
      singleAuditionAudioRef.current.onended = () => {
        setAuditioningSceneId(null);
      };
    }
  };

  // Keyboard Spacebar play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // -------------------------------------------------------------
  // FREEFORM TEXT DRAGGING ON VIDEO CANVAS
  // -------------------------------------------------------------
  const handleCanvasTextPointerDown = (e: React.PointerEvent) => {
    if (!activeOverlayAtPlayhead) return;
    e.stopPropagation();
    setSelectedTextId(activeOverlayAtPlayhead.id);
    setSelectedBgmId(null);
    setIsDraggingCanvasText(true);
    setCanvasDragStart({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: activeOverlayAtPlayhead.x_percent,
      initialY: activeOverlayAtPlayhead.y_percent,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasTextPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCanvasText || !canvasDragStart || !activeOverlayAtPlayhead || !videoViewportRef.current) return;
    const rect = videoViewportRef.current.getBoundingClientRect();
    const deltaXPixels = e.clientX - canvasDragStart.mouseX;
    const deltaYPixels = e.clientY - canvasDragStart.mouseY;

    const deltaXPercent = (deltaXPixels / rect.width) * 100;
    const deltaYPercent = (deltaYPixels / rect.height) * 100;

    const newX = Math.round(Math.max(5, Math.min(95, canvasDragStart.initialX + deltaXPercent)) * 10) / 10;
    const newY = Math.round(Math.max(5, Math.min(95, canvasDragStart.initialY + deltaYPercent)) * 10) / 10;

    handleUpdateText(activeOverlayAtPlayhead.id, { x_percent: newX, y_percent: newY });
  };

  const handleCanvasTextPointerUp = (e: React.PointerEvent) => {
    if (isDraggingCanvasText) {
      setIsDraggingCanvasText(false);
      setCanvasDragStart(null);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  // -------------------------------------------------------------
  // DRAGGABLE PLAYHEAD SCRUBBER ENGINE
  // -------------------------------------------------------------
  const updatePlayheadFromPointer = (clientX: number) => {
    if (!timelineLanesRef.current) return;
    const rect = timelineLanesRef.current.getBoundingClientRect();
    const scrollLeft = timelineLanesRef.current.scrollLeft || 0;
    const xPos = clientX - rect.left + scrollLeft;
    const targetTime = Math.max(0, Math.min(maxTimelineDuration, xPos / zoomPxPerSec));
    handleSeek(Math.round(targetTime * 10) / 10);
  };

  const handlePlayheadPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDraggingPlayhead(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updatePlayheadFromPointer(e.clientX);
  };

  const handlePlayheadPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingPlayhead) return;
    e.stopPropagation();
    updatePlayheadFromPointer(e.clientX);
  };

  const handlePlayheadPointerUp = (e: React.PointerEvent) => {
    if (isDraggingPlayhead) {
      setIsDraggingPlayhead(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // CAPCUT-STYLE TIMELINE DRAG & RESIZE ENGINE
  // -------------------------------------------------------------
  const handleTimelineClipPointerDown = (
    e: React.PointerEvent, 
    type: "text_move" | "text_trim_left" | "text_trim_right" | "bgm_move" | "bgm_trim_left" | "bgm_trim_right", 
    id?: string,
    initialStartTime: number = 0,
    initialDuration: number = 3,
    initialMediaOffset: number = 0
  ) => {
    e.stopPropagation();
    if (type.startsWith("text")) {
      if (id) setSelectedTextId(id);
      setSelectedBgmId(null);
    } else {
      if (id) setSelectedBgmId(id);
      setSelectedTextId(null);
    }

    setTimelineDrag({
      type,
      id,
      startMouseX: e.clientX,
      initialStartTime,
      initialDuration,
      initialMediaOffset,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleTimelineClipPointerMove = (e: React.PointerEvent) => {
    if (!timelineDrag) return;
    e.stopPropagation();
    const deltaPx = e.clientX - timelineDrag.startMouseX;
    const deltaTime = deltaPx / zoomPxPerSec;

    if (timelineDrag.type === "text_move" && timelineDrag.id) {
      const newStart = Math.max(0, Math.round((timelineDrag.initialStartTime + deltaTime) * 10) / 10);
      const updated = timelineRef.current.text_overlays.map(t => t.id === timelineDrag.id ? { ...t, start_time: newStart } : t);
      const next = { ...timelineRef.current, text_overlays: updated };
      timelineRef.current = next;
      setTimeline(next);
    } else if (timelineDrag.type === "text_trim_right" && timelineDrag.id) {
      const newDur = Math.max(0.5, Math.round((timelineDrag.initialDuration + deltaTime) * 10) / 10);
      const updated = timelineRef.current.text_overlays.map(t => t.id === timelineDrag.id ? { ...t, duration: newDur } : t);
      const next = { ...timelineRef.current, text_overlays: updated };
      timelineRef.current = next;
      setTimeline(next);
    } else if (timelineDrag.type === "text_trim_left" && timelineDrag.id) {
      const maxDelta = timelineDrag.initialDuration - 0.5;
      const minDelta = -timelineDrag.initialStartTime;
      const clampedDelta = Math.min(maxDelta, Math.max(minDelta, deltaTime));
      const newStart = Math.max(0, Math.round((timelineDrag.initialStartTime + clampedDelta) * 10) / 10);
      const newDur = Math.max(0.5, Math.round((timelineDrag.initialDuration - clampedDelta) * 10) / 10);
      const updated = timelineRef.current.text_overlays.map(t => t.id === timelineDrag.id ? { ...t, start_time: newStart, duration: newDur } : t);
      const next = { ...timelineRef.current, text_overlays: updated };
      timelineRef.current = next;
      setTimeline(next);
    } else if (timelineDrag.type === "bgm_move" && timelineDrag.id) {
      const newStart = Math.max(0, Math.round((timelineDrag.initialStartTime + deltaTime) * 10) / 10);
      const updated = timelineRef.current.bgm_clips.map(c => c.id === timelineDrag.id ? { ...c, start_time: newStart } : c);
      const next = { ...timelineRef.current, bgm_clips: updated, bgm: updated[0] || null };
      timelineRef.current = next;
      setTimeline(next);
    } else if (timelineDrag.type === "bgm_trim_right" && timelineDrag.id) {
      const newDur = Math.max(0.5, Math.round((timelineDrag.initialDuration + deltaTime) * 10) / 10);
      const updated = timelineRef.current.bgm_clips.map(c => c.id === timelineDrag.id ? { ...c, duration: newDur } : c);
      const next = { ...timelineRef.current, bgm_clips: updated, bgm: updated[0] || null };
      timelineRef.current = next;
      setTimeline(next);
    } else if (timelineDrag.type === "bgm_trim_left" && timelineDrag.id) {
      const maxDelta = timelineDrag.initialDuration - 0.5;
      const minDeltaByTimeline = -timelineDrag.initialStartTime;
      const minDeltaByOffset = -(timelineDrag.initialMediaOffset || 0);
      const minDelta = Math.max(minDeltaByTimeline, minDeltaByOffset);
      const clampedDelta = Math.min(maxDelta, Math.max(minDelta, deltaTime));

      const newStart = Math.max(0, Math.round((timelineDrag.initialStartTime + clampedDelta) * 10) / 10);
      const newDur = Math.max(0.5, Math.round((timelineDrag.initialDuration - clampedDelta) * 10) / 10);
      const newOffset = Math.max(0, Math.round(((timelineDrag.initialMediaOffset || 0) + clampedDelta) * 10) / 10);

      const updated = timelineRef.current.bgm_clips.map(c => c.id === timelineDrag.id ? { ...c, start_time: newStart, duration: newDur, media_offset: newOffset } : c);
      const next = { ...timelineRef.current, bgm_clips: updated, bgm: updated[0] || null };
      timelineRef.current = next;
      setTimeline(next);
    }
  };

  const handleTimelineClipPointerUp = (e: React.PointerEvent) => {
    if (timelineDrag) {
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setTimelineDrag(null);
      persistTimelineState(timelineRef.current);
    }
  };

  // Split tool at playhead
  const handleSplitAtPlayhead = () => {
    const currentTimeline = timelineRef.current;
    if (selectedTextId) {
      const item = currentTimeline.text_overlays.find(t => t.id === selectedTextId);
      if (item && currentTime > item.start_time && currentTime < item.start_time + item.duration) {
        const firstDur = Math.max(0.5, Math.round((currentTime - item.start_time) * 10) / 10);
        const secondDur = Math.max(0.5, Math.round((item.duration - firstDur) * 10) / 10);
        
        const secondItem: TextOverlayItem = {
          ...item,
          id: `text_${Date.now()}`,
          start_time: Math.round(currentTime * 10) / 10,
          duration: secondDur,
        };

        const updatedOverlays = currentTimeline.text_overlays.map(t => 
          t.id === item.id ? { ...t, duration: firstDur } : t
        );
        updatedOverlays.push(secondItem);

        saveTimelineState({ ...currentTimeline, text_overlays: updatedOverlays });
        setSelectedTextId(secondItem.id);
        setSelectedBgmId(null);
      }
    } else {
      // Look for BGM clip to split (either selected or clip under playhead)
      const targetClip = currentTimeline.bgm_clips.find(c => 
        (c.id === selectedBgmId && currentTime > c.start_time && currentTime < c.start_time + c.duration) ||
        (currentTime > c.start_time && currentTime < c.start_time + c.duration)
      );

      if (targetClip) {
        const splitOffset = Math.round((currentTime - targetClip.start_time) * 10) / 10;
        const firstDur = Math.max(0.5, splitOffset);
        const secondDur = Math.max(0.5, Math.round((targetClip.duration - splitOffset) * 10) / 10);
        
        const newSecondId = `bgm_${Date.now()}`;
        const secondClip: BgmClip = {
          ...targetClip,
          id: newSecondId,
          start_time: Math.round(currentTime * 10) / 10,
          duration: secondDur,
          media_offset: (targetClip.media_offset || 0) + splitOffset,
          volume: targetClip.volume ?? 1.0,
        };

        const updatedClips = currentTimeline.bgm_clips.flatMap(c => {
          if (c.id === targetClip.id) {
            return [
              { ...c, duration: firstDur },
              secondClip,
            ];
          }
          return [c];
        });

        saveTimelineState({
          ...currentTimeline,
          bgm_clips: updatedClips,
          bgm: updatedClips[0] || null,
        });
        setSelectedBgmId(newSecondId);
        setSelectedTextId(null);
      }
    }
  };

  // Add text overlay
  const handleAddText = () => {
    const newText: TextOverlayItem = {
      id: `text_${Date.now()}`,
      text: "New Caption",
      font_family: "Arial, sans-serif",
      font_size: 34,
      color: "#FFFFFF",
      bg_color: "rgba(0,0,0,0.65)",
      x_percent: 50,
      y_percent: 85,
      start_time: Math.round(currentTime * 10) / 10,
      duration: 3.5,
    };
    const updated = {
      ...timeline,
      text_overlays: [...timeline.text_overlays, newText],
    };
    setSelectedTextId(newText.id);
    setSelectedBgmId(null);
    saveTimelineState(updated);
  };

  // Update text overlay
  const handleUpdateText = (id: string, updates: Partial<TextOverlayItem>) => {
    const updatedOverlays = timeline.text_overlays.map(t => t.id === id ? { ...t, ...updates } : t);
    saveTimelineState({ ...timeline, text_overlays: updatedOverlays });
  };

  // Duplicate selected item (Clones BGM clip and places immediately after the first one!)
  const handleDuplicateSelected = () => {
    const currentTimeline = timelineRef.current;
    if (selectedTextId) {
      const item = currentTimeline.text_overlays.find(t => t.id === selectedTextId);
      if (!item) return;
      const cloned: TextOverlayItem = {
        ...item,
        id: `text_${Date.now()}`,
        start_time: Math.round((item.start_time + item.duration + 0.2) * 10) / 10,
        duration: item.duration,
      };
      saveTimelineState({
        ...currentTimeline,
        text_overlays: [...currentTimeline.text_overlays, cloned],
      });
      setSelectedTextId(cloned.id);
      setSelectedBgmId(null);
    } else if (selectedBgmId || currentTimeline.bgm_clips.length > 0) {
      const targetClip = currentTimeline.bgm_clips.find(c => c.id === selectedBgmId) || currentTimeline.bgm_clips[currentTimeline.bgm_clips.length - 1];
      if (!targetClip) return;

      // DUPLICATE BGM: Clone the clip and place it immediately after the first one
      // It keeps the EXACT trimmed duration of targetClip!
      const newId = `bgm_${Date.now()}`;
      const clonedClip: BgmClip = {
        ...targetClip,
        id: newId,
        start_time: Math.round((targetClip.start_time + targetClip.duration) * 10) / 10,
        duration: targetClip.duration, // EXACT trimmed duration!
        media_offset: targetClip.media_offset ?? 0,
        volume: targetClip.volume ?? 1.0,
      };

      const updatedClips = [...currentTimeline.bgm_clips, clonedClip];
      saveTimelineState({
        ...currentTimeline,
        bgm_clips: updatedClips,
        bgm: updatedClips[0] || null,
      });
      setSelectedBgmId(newId);
      setSelectedTextId(null);
    }
  };

  // Delete selected clip
  const handleDeleteSelected = () => {
    const currentTimeline = timelineRef.current;
    if (selectedTextId) {
      const updated = currentTimeline.text_overlays.filter(t => t.id !== selectedTextId);
      setSelectedTextId(null);
      saveTimelineState({ ...currentTimeline, text_overlays: updated });
    } else if (selectedBgmId) {
      const updated = currentTimeline.bgm_clips.filter(c => c.id !== selectedBgmId);
      setSelectedBgmId(null);
      saveTimelineState({
        ...currentTimeline,
        bgm_clips: updated,
        bgm: updated[0] || null,
      });
    }
  };

  // Scene voice volume change
  const handleSceneVolumeChange = (sceneNum: number, vol: number) => {
    const newVolumes = { ...timeline.scene_volumes, [String(sceneNum)]: vol };
    const updated = { ...timeline, scene_volumes: newVolumes };
    saveTimelineState(updated);
  };

  // Register a BGM file in the library and append it to the timeline as a clip
  const addBgmFileToTimeline = (uploadedFile: BgmFile) => {
    setBgmFiles(prev => [...prev.filter(f => f.filename !== uploadedFile.filename), uploadedFile]);

    // Auto-append or set BGM clip, clamped to maxTimelineDuration
    const newClip: BgmClip = {
      id: `bgm_${Date.now()}`,
      relative_path: uploadedFile.relative_path,
      filename: uploadedFile.filename,
      start_time: 0.0,
      duration: Math.min(uploadedFile.duration, maxTimelineDuration),
      media_offset: 0,
      volume: 1.0,
    };
    const updatedClips = [...timeline.bgm_clips, newClip];
    saveTimelineState({
      ...timeline,
      bgm_clips: updatedClips,
      bgm: updatedClips[0] || null,
    });
    setSelectedBgmId(newClip.id);
    setSelectedTextId(null);
  };

  // Generate BGM locally with MusicGen
  const handleGenerateBgm = async () => {
    if (!bgmPrompt.trim() || isGeneratingBgm) return;
    setIsGeneratingBgm(true);
    setBgmGenError(null);
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/generate-bgm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: bgmPrompt.trim(), duration: bgmGenDuration }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.detail || `Generation failed (${res.status})`);
      addBgmFileToTimeline(result.file);
      setIsBgmGenOpen(false);
    } catch (err: any) {
      setBgmGenError(err.message || "Music generation failed");
    } finally {
      setIsGeneratingBgm(false);
    }
  };

  // Upload BGM file
  const handleBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBgm(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/upload-bgm`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const result = await res.json();
        addBgmFileToTimeline(result.file);
      }
    } catch (err) {
      console.error("Upload BGM failed:", err);
    } finally {
      setIsUploadingBgm(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Delete rendered video file from disk & state
  const handleDeleteRenderedVideo = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/render`, {
        method: "DELETE",
      });
      if (res.ok) {
        setHasFinalVideo(false);
        setIsDismissedRenderBanner(true);
        setRenderJob({ status: "idle", progress: 0, output_path: null, error: null });
      }
    } catch (err) {
      console.error("Failed to delete rendered video:", err);
    }
  };

  // Trigger video render
  const handleTriggerRender = async () => {
    if (coupledCount === 0) return;
    try {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Ensure latest timeline state is saved before triggering render
      await persistTimelineState(timelineRef.current);

      setRenderJob({ status: "rendering", progress: 5, output_path: null, error: null });
      const res = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/render-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline_data: timelineRef.current }),
      });
      if (!res.ok) {
        const data = await res.json();
        setRenderJob({ status: "failed", progress: 0, output_path: null, error: data.detail || "Render failed" });
      }
    } catch (err: any) {
      setRenderJob({ status: "failed", progress: 0, output_path: null, error: err.message || "Failed to trigger render" });
    }
  };

  // Filtered scenes
  const filteredScenes = useMemo(() => {
    if (filterMode === "ready") return scenesData.filter(s => s.coupling_status === "ready");
    if (filterMode === "incomplete") return scenesData.filter(s => s.coupling_status !== "ready");
    return scenesData;
  }, [scenesData, filterMode]);

  // Format time as MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  };

  // Ruler tick interval calculation (Prevents overlapping text on time ruler)
  const rulerTickInterval = useMemo(() => {
    if (zoomPxPerSec <= 25) return 10;
    if (zoomPxPerSec <= 45) return 5;
    if (zoomPxPerSec <= 70) return 2;
    return 1;
  }, [zoomPxPerSec]);

  return (
    <div className="flex flex-col gap-3 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-[1880px] mx-auto select-none">
      
      {animationScene && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAnimationSceneId(null)}
          onKeyDown={(event) => { if (event.key === "Escape") setAnimationSceneId(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="animation-dialog-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4 select-text"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="animation-dialog-title" className="text-sm font-semibold">Animate Scene #{animationScene.scene_number}</h2>
              <button type="button" aria-label="Close animation dialog" onClick={() => setAnimationSceneId(null)} className="p-1 rounded hover:bg-foreground/10"><X size={16} /></button>
            </div>
            {animationScene.image_exists && (
              <img src={getAssetUrl(animationScene.image_path, animationScene.image_mtime)} alt={`Scene ${animationScene.scene_number} starting frame`} className="w-full max-h-48 object-contain rounded-lg bg-black/20" />
            )}
            <p className="text-xs text-panel-text">Animation follows the measured voiceover: <strong>{animationScene.duration.toFixed(2)} seconds</strong>.</p>
            <label className="block text-xs font-medium space-y-1">
              <span>Animation method</span>
              <select value={animationProvider} onChange={(event) => { setAnimationProvider(event.target.value as "camera" | "flow"); setAnimationError(null); }} disabled={animationBusy || isSubmittingAnimation} className="w-full rounded-lg border border-border bg-background p-2 text-xs">
                <option value="camera">Pan &amp; Zoom — Local</option>
                <option value="flow">Image animation — Google Flow</option>
              </select>
            </label>
            {animationProvider === "camera" && <label className="block text-xs font-medium space-y-1"><span>Camera motion</span><select value={cameraMotion} onChange={(event) => setCameraMotion(event.target.value)} className="w-full rounded-lg border border-border bg-background p-2 text-xs"><option value="auto">Auto</option><option value="zoom_in">Zoom In</option><option value="zoom_out">Zoom Out</option><option value="pan_left">Pan Left</option><option value="pan_right">Pan Right</option></select></label>}
            {animationProvider === "flow" && <>
            <label className="block text-xs font-medium space-y-1">
              <span>Motion prompt</span>
              <textarea
                autoFocus
                value={animationPrompt}
                onChange={(event) => setAnimationPrompt(event.target.value)}
                disabled={animationBusy || isSubmittingAnimation}
                maxLength={4000}
                rows={4}
                className="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary disabled:opacity-50"
              />
            </label>
            <label className="block text-xs font-medium space-y-1">
              <span>Flow video model</span>
              <select value={animationModel} onChange={(event) => setAnimationModel(event.target.value)} disabled={animationBusy || isSubmittingAnimation} className="w-full rounded-lg border border-border bg-background p-2 text-xs disabled:opacity-50">
                <option value="veo-lite">Veo Lite</option>
                <option value="veo-fast">Veo Fast</option>
                <option value="veo-quality">Veo Quality</option>
                <option value="veo-lite-lp">Veo Lite LP</option>
                <option value="omni-flash">Omni Flash</option>
                <option value="omni-1.2-flash">Omni 1.2 Flash</option>
                <option value="omni-1.2">Omni 1.2</option>
              </select>
            </label>
            <p className="text-[11px] text-panel-text">Flow animates the starting image and may use credits. The result is fitted to the measured voiceover duration. Image-to-video availability depends on your Flow interface.</p>
            </>}
            {!animationAspectSupported && <p role="alert" className="text-xs text-amber-500">Flow animation requires a 16:9 or 9:16 project.</p>}
            {!animationScene.image_exists && <p role="alert" className="text-xs text-amber-500">Generate or upload a scene image first.</p>}
            {(!animationScene.audio_exists || animationScene.audio_status !== "completed") && <p role="alert" className="text-xs text-amber-500">Generate an up-to-date voiceover before animating.</p>}
            {(animationError || (animationProvider === "flow" && animationScene.video_error)) && <p role="alert" className="text-xs text-red-500 whitespace-pre-wrap break-words">{animationError || animationScene.video_error}</p>}
            {animationBusy && <p role="status" className="text-xs text-primary flex items-center gap-2"><Loader2 size={13} className="animate-spin" />{animationScene.video_status === "queued" ? "Queued for animation…" : "Generating animation in Flow…"} You can close this window.</p>}
            {animationScene.video_status === "completed" && <p role="status" className="text-xs text-emerald-500">Animation ready. Select this scene to preview it in the monitor.</p>}
            {animationScene.animation?.has_video && <p className="text-[11px] text-panel-text">A successful generation replaces the current scene clip.</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAnimationSceneId(null)} className="px-3 py-2 rounded-lg border border-border text-xs">Close</button>
              <button type="button" onClick={handleGenerateAnimation} disabled={animationBusy || isSubmittingAnimation || (animationProvider === "flow" && !animationPrompt.trim()) || !animationAspectSupported || !animationHasInput} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50 flex items-center gap-2">
                {isSubmittingAnimation ? <Loader2 size={12} className="animate-spin" /> : <Clapperboard size={12} />}
                {animationProvider === "camera" ? "Create Pan & Zoom" : animationScene.animation?.has_video ? "Regenerate with Flow" : "Generate with Flow"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Audio Elements */}
      <audio ref={voiceAudioRef} preload="auto" />
      <audio 
        ref={bgmAudioRef} 
        src={timeline.bgm?.relative_path ? getAssetUrl(timeline.bgm.relative_path) : undefined} 
        preload="auto" 
      />
      <audio ref={singleAuditionAudioRef} preload="auto" />

      {/* RENDER PROGRESS BANNER (When rendering) */}
      {renderJob.status === "rendering" && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <Loader2 size={13} className="animate-spin" />
            <span>Assembling frames, dialogue voice tracks, BGM, and burned subtitles into {aspectRatio} MP4...</span>
          </div>
          <span className="text-xs font-mono font-bold text-primary">{renderJob.progress}%</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3-COLUMN STUDIO TOP ROW                                        */}
      {/* Col 1: Voice Lines (~380px) | Col 2: Video Monitor (Flex-1)    */}
      {/* Col 3: Compact Mastering Panel (~250px, no boxes-in-boxes!)    */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row gap-3.5 items-start">
        
        {/* ======================================================== */}
        {/* COLUMN 1: Scene Voice Lines Deck (Expanded Back ~380px)   */}
        {/* ======================================================== */}
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-2 bg-card border border-border rounded-xl p-3.5 shadow-sm h-[480px]">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Voice Lines</h3>
                <button
                  onClick={() => {
                    fetchAssemblyStatus(true);
                    if (refreshProjectData) refreshProjectData();
                  }}
                  disabled={isSyncing}
                  className="p-1 rounded hover:bg-muted text-foreground/60 hover:text-foreground transition-colors cursor-pointer"
                  title="Auto-sync and refresh audio lines"
                >
                  <RefreshCw size={11} className={isSyncing ? "animate-spin text-primary" : ""} />
                </button>
              </div>
              <p className="text-[10px] text-foreground/50">Audition & individual speech gain</p>
            </div>
            
            {/* Filter pills */}
            <div className="flex items-center bg-background border border-border rounded-lg p-0.5 text-[10px]">
              <button
                onClick={() => setFilterMode("all")}
                className={`px-2 py-0.5 rounded transition-colors ${filterMode === "all" ? "bg-primary text-primary-foreground font-semibold" : "text-foreground/60 hover:text-foreground"}`}
              >
                All ({scenesData.length})
              </button>
              <button
                onClick={() => setFilterMode("ready")}
                className={`px-2 py-0.5 rounded transition-colors ${filterMode === "ready" ? "bg-emerald-500 text-white font-semibold" : "text-foreground/60 hover:text-foreground"}`}
              >
                Ready ({coupledCount})
              </button>
              <button
                onClick={() => setFilterMode("incomplete")}
                className={`px-2 py-0.5 rounded transition-colors ${filterMode === "incomplete" ? "bg-amber-500 text-white font-semibold" : "text-foreground/60 hover:text-foreground"}`}
              >
                Missing ({scenesData.length - coupledCount})
              </button>
            </div>
          </div>

          {/* Scrollable Scenes List */}
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {filteredScenes.length === 0 ? (
              <div className="p-8 border border-dashed border-border rounded-xl text-center text-xs text-foreground/40">
                No scenes found matching the filter.
              </div>
            ) : (
              filteredScenes.map((scene, idx) => {
                const isCoupled = scene.coupling_status === "ready";
                const isSelected = currentSceneAtPlayhead?.scene_number === scene.scene_number;
                const volumeVal = timeline.scene_volumes[String(scene.scene_number)] ?? 1.0;
                const isAuditioning = auditioningSceneId === scene.id;

                const isBeingDragged = draggedSceneIdx === idx;
                const isDropTarget = dragOverSceneIdx === idx;

                return (
                  <div
                    key={scene.id}
                    draggable={dragHandleActiveIdx === idx}
                    onDragStart={(e) => handleSceneDragStart(e, idx)}
                    onDragOver={(e) => handleSceneDragOver(e, idx)}
                    onDrop={(e) => handleSceneDrop(e, idx)}
                    onDragEnd={handleSceneDragEnd}
                    onClick={() => handleSeek(sceneTimelineMap.find(s => s.scene_number === scene.scene_number)?.timeline_start || 0)}
                    className={`bg-background border rounded-lg p-2.5 transition-all cursor-pointer relative select-none ${
                      isBeingDragged ? "opacity-30 scale-[0.98] border-dashed border-primary" : ""
                    } ${
                      isDropTarget && dropPosition === "before" ? "border-t-2 border-t-primary" : ""
                    } ${
                      isDropTarget && dropPosition === "after" ? "border-b-2 border-b-primary" : ""
                    } ${
                      isSelected 
                        ? "border-primary ring-1 ring-primary/40 shadow-sm" 
                        : "border-border hover:border-border/80"
                    }`}
                  >
                    <div className="flex gap-2.5">
                      {/* Mini Thumbnail */}
                      <div className="w-14 h-18 bg-black/40 rounded overflow-hidden shrink-0 relative flex items-center justify-center border border-border/50">
                        {scene.image_exists && scene.image_path ? (
                          <img
                            src={getAssetUrl(scene.image_path)}
                            alt={`Scene ${scene.scene_number}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-foreground/30 text-center">
                            <ImageIcon size={14} />
                          </div>
                        )}
                        <div className="absolute top-0.5 left-0.5 bg-black/75 text-white text-[8px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5">
                          <span 
                            className="cursor-grab active:cursor-grabbing text-white/70 hover:text-white transition-colors" 
                            title="Drag to reorder sequence"
                            onMouseEnter={() => setDragHandleActiveIdx(idx)}
                            onMouseLeave={() => {
                              if (draggedSceneIdx === null) setDragHandleActiveIdx(null);
                            }}
                            onMouseDown={() => setDragHandleActiveIdx(idx)}
                            onTouchStart={() => setDragHandleActiveIdx(idx)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical size={9} />
                          </span>
                          <span>#{String(scene.scene_number).padStart(2, "0")}</span>
                        </div>
                      </div>

                      {/* Content & Gain */}
                      <div className="flex flex-col justify-between flex-1 min-w-0">
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                isCoupled 
                                  ? "bg-emerald-500/15 text-emerald-500" 
                                  : "bg-amber-500/15 text-amber-500"
                              }`}>
                                {isCoupled ? `${scene.duration.toFixed(1)}s` : "Missing"}
                              </span>

                              {/* Per-scene Motion Selector & Video indicator */}
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {scene.animation?.has_video ? (
                                  <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-1.5 py-0.2 rounded text-[9px] font-semibold">
                                    <Video size={9} />
                                    <span>Clip</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSceneVideo(scene)}
                                      disabled={scene.video_status === "queued" || scene.video_status === "processing"}
                                      title="Remove video clip and revert to image/motion"
                                      className="hover:text-rose-500 transition-colors ml-0.5 cursor-pointer"
                                    >
                                      <X size={8} />
                                    </button>
                                  </div>
                                ) : (
                                  <select
                                    value={timeline.scene_motions?.[String(scene.scene_number)] || "auto"}
                                    onChange={(e) => handleSceneMotionChange(scene.scene_number, e.target.value as any)}
                                    className="bg-background border border-border/60 rounded px-1 py-0.2 text-[9px] text-foreground font-medium outline-none cursor-pointer"
                                    title="Scene Camera Motion"
                                  >
                                    <option value="auto">✨ Auto</option>
                                    <option value="zoom_in">🔍 Zoom In</option>
                                    <option value="zoom_out">🔭 Zoom Out</option>
                                    <option value="pan_left">⬅️ Pan L</option>
                                    <option value="pan_right">➡️ Pan R</option>
                                    <option value="none">⏹️ Still</option>
                                  </select>
                                )}

                                <button
                                  type="button"
                                  onClick={() => openAnimationDialog(scene)}
                                  title="Animate this scene image to match its voiceover"
                                  className="px-1 py-0.5 rounded border border-primary/25 text-primary hover:bg-primary/10 text-[9px] flex items-center gap-1"
                                >
                                  {scene.video_status === "queued" || scene.video_status === "processing" ? <Loader2 size={10} className="animate-spin" /> : <Clapperboard size={10} />}
                                  {scene.video_status === "failed" ? "Retry animation" : "Animate"}
                                </button>

                                {/* Upload Video Clip directly onto scene */}
                                <label
                                  className="p-0.5 rounded hover:bg-foreground/5 text-foreground/50 hover:text-foreground cursor-pointer transition-colors"
                                  title="Upload MP4 video clip for this scene"
                                >
                                  <Upload size={9} />
                                  <input
                                    type="file"
                                    accept="video/mp4,video/webm,video/quicktime"
                                    disabled={scene.video_status === "queued" || scene.video_status === "processing"}
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleUploadSceneVideo(scene, f);
                                    }}
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Audition Button */}
                            {scene.audio_exists && (
                              <button
                                onClick={(e) => handleAuditionSingleScene(scene, e)}
                                title={isAuditioning ? "Pause voice line" : "Audition voice line isolated"}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                                  isAuditioning 
                                    ? "bg-primary text-primary-foreground animate-pulse" 
                                    : "bg-foreground/5 hover:bg-foreground/10 text-foreground/70"
                                }`}
                              >
                                {isAuditioning ? <Pause size={9} /> : <Play size={9} />}
                                <span>{isAuditioning ? "Stop" : "Audition"}</span>
                              </button>
                            )}
                          </div>

                          <p className="text-xs text-foreground/90 font-medium line-clamp-2 leading-tight">
                            {scene.narration_khmer || scene.image_prompt_english || "No line"}
                          </p>
                        </div>

                        {/* Individual Scene Voice Volume */}
                        <div className="flex items-center justify-between gap-2 mt-1 pt-1 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 flex-1">
                            <Volume2 size={11} className="text-foreground/40 shrink-0" />
                            <input
                              type="range"
                              min="0"
                              max="1.5"
                              step="0.05"
                              value={volumeVal}
                              onChange={(e) => handleSceneVolumeChange(scene.scene_number, parseFloat(e.target.value))}
                              className="w-full h-1 bg-border rounded appearance-none cursor-pointer accent-primary"
                              title={`Voice Volume: ${Math.round(volumeVal * 100)}%`}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-foreground/50 w-8 text-right">
                            {Math.round(volumeVal * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: Video Viewport + TEXT SETTINGS BELOW VIDEO     */}
        {/* ======================================================== */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-[480px]">
          
          {/* Viewport Frame */}
          <div 
            ref={videoViewportRef}
            className="w-full min-h-[300px] bg-black rounded-xl border border-border relative flex items-center justify-center overflow-hidden flex-1 shadow-inner select-none"
          >
            {currentSceneAtPlayhead?.animation?.has_video && currentSceneAtPlayhead.animation.video_path ? (
              <video
                src={getAssetUrl(currentSceneAtPlayhead.animation.video_path)}
                className="w-full h-full object-contain pointer-events-none"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : currentSceneAtPlayhead?.image_exists && currentSceneAtPlayhead.image_path ? (
              <img
                src={getAssetUrl(currentSceneAtPlayhead.image_path)}
                alt="Active Frame"
                className={`w-full h-full object-contain pointer-events-none transition-transform duration-700 ${
                  isPlaying && timeline.animation_mode === "camera" ? "scale-105" : "scale-100"
                }`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-foreground/30 p-8 text-center pointer-events-none">
                <ImageIcon size={34} className="mb-2 opacity-40" />
                <p className="text-xs font-semibold">Frame not yet rendered for Scene #{currentSceneAtPlayhead?.scene_number}</p>
                <p className="text-[10px] text-foreground/40 mt-0.5">Render image in Images Tab</p>
              </div>
            )}

            {/* FREEFORM DRAGGABLE TEXT OVERLAY ON SCREEN */}
            {activeOverlayAtPlayhead && (
              <div
                onPointerDown={handleCanvasTextPointerDown}
                onPointerMove={handleCanvasTextPointerMove}
                onPointerUp={handleCanvasTextPointerUp}
                style={{
                  position: "absolute",
                  left: `${activeOverlayAtPlayhead.x_percent}%`,
                  top: `${activeOverlayAtPlayhead.y_percent}%`,
                  transform: "translate(-50%, -50%)",
                  fontFamily: activeOverlayAtPlayhead.font_family,
                  fontSize: `${activeOverlayAtPlayhead.font_size}px`,
                  color: activeOverlayAtPlayhead.color,
                  backgroundColor: activeOverlayAtPlayhead.bg_color,
                }}
                className={`px-3 py-1 rounded text-center font-semibold shadow-lg max-w-[85%] leading-snug break-words cursor-move group transition-shadow ${
                  selectedTextId === activeOverlayAtPlayhead.id 
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-black/50 shadow-2xl" 
                    : "hover:ring-1 hover:ring-white/50"
                }`}
                title="Click and drag anywhere on the screen to position freely!"
              >
                <span>{activeOverlayAtPlayhead.text}</span>
                
                {/* Drag Indicator Badge */}
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-sm text-white text-[8px] font-mono px-1 py-0.2 rounded border border-white/20 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pointer-events-none transition-opacity whitespace-nowrap">
                  <Move size={8} /> Drag to position
                </span>
              </div>
            )}

            {/* Top Right Scene & Time Badge */}
            <div className="absolute top-2.5 right-2.5 bg-black/80 backdrop-blur-sm text-white font-mono text-[11px] px-2 py-0.5 rounded border border-white/10 shadow flex items-center gap-2">
              <span className="text-primary font-bold">#{currentSceneAtPlayhead?.scene_number || 1}</span>
              <span className="text-white/40">|</span>
              <span>{formatTime(currentTime)} / {formatTime(maxTimelineDuration)}</span>
            </div>

            <SubtitlePreview
              text={currentSceneAtPlayhead?.narration_khmer || ""}
              aspectRatio={aspectRatio}
              progress={currentSceneAtPlayhead ? Math.min(0.999, Math.max(0, (currentTime - currentSceneAtPlayhead.timeline_start) / (currentSceneAtPlayhead.effective_dur || 3))) : 0}
              value={timeline}
            />
          </div>
          <SubtitleControls value={timeline} onChange={patch => saveTimelineState({ ...timelineRef.current, ...patch })} />

          {/* TEXT SETTINGS TOOLBAR DIRECTLY BELOW VIDEO (RESTORED AS REQUESTED!) */}
          {selectedTextItem ? (
            <div className="bg-card border border-border rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs shadow-sm">
              {/* Text Input */}
              <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                <Type size={13} className="text-primary shrink-0" />
                <input
                  type="text"
                  value={selectedTextItem.text}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { text: e.target.value })}
                  placeholder="Type subtitle or title text..."
                  className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:border-primary font-medium"
                />
              </div>

              {/* Font Family */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-foreground/50 font-semibold uppercase">Font:</span>
                <select
                  value={selectedTextItem.font_family}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { font_family: e.target.value })}
                  className="bg-background border border-border rounded px-1.5 py-1 text-[10px] text-foreground outline-none"
                >
                  {FONT_OPTIONS.map(f => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>

              {/* Font Size */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-foreground/50 font-semibold uppercase">Size:</span>
                <input
                  type="range"
                  min="18"
                  max="64"
                  value={selectedTextItem.font_size}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { font_size: parseInt(e.target.value) })}
                  className="w-14 h-1 bg-border rounded appearance-none cursor-pointer accent-primary"
                />
                <span className="text-[10px] font-mono text-foreground/60 w-6">{selectedTextItem.font_size}</span>
              </div>

              {/* Text Color Chips */}
              <div className="flex items-center gap-1">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => handleUpdateText(selectedTextItem.id, { color: c.value })}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                    className={`w-3.5 h-3.5 rounded-full border ${selectedTextItem.color === c.value ? "border-primary ring-2 ring-primary/40" : "border-border/60"}`}
                  />
                ))}
              </div>

              {/* Background pill selector */}
              <div className="flex items-center gap-1">
                <select
                  value={selectedTextItem.bg_color}
                  onChange={(e) => handleUpdateText(selectedTextItem.id, { bg_color: e.target.value })}
                  className="bg-background border border-border rounded px-1.5 py-1 text-[10px] text-foreground outline-none"
                >
                  {BG_PRESETS.map(b => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </div>

              {/* Quick Snap Alignment Chips */}
              <div className="flex items-center gap-1 bg-background border border-border rounded p-0.5 text-[10px]">
                <button
                  onClick={() => handleUpdateText(selectedTextItem.id, { x_percent: 50, y_percent: 15 })}
                  className="px-1.5 py-0.5 rounded hover:bg-foreground/5 text-foreground/70"
                >
                  Top
                </button>
                <button
                  onClick={() => handleUpdateText(selectedTextItem.id, { x_percent: 50, y_percent: 50 })}
                  className="px-1.5 py-0.5 rounded hover:bg-foreground/5 text-foreground/70"
                >
                  Center
                </button>
                <button
                  onClick={() => handleUpdateText(selectedTextItem.id, { x_percent: 50, y_percent: 85 })}
                  className="px-1.5 py-0.5 rounded hover:bg-foreground/5 text-foreground/70"
                >
                  Bottom
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-card/60 border border-dashed border-border rounded-xl px-3 py-2 text-xs text-foreground/40 flex items-center justify-between">
              <span>Click text on screen or in the timeline to customize font, color, and drag position.</span>
              <button
                onClick={handleAddText}
                className="flex items-center gap-1 text-primary hover:underline font-semibold"
              >
                <Plus size={11} />
                <span>Add Caption</span>
              </button>
            </div>
          )}

        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: Compact Mastering Panel (~250px, NO BOXES!)    */}
        {/* ======================================================== */}
        <div className="w-full lg:w-[250px] shrink-0 bg-card border border-border rounded-xl p-3.5 shadow-sm flex flex-col justify-between h-[480px]">
          <div className="flex flex-col gap-3">
            {/* Project Title & Aspect Ratio */}
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <div className="flex items-center gap-1.5 min-w-0">
                <Film size={14} className="text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground truncate">{activeProject.title || "Assembly"}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono font-medium shrink-0">
                {aspectRatio}
              </span>
            </div>

            {/* Coupling Stats */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-foreground/60">Coupled Scenes:</span>
                <span className="font-bold text-foreground">
                  {coupledCount} / {scenesData.length}
                </span>
              </div>
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${scenesData.length ? (coupledCount / scenesData.length) * 100 : 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-foreground/40 font-mono mt-0.5">
                <span>{scenesData.length ? Math.round((coupledCount / scenesData.length) * 100) : 0}% Ready</span>
                <span>{formatTime(totalDuration)}</span>
              </div>
            </div>

            {/* Scene Animation & Motion Selector */}
            <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-background/60 border border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground">
                  <Clapperboard size={11} className="text-primary" />
                  <span>Scene Motion</span>
                </div>
                <span className="text-[9px] uppercase font-bold text-primary px-1 py-0.2 rounded bg-primary/10">
                  {timeline.animation_mode === "camera" ? "Pan & Zoom" : timeline.animation_mode === "ai_video" ? "AI Video" : "Static"}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800/90 rounded-md border border-border/50 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleAnimationModeChange("camera")}
                  className={`py-1 rounded text-center font-medium transition-all cursor-pointer ${
                    timeline.animation_mode === "camera"
                      ? "bg-card text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Smooth cinematic Ken Burns camera zooms & pans"
                >
                  🎥 Camera
                </button>
                <button
                  type="button"
                  onClick={() => handleAnimationModeChange("ai_video")}
                  className={`py-1 rounded text-center font-medium transition-all cursor-pointer ${
                    timeline.animation_mode === "ai_video"
                      ? "bg-card text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Generative AI video clips per scene"
                >
                  🤖 Video
                </button>
                <button
                  type="button"
                  onClick={() => handleAnimationModeChange("none")}
                  className={`py-1 rounded text-center font-medium transition-all cursor-pointer ${
                    timeline.animation_mode === "none"
                      ? "bg-card text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Still slides with zero camera movement"
                >
                  ⏹️ Still
                </button>
              </div>

              <p className="text-[9.5px] text-foreground/50 leading-tight">
                {timeline.animation_mode === "camera"
                  ? "Ken Burns zooms & pans matching speech."
                  : timeline.animation_mode === "ai_video"
                  ? "Use Animate on a scene to generate a Flow video, or upload a clip."
                  : "Standard still slides held for audio duration."}
              </p>
            </div>

            {/* Export MP4 Button */}
            <button
              onClick={handleTriggerRender}
              disabled={coupledCount === 0 || renderJob.status === "rendering" || scenesData.some((scene) => scene.video_status === "queued" || scene.video_status === "processing")}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {renderJob.status === "rendering" ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Exporting {renderJob.progress}%...</span>
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  <span>Export MP4</span>
                </>
              )}
            </button>

            {/* Rendered Video Download & Delete Card (Compact, Dismissable) */}
            {hasFinalVideo && !isDismissedRenderBanner && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-emerald-500 font-semibold">
                    <CheckCircle2 size={12} />
                    <span>Video Ready</span>
                  </div>
                  <button
                    onClick={() => setIsDismissedRenderBanner(true)}
                    title="Dismiss notice"
                    className="text-foreground/40 hover:text-foreground transition-colors p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <a
                    href={getAssetUrl(`${slug}/final_output.mp4`, finalVideoVersion || undefined)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download="final_output.mp4"
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-semibold transition-colors shadow-sm"
                  >
                    <Download size={11} />
                    <span>Download MP4</span>
                  </a>
                  <button
                    onClick={handleDeleteRenderedVideo}
                    title="Delete rendered video from disk"
                    className="px-2 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[11px] font-semibold transition-colors border border-rose-500/20"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pt-1 border-t border-emerald-500/15">
                  <a
                    href={`http://localhost:8000/api/projects/${activeProject.id}/subtitles`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`${slug}_subtitles.srt`}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-secondary/80 hover:bg-secondary text-foreground text-[10px] font-medium transition-colors border border-border/40"
                    title="Download Khmer Subtitles (.srt)"
                  >
                    <FileText size={10} className="text-primary" />
                    <span>Subtitles (.srt)</span>
                  </a>
                  <a
                    href={`http://localhost:8000/api/projects/${activeProject.id}/lesson-handout`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`${slug}_study_guide.md`}
                    className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-secondary/80 hover:bg-secondary text-foreground text-[10px] font-medium transition-colors border border-border/40"
                    title="Download Educational Lesson Study Guide (.md)"
                  >
                    <FileText size={10} className="text-amber-500" />
                    <span>Study Guide</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Clean Disk Folder Path in Footer */}
          <div className="text-[10px] text-foreground/40 font-mono flex items-center gap-1 border-t border-border/30 pt-2">
            <FolderCheck size={11} className="text-primary/70 shrink-0" />
            <span className="truncate">~/{slug}/</span>
          </div>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* CAPCUT-STYLE FULL-WIDTH HORIZONTAL TIMELINE                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col mt-0.5">
        
        {/* Timeline Transport Toolbar */}
        <div className="bg-card border-b border-border px-4 py-2 flex items-center justify-between gap-4">
          
          {/* Transport Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              disabled={maxTimelineDuration === 0}
              className="w-8 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-colors shadow-sm disabled:opacity-40"
              title="Play / Pause (Spacebar)"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
            </button>

            <button
              onClick={() => handleSeek(0)}
              className="w-7 h-7 rounded-lg border border-border hover:bg-foreground/5 flex items-center justify-center text-foreground/70 transition-colors"
              title="Rewind to Start"
            >
              <RotateCcw size={12} />
            </button>

            <div className="text-xs font-mono font-bold text-foreground ml-2">
              <span>{formatTime(currentTime)}</span>
              <span className="text-foreground/40 font-normal"> / {formatTime(maxTimelineDuration)}</span>
            </div>
          </div>

          {/* Edit Tools (Split, Duplicate, Delete, Add) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSplitAtPlayhead}
              disabled={!selectedTextId && !selectedBgmId}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Split selected clip at playhead"
            >
              <Scissors size={12} />
              <span>Split</span>
            </button>

            <button
              onClick={handleDuplicateSelected}
              disabled={!selectedTextId && !selectedBgmId && timeline.bgm_clips.length === 0}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Duplicate selected clip"
            >
              <Copy size={12} />
              <span>Duplicate</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={!selectedTextId && !selectedBgmId}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[11px] font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Delete selected clip"
            >
              <Trash2 size={12} />
              <span>Delete</span>
            </button>

            <div className="h-4 w-px bg-border mx-1" />

            <button
              onClick={handleAddText}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors border border-border"
            >
              <Type size={12} className="text-purple-400" />
              <span>+ Text</span>
            </button>

            <div className="relative">
              <button
                onClick={() => {
                  if (!isBgmGenOpen && !bgmPrompt) setBgmGenDuration(Math.min(120, Math.max(10, Math.round(totalDuration || 30))));
                  setIsBgmGenOpen(o => !o);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors border border-border"
                title="Generate background music with AI"
              >
                <Music size={12} className="text-amber-400" />
                <span>{isGeneratingBgm ? "Generating..." : "✨ Generate"}</span>
              </button>
              {isBgmGenOpen && (
                <div className="absolute top-full mt-2 left-0 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl p-3 space-y-2">
                  <div className="text-[10px] font-semibold text-panel-text uppercase tracking-wider">AI Background Music</div>
                  <textarea
                    value={bgmPrompt}
                    onChange={(e) => setBgmPrompt(e.target.value)}
                    disabled={isGeneratingBgm}
                    rows={3}
                    placeholder="e.g. calm cinematic ambient with soft piano"
                    className="w-full text-[11px] bg-background border border-border rounded-lg px-2 py-1.5 outline-none focus:border-primary resize-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {["Calm ambient piano", "Upbeat explainer", "Dramatic orchestral", "Lo-fi chill beat", "Mysterious documentary"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        disabled={isGeneratingBgm}
                        onClick={() => setBgmPrompt(preset)}
                        className="px-1.5 py-0.5 rounded-md bg-foreground/5 hover:bg-foreground/10 border border-border text-[10px] text-foreground/80"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center justify-between text-[11px] text-foreground/80">
                    <span>Length: {bgmGenDuration}s</span>
                    <input
                      type="range"
                      min="10"
                      max="120"
                      step="5"
                      value={bgmGenDuration}
                      disabled={isGeneratingBgm}
                      onChange={(e) => setBgmGenDuration(parseInt(e.target.value))}
                      className="w-32 accent-primary"
                    />
                  </label>
                  {bgmGenError && <div className="text-[10px] text-red-400 break-words">{bgmGenError}</div>}
                  <button
                    onClick={handleGenerateBgm}
                    disabled={isGeneratingBgm || !bgmPrompt.trim()}
                    className="w-full py-1.5 rounded-lg bg-primary text-white text-[11px] font-semibold disabled:opacity-50"
                  >
                    {isGeneratingBgm ? "Generating… first run downloads the model" : "Generate & add to timeline"}
                  </button>
                </div>
              )}
            </div>

            <label className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-foreground/5 hover:bg-foreground/10 text-foreground/80 text-[11px] font-semibold transition-colors border border-border cursor-pointer">
              <Music size={12} className="text-cyan-400" />
              <span>{isUploadingBgm ? "..." : "+ Music"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleBgmUpload}
                className="hidden"
                disabled={isUploadingBgm}
              />
            </label>
          </div>

          {/* Timeline Zoom Slider */}
          <div className="flex items-center gap-2">
            <ZoomOut size={12} className="text-foreground/40" />
            <input
              type="range"
              min="15"
              max="70"
              value={zoomPxPerSec}
              onChange={(e) => setZoomPxPerSec(parseInt(e.target.value))}
              className="w-20 h-1 bg-border rounded appearance-none cursor-pointer accent-primary"
              title="Timeline Zoom"
            />
            <ZoomIn size={12} className="text-foreground/40" />
          </div>
        </div>

        {/* Tracks Area: Fixed Left Headers + Scrollable Right Lanes */}
        <div className="flex border-b border-border bg-background relative overflow-hidden min-h-[250px]">
          
          {/* Left Track Headers (112px fixed) */}
          <div className="w-28 shrink-0 bg-card border-r border-border flex flex-col z-20 shadow-sm text-xs font-semibold text-foreground/70">
            {/* Ruler header */}
            <div className="h-7 border-b border-border flex items-center px-3 text-[10px] text-foreground/40 uppercase tracking-wider font-mono">
              Time
            </div>

            {/* Video Track Header */}
            <div className="h-16 border-b border-border flex items-center px-3 gap-1.5">
              <Film size={13} className="text-blue-400" />
              <span className="text-[11px]">Video</span>
            </div>

            {/* Voice Track Header */}
            <div className="h-12 border-b border-border flex items-center justify-between px-3 relative">
              <div className="flex items-center gap-1.5">
                <FileAudio size={13} className="text-amber-400" />
                <span className="text-[11px]">Voice</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVoiceVolOpen(!isVoiceVolOpen);
                  setIsBgmVolOpen(false);
                }}
                className="text-[9px] font-mono text-amber-300 hover:text-amber-200 bg-amber-400/10 hover:bg-amber-400/20 px-1 py-0.5 rounded cursor-pointer transition-colors"
                title="Click to adjust Voice Track Volume"
              >
                {Math.round((timeline.master_voice_volume ?? 1.0) * 100)}%
              </button>

              {isVoiceVolOpen && (
                <div
                  ref={voiceVolPopoverRef}
                  className="absolute left-full top-0 ml-1 z-50 bg-card border border-border rounded-xl shadow-2xl p-3 w-56 flex flex-col gap-2 animate-in fade-in zoom-in-95 backdrop-blur-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Volume2 size={13} className="text-amber-400" /> Voice Volume
                    </span>
                    <span className="font-mono font-bold text-amber-400">
                      {Math.round((timeline.master_voice_volume ?? 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.05"
                    value={timeline.master_voice_volume ?? 1.0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      saveTimelineState({
                        ...timeline,
                        master_voice_volume: val,
                      });
                    }}
                    className="w-full h-1.5 bg-border rounded appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-foreground/50 pt-1">
                    <button type="button" onClick={() => saveTimelineState({ ...timeline, master_voice_volume: 0.5 }, true)} className="hover:text-foreground cursor-pointer">50%</button>
                    <button type="button" onClick={() => saveTimelineState({ ...timeline, master_voice_volume: 1.0 }, true)} className="hover:text-foreground font-semibold cursor-pointer">100%</button>
                    <button type="button" onClick={() => saveTimelineState({ ...timeline, master_voice_volume: 1.5 }, true)} className="hover:text-foreground cursor-pointer">150%</button>
                  </div>
                </div>
              )}
            </div>

            {/* Text Track Header */}
            <div className="h-12 border-b border-border flex items-center px-3 gap-1.5">
              <Type size={13} className="text-purple-400" />
              <span className="text-[11px]">Text</span>
            </div>

            {/* Music Track Header with Inline Volume & Ducking */}
            <div className="h-14 flex items-center justify-between px-3 relative">
              <div className="flex items-center gap-1.5">
                <Music size={13} className="text-cyan-400" />
                <span className="text-[11px]">Music</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsBgmVolOpen(!isBgmVolOpen);
                  setIsVoiceVolOpen(false);
                }}
                className="text-[9px] font-mono text-cyan-300 hover:text-cyan-200 bg-cyan-400/10 hover:bg-cyan-400/20 px-1 py-0.5 rounded cursor-pointer transition-colors"
                title="Click to adjust Music Volume & Ducking"
              >
                {Math.round(timeline.master_bgm_volume * 100)}%
              </button>

              {isBgmVolOpen && (
                <div
                  ref={bgmVolPopoverRef}
                  className="absolute left-full top-0 ml-1 z-50 bg-card border border-border rounded-xl shadow-2xl p-3 w-56 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 backdrop-blur-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Volume2 size={13} className="text-cyan-400" /> Music Volume
                    </span>
                    <span className="font-mono font-bold text-cyan-400">
                      {Math.round(timeline.master_bgm_volume * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={timeline.master_bgm_volume}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      saveTimelineState({
                        ...timeline,
                        master_bgm_volume: val,
                      });
                    }}
                    className="w-full h-1.5 bg-border rounded appearance-none cursor-pointer accent-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => saveTimelineState({ ...timeline, ducking: !timeline.ducking }, true)}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-xs text-foreground transition-colors cursor-pointer"
                  >
                    <span>Auto-Ducking</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${timeline.ducking ? "bg-emerald-500/20 text-emerald-400" : "bg-foreground/10 text-foreground/50"}`}>
                      {timeline.ducking ? "On (-9dB)" : "Off"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Scrollable Lanes */}
          <div 
            ref={timelineLanesRef}
            className="flex-1 overflow-x-auto overflow-y-hidden relative bg-black/20"
            style={{ minWidth: 0 }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left + e.currentTarget.scrollLeft;
              const targetTime = clickX / zoomPxPerSec;
              handleSeek(targetTime);
            }}
          >
            {/* Sizing container strictly locked to maxTimelineDuration */}
            <div 
              style={{ width: `${Math.max(1000, maxTimelineDuration * zoomPxPerSec)}px` }}
              className="relative flex flex-col h-full"
            >
              
              {/* 1. Time Ruler Lane (Draggable Scrubber + Clean tick intervals) */}
              <div 
                className="h-7 border-b border-border/60 bg-card/60 relative cursor-pointer select-none font-mono text-[9px] text-foreground/40"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingPlayhead(true);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  updatePlayheadFromPointer(e.clientX);
                }}
                onPointerMove={(e) => {
                  if (!isDraggingPlayhead) return;
                  e.stopPropagation();
                  updatePlayheadFromPointer(e.clientX);
                }}
                onPointerUp={(e) => {
                  if (isDraggingPlayhead) {
                    setIsDraggingPlayhead(false);
                    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
                  }
                }}
              >
                {Array.from({ length: Math.ceil(maxTimelineDuration / rulerTickInterval) + 1 }).map((_, idx) => {
                  const sec = idx * rulerTickInterval;
                  if (sec > maxTimelineDuration) return null;
                  return (
                    <div
                      key={sec}
                      style={{ left: `${sec * zoomPxPerSec}px` }}
                      className="absolute top-0 bottom-0 flex flex-col justify-between border-l border-border/60 pl-1 pointer-events-none"
                    >
                      <span className="font-mono">{formatTime(sec)}</span>
                      <div className="h-1.5 w-px bg-border" />
                    </div>
                  );
                })}
              </div>

              {/* 2. Track 1: Video / Scenes Filmstrip (h-16) */}
              <div className="h-16 border-b border-border/40 relative flex items-center px-0 bg-card/20">
                {sceneTimelineMap.map((scene) => {
                  const blockWidth = scene.effective_dur * zoomPxPerSec;
                  const isSelected = currentSceneAtPlayhead?.scene_number === scene.scene_number;

                  return (
                    <div
                      key={scene.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeek(scene.timeline_start);
                      }}
                      style={{
                        position: "absolute",
                        left: `${scene.timeline_start * zoomPxPerSec}px`,
                        width: `${Math.max(20, blockWidth - 2)}px`,
                      }}
                      className={`h-13 rounded-md overflow-hidden border flex items-center transition-all cursor-pointer ${
                        isSelected 
                          ? "border-primary ring-1 ring-primary shadow-md bg-primary/20" 
                          : "border-blue-500/30 bg-blue-500/10 hover:border-blue-400"
                      }`}
                    >
                      {/* Mini thumbnail */}
                      {scene.image_exists && scene.image_path ? (
                        <img
                          src={getAssetUrl(scene.image_path)}
                          alt={`Scene ${scene.scene_number}`}
                          className="w-12 h-full object-cover shrink-0 pointer-events-none"
                        />
                      ) : (
                        <div className="w-10 h-full bg-black/40 flex items-center justify-center shrink-0 text-foreground/30">
                          <ImageIcon size={10} />
                        </div>
                      )}
                      
                      <div className="px-2 flex flex-col justify-center min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-foreground truncate">
                          #{String(scene.scene_number).padStart(2, "0")} ({scene.duration.toFixed(1)}s)
                        </span>
                        <span className="text-[9px] text-foreground/50 truncate font-mono">
                          {scene.coupling_status === "ready" ? "✓ Coupled" : "Missing"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. Track 2: Voiceover Narration Track (h-12) */}
              <div className="h-12 border-b border-border/40 relative flex items-center bg-card/10">
                {sceneTimelineMap.map((scene) => {
                  if (!scene.audio_exists) return null;
                  const blockWidth = scene.effective_dur * zoomPxPerSec;
                  const isSelected = currentSceneAtPlayhead?.scene_number === scene.scene_number;

                  return (
                    <div
                      key={`voice_${scene.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeek(scene.timeline_start);
                      }}
                      style={{
                        position: "absolute",
                        left: `${scene.timeline_start * zoomPxPerSec}px`,
                        width: `${Math.max(20, blockWidth - 2)}px`,
                      }}
                      className={`h-9 rounded border flex items-center px-2 gap-1.5 transition-all cursor-pointer ${
                        isSelected 
                          ? "border-amber-400 bg-amber-500/25 ring-1 ring-amber-400" 
                          : "border-amber-500/30 bg-amber-500/10 hover:border-amber-400"
                      }`}
                    >
                      <AudioLines size={12} className="text-amber-400 shrink-0" />
                      <span className="text-[9px] font-medium text-amber-200 truncate">
                        Line #{scene.scene_number} ({scene.duration.toFixed(1)}s)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 4. Track 3: Text / Subtitle Track (h-12) */}
              <div className="h-12 border-b border-border/40 relative flex items-center bg-card/20">
                {timeline.text_overlays.map((item) => {
                  const blockWidth = item.duration * zoomPxPerSec;
                  const isSelected = selectedTextId === item.id;

                  return (
                    <div
                      key={item.id}
                      onPointerDown={(e) => handleTimelineClipPointerDown(e, "text_move", item.id, item.start_time, item.duration)}
                      onPointerMove={handleTimelineClipPointerMove}
                      onPointerUp={handleTimelineClipPointerUp}
                      style={{
                        position: "absolute",
                        left: `${item.start_time * zoomPxPerSec}px`,
                        width: `${Math.max(20, blockWidth)}px`,
                      }}
                      className={`h-9 rounded-md border flex items-center justify-between px-1.5 transition-all cursor-move group select-none ${
                        isSelected 
                          ? "border-purple-400 bg-purple-600/40 ring-1 ring-purple-300 shadow-md" 
                          : "border-purple-500/40 bg-purple-600/20 hover:border-purple-400"
                      }`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleTimelineClipPointerDown(e, "text_trim_left", item.id, item.start_time, item.duration);
                        }}
                        onPointerMove={handleTimelineClipPointerMove}
                        onPointerUp={handleTimelineClipPointerUp}
                        className="w-2.5 h-full -ml-1.5 cursor-ew-resize opacity-40 hover:opacity-100 group-hover:opacity-80 bg-white/40 hover:bg-white rounded-l transition-opacity flex items-center justify-center z-10"
                        title="Drag to trim start"
                      >
                        <div className="w-0.5 h-3 bg-black/40 rounded" />
                      </div>

                      <div className="flex items-center gap-1 min-w-0 flex-1 px-1">
                        <Type size={11} className="text-purple-300 shrink-0" />
                        <span className="text-[10px] font-medium text-purple-100 truncate">
                          {item.text}
                        </span>
                        <span className="text-[9px] text-purple-200/60 font-mono">
                          {item.duration.toFixed(1)}s
                        </span>
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleTimelineClipPointerDown(e, "text_trim_right", item.id, item.start_time, item.duration);
                        }}
                        onPointerMove={handleTimelineClipPointerMove}
                        onPointerUp={handleTimelineClipPointerUp}
                        className="w-2.5 h-full -mr-1.5 cursor-ew-resize opacity-40 hover:opacity-100 group-hover:opacity-80 bg-white/40 hover:bg-white rounded-r transition-opacity flex items-center justify-center z-10"
                        title="Drag to trim duration"
                      >
                        <div className="w-0.5 h-3 bg-black/40 rounded" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 5. Track 4: Background Music Track (h-14) (Multi-Clip CapCut-style) */}
              <div className="h-14 relative flex items-center bg-card/10">
                {timeline.bgm_clips.map((clip) => {
                  const blockWidth = clip.duration * zoomPxPerSec;
                  const isSelected = selectedBgmId === clip.id;
                  return (
                    <div
                      key={clip.id}
                      onPointerDown={(e) => handleTimelineClipPointerDown(e, "bgm_move", clip.id, clip.start_time, clip.duration, clip.media_offset ?? 0)}
                      onPointerMove={handleTimelineClipPointerMove}
                      onPointerUp={handleTimelineClipPointerUp}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBgmId(clip.id);
                        setSelectedTextId(null);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedBgmId(clip.id);
                        setSelectedTextId(null);
                        const menuWidth = 260;
                        const menuHeight = 280;
                        const safeX = Math.max(12, Math.min(e.clientX, window.innerWidth - menuWidth - 12));
                        const safeY = (e.clientY + menuHeight > window.innerHeight - 12)
                          ? Math.max(12, e.clientY - menuHeight)
                          : Math.max(12, e.clientY);
                        setBgmContextMenu({ visible: true, x: safeX, y: safeY, clipId: clip.id });
                      }}
                      style={{
                        position: "absolute",
                        left: `${clip.start_time * zoomPxPerSec}px`,
                        width: `${Math.max(30, blockWidth)}px`,
                      }}
                      className={`h-10 rounded-md border flex items-center justify-between px-2 transition-all cursor-move group select-none ${
                        isSelected 
                          ? "border-cyan-400 bg-cyan-600/35 ring-1 ring-cyan-300 shadow-md" 
                          : "border-cyan-500/40 bg-cyan-600/20 hover:border-cyan-400"
                      }`}
                      title={`${clip.filename} (${clip.duration.toFixed(1)}s) - Click to select, right-click for menu`}
                    >
                      {/* Left Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleTimelineClipPointerDown(e, "bgm_trim_left", clip.id, clip.start_time, clip.duration, clip.media_offset ?? 0);
                        }}
                        onPointerMove={handleTimelineClipPointerMove}
                        onPointerUp={handleTimelineClipPointerUp}
                        className="w-2.5 h-full -ml-2 cursor-ew-resize opacity-40 hover:opacity-100 group-hover:opacity-80 bg-cyan-200/50 hover:bg-cyan-200 rounded-l transition-opacity flex items-center justify-center z-10"
                        title="Drag to trim music start"
                      >
                        <div className="w-0.5 h-3 bg-cyan-900/60 rounded" />
                      </div>

                      <div className="flex items-center gap-1.5 min-w-0 flex-1 px-1">
                        <Music size={12} className="text-cyan-300 shrink-0" />
                        <span className="text-[10px] font-semibold text-cyan-100 truncate">
                          {clip.filename}
                        </span>
                        <span className="text-[9px] text-cyan-300/80 font-mono">
                          {clip.duration.toFixed(1)}s
                        </span>
                        {clip.volume !== undefined && clip.volume !== 1.0 && (
                          <span className="text-[9px] text-cyan-300/60 font-mono">
                            vol:{Math.round(clip.volume * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Right Trim Handle */}
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          handleTimelineClipPointerDown(e, "bgm_trim_right", clip.id, clip.start_time, clip.duration, clip.media_offset ?? 0);
                        }}
                        onPointerMove={handleTimelineClipPointerMove}
                        onPointerUp={handleTimelineClipPointerUp}
                        className="w-2.5 h-full -mr-2 cursor-ew-resize opacity-40 hover:opacity-100 group-hover:opacity-80 bg-cyan-200/50 hover:bg-cyan-200 rounded-r transition-opacity flex items-center justify-center z-10"
                        title="Drag to trim music duration"
                      >
                        <div className="w-0.5 h-3 bg-cyan-900/60 rounded" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* VERTICAL RED PLAYHEAD SCRUBBER (Draggable Cursor) */}
              <div
                style={{ left: `${currentTime * zoomPxPerSec}px` }}
                className="absolute top-0 bottom-0 z-40 transition-none select-none"
                onPointerDown={handlePlayheadPointerDown}
                onPointerMove={handlePlayheadPointerMove}
                onPointerUp={handlePlayheadPointerUp}
              >
                {/* Visual line with glow */}
                <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] pointer-events-none" />

                {/* Wide invisible hit-box along entire vertical height for smooth grabbing */}
                <div 
                  className="absolute top-0 bottom-0 -left-2 w-4 cursor-ew-resize bg-transparent hover:bg-rose-500/10 active:bg-rose-500/20 transition-colors" 
                  title="Drag playhead cursor"
                />

                {/* Top Diamond Scrubber Head Handle */}
                <div 
                  className="w-4 h-4 bg-rose-500 -ml-[7px] -top-1 absolute rotate-45 rounded-xs shadow-md border border-rose-300 cursor-ew-resize hover:scale-125 transition-transform" 
                  title="Drag playhead cursor"
                />
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* FLOATING RIGHT-CLICK CONTEXT MENU FOR BACKGROUND MUSIC */}
      {bgmContextMenu && timeline.bgm_clips.length > 0 && (() => {
        const targetClip = timeline.bgm_clips.find(c => c.id === bgmContextMenu.clipId) || timeline.bgm_clips[0];
        if (!targetClip) return null;

        return (
          <div
            ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.bottom > window.innerHeight - 12) {
                  const adjustedTop = Math.max(12, window.innerHeight - rect.height - 12);
                  el.style.top = `${adjustedTop}px`;
                }
                if (rect.right > window.innerWidth - 12) {
                  const adjustedLeft = Math.max(12, window.innerWidth - rect.width - 12);
                  el.style.left = `${adjustedLeft}px`;
                }
              }
            }}
            style={{ top: `${bgmContextMenu.y}px`, left: `${bgmContextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
            className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl p-3 flex flex-col gap-2.5 w-64 max-h-[calc(100vh-24px)] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
              <span className="text-xs font-bold text-foreground truncate max-w-[140px]">{targetClip.filename}</span>
              <span className="text-[10px] text-cyan-400 font-mono">BGM Clip</span>
            </div>

            {/* Master Volume Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] text-foreground/70">
                <span className="flex items-center gap-1"><Volume2 size={12} /> Master Volume</span>
                <span className="font-mono font-bold text-foreground">{Math.round(timeline.master_bgm_volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={timeline.master_bgm_volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  saveTimelineState({
                    ...timeline,
                    master_bgm_volume: val,
                  });
                }}
                className="w-full h-1.5 bg-border rounded appearance-none cursor-pointer accent-primary"
              />
            </div>

            {/* Ducking Toggle */}
            <button
              onClick={() => saveTimelineState({ ...timeline, ducking: !timeline.ducking })}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-xs text-foreground transition-colors"
            >
              <span>Voice Auto-Ducking</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${timeline.ducking ? "bg-emerald-500/20 text-emerald-400" : "bg-foreground/10 text-foreground/50"}`}>
                {timeline.ducking ? "Enabled (-12dB)" : "Off"}
              </span>
            </button>

            {/* Split at Playhead */}
            <button
              onClick={() => {
                setSelectedBgmId(targetClip.id);
                handleSplitAtPlayhead();
                setBgmContextMenu(null);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-foreground/5 text-xs text-foreground/80 hover:text-foreground transition-colors"
            >
              <Scissors size={13} className="text-amber-400" />
              <span>Split at Playhead</span>
            </button>

            {/* Duplicate Clip */}
            <button
              onClick={() => {
                const currentTimeline = timelineRef.current;
                const clipToClone = currentTimeline.bgm_clips.find(c => c.id === bgmContextMenu.clipId) || targetClip;
                const newId = `bgm_${Date.now()}`;
                const clonedClip: BgmClip = {
                  ...clipToClone,
                  id: newId,
                  start_time: Math.round((clipToClone.start_time + clipToClone.duration) * 10) / 10,
                  duration: clipToClone.duration,
                  media_offset: clipToClone.media_offset ?? 0,
                  volume: clipToClone.volume ?? 1.0,
                };
                const updatedClips = [...currentTimeline.bgm_clips, clonedClip];
                saveTimelineState({
                  ...currentTimeline,
                  bgm_clips: updatedClips,
                  bgm: updatedClips[0] || null,
                });
                setSelectedBgmId(newId);
                setBgmContextMenu(null);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-foreground/5 text-xs text-foreground/80 hover:text-foreground transition-colors"
            >
              <Copy size={13} className="text-cyan-400" />
              <span>Duplicate Clip (Clone After)</span>
            </button>

            {/* Delete Clip */}
            <button
              onClick={() => {
                const currentTimeline = timelineRef.current;
                const updated = currentTimeline.bgm_clips.filter(c => c.id !== targetClip.id);
                saveTimelineState({
                  ...currentTimeline,
                  bgm_clips: updated,
                  bgm: updated[0] || null,
                });
                if (selectedBgmId === targetClip.id) setSelectedBgmId(null);
                setBgmContextMenu(null);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-rose-500/10 text-xs text-rose-500 transition-colors border-t border-border/40 pt-2"
            >
              <Trash2 size={13} />
              <span>Delete Clip</span>
            </button>
          </div>
        );
      })()}

    </div>
  );
}
