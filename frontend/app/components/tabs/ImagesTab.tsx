/* eslint-disable */
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useProjectContext } from "../../context/ProjectContext";
import { 
  Image as ImageIcon, 
  Wand2, 
  Sparkles, 
  Trash2, 
  Loader2, 
  Check, 
  Maximize2, 
  X, 
  Upload, 
  Cpu, 
  Cloud, 
  Pin, 
  Plus, 
  Paperclip, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Volume2,
  Clock,
  GripVertical,
  Target,
  Crosshair,
  CheckSquare
} from "lucide-react";

interface ImagesTabProps {
  activeProject?: any;
  refreshProjectData?: any;
}

// Aspect ratio wireframe icon matching Google Flow UI
function AspectRatioGraphic({ ratio, className = "" }: { ratio: string; className?: string }) {
  switch (ratio) {
    case "16:9":
      return <div className={`w-[18px] h-[10px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "4:3":
      return <div className={`w-[15px] h-[11px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "1:1":
      return <div className={`w-[12px] h-[12px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "3:4":
      return <div className={`w-[11px] h-[15px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "9:16":
      return <div className={`w-[10px] h-[18px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    case "2:3":
      return <div className={`w-[11px] h-[15px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
    default:
      return <div className={`w-[14px] h-[10px] rounded-[1.5px] border border-current shrink-0 ${className}`} />;
  }
}

// Clean auto-resizing textarea with auto-save on blur
function AutoResizeTextarea({
  defaultValue,
  onBlur,
  className,
  placeholder,
  disabled = false,
}: {
  defaultValue: string;
  onBlur: (val: string) => void;
  className: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [val, setVal] = useState(defaultValue || "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVal(defaultValue || "");
  }, [defaultValue]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${Math.max(ref.current.scrollHeight, 24)}px`;
    }
  }, [val]);

  return (
    <textarea
      ref={ref}
      value={val}
      disabled={disabled}
      draggable={false}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val !== (defaultValue || "")) {
          onBlur(val);
        }
      }}
      placeholder={placeholder}
      className={`${className} overflow-hidden resize-none select-text cursor-text`}
      rows={1}
    />
  );
}

export default function ImagesTab(props: ImagesTabProps) {
  const { activeProject, updateSingleScene, refreshProjects, updateActiveProject, reorderScenes } = useProjectContext();
  
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [copilotInput, setCopilotInput] = useState("");
  const [isCopilotRunning, setIsCopilotRunning] = useState(false);
  const [copilotSummary, setCopilotSummary] = useState<string | null>(null);
  const copilotInputRef = useRef<HTMLTextAreaElement>(null);

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

    const newScenes = [...scenes];
    const [draggedItem] = newScenes.splice(draggedSceneIdx, 1);
    
    let insertIndex = targetIndex;
    if (dropPosition === "after" && draggedSceneIdx < targetIndex) {
      insertIndex = targetIndex;
    } else if (dropPosition === "before" && draggedSceneIdx > targetIndex) {
      insertIndex = targetIndex;
    } else if (dropPosition === "after" && draggedSceneIdx > targetIndex) {
      insertIndex = targetIndex + 1;
    } else if (dropPosition === "before" && draggedSceneIdx < targetIndex) {
      insertIndex = targetIndex - 1;
    }
    insertIndex = Math.max(0, Math.min(newScenes.length, insertIndex));
    newScenes.splice(insertIndex, 0, draggedItem);

    const newOrderedIds = newScenes.map((s: any) => s.id);

    // Follow the moved card
    setActiveSceneIndex(insertIndex);
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

  const [aspectRatioValue, setAspectRatioValue] = useState("16:9");
  const [inferenceSteps, setInferenceSteps] = useState(10);
  const [submittingSceneIds, setSubmittingSceneIds] = useState<number[]>([]);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isBatchSubmitting, setIsBatchSubmitting] = useState(false);
  const [isBatchSelectModalOpen, setIsBatchSelectModalOpen] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState<number[]>([]);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  
  // Engine & Model controls
  const [imageProvider, setImageProvider] = useState<"agy" | "local" | "cloud" | "flow">("agy");
  const [flowModel, setFlowModel] = useState<"nano2" | "nano-pro">("nano2");
  const [imageCount, setImageCount] = useState<number>(1);
  const [flowStatus, setFlowStatus] = useState<{ cli_available: boolean; daemon_running: boolean; authenticated: boolean } | null>(null);

  // Upload & Lightbox states
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const targetFileInputRef = useRef<HTMLInputElement>(null);

  // Target Image states (Base canvas to modify: null = No Target / New Image, string = specific frame)
  const [selectedTargetImage, setSelectedTargetImage] = useState<string | null | undefined>(undefined);
  const [isTargetMenuOpen, setIsTargetMenuOpen] = useState(false);
  const targetMenuRef = useRef<HTMLDivElement>(null);

  // Reference picker & dropdown states
  const [isAddRefMenuOpen, setIsAddRefMenuOpen] = useState(false);
  const [isScenePickerOpen, setIsScenePickerOpen] = useState(false);
  const [scenePickerMode, setScenePickerMode] = useState<"target" | "reference">("reference");
  const addRefMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addRefMenuRef.current && !addRefMenuRef.current.contains(e.target as Node)) {
        setIsAddRefMenuOpen(false);
      }
      if (targetMenuRef.current && !targetMenuRef.current.contains(e.target as Node)) {
        setIsTargetMenuOpen(false);
      }
    };
    if (isAddRefMenuOpen || isTargetMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAddRefMenuOpen, isTargetMenuOpen]);

  // Exclusions collapsible state
  const [isExclusionsExpanded, setIsExclusionsExpanded] = useState(false);

  // Active Reference Image for Copilot Adjustments
  const [selectedRefImage, setSelectedRefImage] = useState<string | null | undefined>(undefined);

  // Drag & drop highlight state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Reset selected target/reference & close menus when switching scenes
  useEffect(() => {
    setSelectedTargetImage(undefined);
    setSelectedRefImage(undefined);
    setIsAddRefMenuOpen(false);
    setIsTargetMenuOpen(false);
    setIsScenePickerOpen(false);
  }, [activeSceneIndex]);

  // Synchronize aspect ratio with active project
  useEffect(() => {
    if (activeProject?.aspect_ratio) {
      setAspectRatioValue(activeProject.aspect_ratio);
    }
  }, [activeProject?.aspect_ratio]);

  // Load engine settings and poll Flow daemon status
  useEffect(() => {
    fetch("http://localhost:8000/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data.image_provider) {
          setImageProvider(data.image_provider);
        }
      })
      .catch(console.error);

    const fetchFlowStatus = () => {
      fetch("http://localhost:8000/api/flow/status")
        .then(res => res.json())
        .then(data => setFlowStatus(data))
        .catch(console.error);
    };

    fetchFlowStatus();
    const statusInterval = setInterval(fetchFlowStatus, 5000);
    return () => clearInterval(statusInterval);
  }, []);

  const scenes = activeProject?.scenes || [];
  const activeScene = scenes[activeSceneIndex] || scenes[0] || null;

  // Auto-resize copilot input
  useEffect(() => {
    if (copilotInputRef.current) {
      copilotInputRef.current.style.height = "auto";
      copilotInputRef.current.style.height = `${Math.min(copilotInputRef.current.scrollHeight, 100)}px`;
    }
  }, [copilotInput]);

  // Derived variants list for active scene
  const imagesList: string[] = useMemo(() => {
    if (!activeScene?.images_list) {
      return activeScene?.image_path ? [activeScene.image_path] : [];
    }
    try {
      const parsed = typeof activeScene.images_list === "string" ? JSON.parse(activeScene.images_list) : activeScene.images_list;
      const arr = Array.isArray(parsed) ? parsed : [];
      if (activeScene.image_path && !arr.includes(activeScene.image_path)) {
        return [activeScene.image_path, ...arr];
      }
      return arr.length > 0 ? arr : (activeScene.image_path ? [activeScene.image_path] : []);
    } catch {
      return activeScene?.image_path ? [activeScene.image_path] : [];
    }
  }, [activeScene?.images_list, activeScene?.image_path]);

  // Derived reference images list
  const referenceImages: string[] = useMemo(() => {
    if (!activeScene?.reference_images) return [];
    try {
      const parsed = typeof activeScene.reference_images === "string" ? JSON.parse(activeScene.reference_images) : activeScene.reference_images;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [activeScene?.reference_images]);

  // Derived list of all scene frames and variants available to be picked as references
  const availableSceneRefs = useMemo(() => {
    const list: Array<{
      uniqueKey: string;
      sceneId: number;
      sceneNumber: number;
      imagePath: string;
      variantTag?: string;
      promptText?: string;
    }> = [];

    scenes.forEach((s: any) => {
      const sceneVariants: string[] = [];
      if (s.image_path) sceneVariants.push(s.image_path);
      if (s.images_list) {
        try {
          const parsed = typeof s.images_list === "string" ? JSON.parse(s.images_list) : s.images_list;
          if (Array.isArray(parsed)) {
            parsed.forEach((p: string) => {
              if (p && !sceneVariants.includes(p)) sceneVariants.push(p);
            });
          }
        } catch {}
      }

      sceneVariants.forEach((vPath: string, vIdx: number) => {
        list.push({
          uniqueKey: `${s.id}-${vPath}`,
          sceneId: s.id,
          sceneNumber: s.scene_number,
          imagePath: vPath,
          variantTag: sceneVariants.length > 1 ? `V${vIdx + 1}` : undefined,
          promptText: s.narration_khmer || s.image_prompt_english || "",
        });
      });
    });

    return list;
  }, [scenes]);

  // Scene status counts
  const generatedScenesCount = useMemo(() => {
    return scenes.filter((s: any) => !!s.image_path).length;
  }, [scenes]);

  const emptyScenesCount = useMemo(() => {
    return scenes.filter((s: any) => !s.image_path).length;
  }, [scenes]);

  const failedScenesCount = useMemo(() => {
    return scenes.filter((s: any) => s.image_status === "failed").length;
  }, [scenes]);

  // Selection handlers for batch generate modal
  const openBatchSelectModal = () => {
    const emptyOrFailed = scenes
      .filter((s: any) => !s.image_path || s.image_status === "failed")
      .map((s: any) => s.id);
    if (emptyOrFailed.length > 0) {
      setSelectedSceneIds(emptyOrFailed);
    } else {
      setSelectedSceneIds(scenes.map((s: any) => s.id));
    }
    setIsBatchSelectModalOpen(true);
  };

  const handleSelectEmptyOnly = () => {
    setSelectedSceneIds(scenes.filter((s: any) => !s.image_path).map((s: any) => s.id));
  };

  const handleSelectFailedOnly = () => {
    setSelectedSceneIds(scenes.filter((s: any) => s.image_status === "failed").map((s: any) => s.id));
  };

  const handleSelectReadyOnly = () => {
    setSelectedSceneIds(scenes.filter((s: any) => !!s.image_path).map((s: any) => s.id));
  };

  const handleSelectAll = () => {
    setSelectedSceneIds(scenes.map((s: any) => s.id));
  };

  const handleDeselectAll = () => {
    setSelectedSceneIds([]);
  };

  const toggleSceneSelection = (sceneId: number) => {
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]
    );
  };

  // Check if any scene is currently processing or queued
  const processingScenes = useMemo(() => {
    return scenes.filter((s: any) => s.image_status === "processing");
  }, [scenes]);

  const isAnySceneProcessing = processingScenes.length > 0;
  const activeProcessingScene = processingScenes[0] || null;

  // Active scene specific queue & render state
  const isActiveSceneSubmitting = activeScene ? submittingSceneIds.includes(activeScene.id) : false;
  const isActiveSceneProcessing = (activeScene?.image_status === "processing") || isActiveSceneSubmitting;
  const isActiveSceneRendering = activeProcessingScene?.id === activeScene?.id;
  const activeSceneQueueIndex = processingScenes.findIndex((s: any) => s.id === activeScene?.id);
  const isActiveSceneQueued = isActiveSceneProcessing && !isActiveSceneRendering;

  // Batch generation active status (true if batch was initiated or multiple scenes are processing)
  const isBatchActive = isGeneratingAll || processingScenes.length > 1;

  // Automatically refresh cache buster whenever any scene completes or variants count changes
  const prevGeneratedCountRef = useRef(generatedScenesCount);
  useEffect(() => {
    if (generatedScenesCount !== prevGeneratedCountRef.current) {
      setCacheBuster(Date.now());
      prevGeneratedCountRef.current = generatedScenesCount;
    }
  }, [generatedScenesCount]);

  // Generation status polling (polls if any scene in project is processing, submitting, or batch generation initiated)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    const isWorking = isAnySceneProcessing || submittingSceneIds.length > 0 || isBatchSubmitting;

    if (isWorking) {
      interval = setInterval(() => {
        if (props.refreshProjectData) props.refreshProjectData();
      }, 1500);
    }

    if (!isWorking && isGeneratingAll) {
      setCacheBuster(Date.now());
      setIsGeneratingAll(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnySceneProcessing, submittingSceneIds.length, isBatchSubmitting, isGeneratingAll, props.refreshProjectData]);

  // Set engine (AGY API vs Draw Things vs Cloud vs Flow)
  const handleSelectImageEngine = async (nextProvider: "agy" | "local" | "cloud" | "flow") => {
    setImageProvider(nextProvider);
    try {
      await fetch("http://localhost:8000/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_provider: nextProvider }),
      });
    } catch (err) {
      console.error("Failed to update image provider setting:", err);
    }
  };

  const toggleImageEngine = () => {
    const order: ("agy" | "local" | "cloud" | "flow")[] = ["agy", "local", "cloud", "flow"];
    const nextIdx = (order.indexOf(imageProvider) + 1) % order.length;
    handleSelectImageEngine(order[nextIdx]);
  };

  // Talk Directly to Flow (Scene Copilot Handler)
  const handleCopilotSubmit = async (generateImage: boolean = true) => {
    if (!activeScene || !copilotInput.trim() || isCopilotRunning) return;

    setIsCopilotRunning(true);
    setCopilotSummary(null);

    const targetToUse = selectedTargetImage !== undefined ? selectedTargetImage : (activeScene.image_path || null);

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/flow-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: copilotInput.trim(),
          target_image: targetToUse,
          reference_images: referenceImages,
          reference_image: targetToUse,
          generate_image: generateImage,
          refine_prompt_text: !generateImage,
          model: flowModel,
          aspect_ratio: aspectRatioValue,
          count: imageCount,
          image_provider: imageProvider
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Only update text fields if user explicitly asked for "Refine Text Only"
        if (!generateImage) {
          await updateSingleScene(activeScene.id, {
            image_prompt_english: data.image_prompt_english,
            narration_khmer: data.narration_khmer,
            negative_prompt: data.negative_prompt_english,
            user_refinement_prompt: copilotInput.trim()
          });
        }

        const targetNote = targetToUse ? ` (target: ${targetToUse.split("/").pop()})` : " (new canvas)";
        const refNote = referenceImages.length > 0 ? ` [${referenceImages.length} refs]` : "";

        setCopilotSummary((data.change_summary || "Flow adjustment applied.") + targetNote + refNote);
        setCopilotInput("");
        if (data.generating && activeScene) {
          setSubmittingSceneIds(prev => [...prev, activeScene.id]);
        }
        if (props.refreshProjectData) await props.refreshProjectData();
        if (activeScene) {
          setSubmittingSceneIds(prev => prev.filter(id => id !== activeScene.id));
        }
      } else {
        const err = await response.text();
        console.error("Flow adjust error:", err);
      }
    } catch (err) {
      console.error("Error communicating with Flow Copilot:", err);
    } finally {
      setIsCopilotRunning(false);
    }
  };

  // Standard Generate Frame action
  const handleGenerateFrame = async () => {
    if (!activeScene) return;
    const sceneId = activeScene.id;
    setSubmittingSceneIds(prev => [...prev, sceneId]);

    const targetToUse = selectedTargetImage !== undefined ? selectedTargetImage : (activeScene.image_path || null);

    const payload = {
      aspect_ratio: aspectRatioValue,
      guidance_scale: 7.5,
      inference_steps: inferenceSteps,
      model: flowModel,
      count: imageCount,
      image_provider: imageProvider,
      target_image: targetToUse,
      reference_images: referenceImages,
    };

    try {
      const response = await fetch(`http://localhost:8000/api/scenes/${sceneId}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (error) {
      console.error("Error triggering generation:", error);
    } finally {
      setSubmittingSceneIds(prev => prev.filter(id => id !== sceneId));
    }
  };

  // Stop Generation
  const handleStop = async () => {
    if (!activeScene) return;
    try {
      await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/stop`, {
        method: "POST",
      });
      if (props.refreshProjectData) await props.refreshProjectData();
    } catch (error) {
      console.error("Error stopping generation:", error);
    }
  };

  // Generate Batch Scenes Images (all or specific selected scene IDs)
  const handleGenerateBatchScenes = async (sceneIds?: number[]) => {
    if (!activeProject?.id || scenes.length === 0 || isBatchSubmitting) return;
    setIsGeneratingAll(true);
    setIsBatchSubmitting(true);

    const payload: any = {
      aspect_ratio: aspectRatioValue,
      guidance_scale: 7.5,
      inference_steps: inferenceSteps,
      model: flowModel,
      count: imageCount,
      image_provider: imageProvider,
    };

    if (sceneIds && sceneIds.length > 0) {
      payload.scene_ids = sceneIds;
    }

    try {
      const response = await fetch(`http://localhost:8000/api/projects/${activeProject.id}/generate-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.count === 0) {
          setIsGeneratingAll(false);
        } else if (props.refreshProjectData) {
          await props.refreshProjectData();
        }
      } else {
        setIsGeneratingAll(false);
      }
    } catch (error) {
      console.error("Error triggering batch generation:", error);
      setIsGeneratingAll(false);
    } finally {
      setIsBatchSubmitting(false);
    }
  };

  const handleGenerateAllScenes = () => handleGenerateBatchScenes();
  const handleGenerateSelectedScenes = (selectedIds: number[]) => handleGenerateBatchScenes(selectedIds);

  // Stop All Scenes Generation
  const handleStopAllScenes = async () => {
    if (!activeProject?.id) return;
    try {
      await fetch(`http://localhost:8000/api/projects/${activeProject.id}/stop-images`, {
        method: "POST",
      });
      if (props.refreshProjectData) await props.refreshProjectData();
    } catch (error) {
      console.error("Error stopping batch generation:", error);
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Clear Active Scene Frame
  const handleTrashAll = async () => {
    if (!activeScene) return;
    try {
      await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/image`, {
        method: "DELETE",
      });
      setCacheBuster(Date.now());
      if (props.refreshProjectData) await props.refreshProjectData();
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  // Set Active Variant (with canonical mirror update)
  const handleSetActiveVariant = async (variantPath: string) => {
    setSelectedRefImage(variantPath);
    if (!activeScene || activeScene.image_path === variantPath) return;
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/set-active-image`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_path: variantPath }),
      });
      if (res.ok) {
        setCacheBuster(Date.now());
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error setting active image:", err);
    }
  };

  // Delete Individual Variant
  const handleDeleteVariant = async (variantPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeScene) return;
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/image-variant?image_path=${encodeURIComponent(variantPath)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCacheBuster(Date.now());
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error deleting image variant:", err);
    }
  };

  // Upload Reference File
  const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeScene) return;
    setIsUploadingRef(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/reference-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error uploading reference:", err);
    } finally {
      setIsUploadingRef(false);
      if (refInputRef.current) refInputRef.current.value = "";
    }
  };

  // Upload Local Image File directly as Target
  const handleUploadTarget = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeScene) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/upload-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image_path) {
          setSelectedTargetImage(data.image_path);
        }
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error uploading target image:", err);
    } finally {
      setIsUploading(false);
      if (targetFileInputRef.current) targetFileInputRef.current.value = "";
    }
  };

  // Add an existing scene's image as a reference
  const handleAddSceneRef = async (sceneImagePath: string) => {
    if (!activeScene || !sceneImagePath) return;
    try {
      const formData = new FormData();
      formData.append("reference_path", sceneImagePath);
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/reference-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setSelectedRefImage(sceneImagePath);
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error adding scene reference image:", err);
    }
  };

  // Pin variant as reference
  const handlePinVariantAsRef = async (variantPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activeScene) return;
    try {
      const formData = new FormData();
      formData.append("reference_path", variantPath);
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/reference-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setSelectedRefImage(variantPath);
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error adding reference image:", err);
    }
  };

  // Remove Reference
  const handleRemoveReference = async (refItem: string) => {
    if (!activeScene) return;
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/reference-image?reference=${encodeURIComponent(refItem)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error removing reference:", err);
    }
  };

  // File Upload directly onto scene
  const handleDirectUpload = async (file: File) => {
    if (!activeScene) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`http://localhost:8000/api/scenes/${activeScene.id}/upload-image`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setCacheBuster(Date.now());
        if (props.refreshProjectData) await props.refreshProjectData();
      }
    } catch (err) {
      console.error("Error uploading image:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      handleDirectUpload(file);
    }
  };

  if (!activeProject) return null;

  const activeVariantIdx = activeScene?.image_path ? imagesList.findIndex((p: string) => p === activeScene.image_path) : -1;
  // Target Image resolution: null = explicitly no target (generate new), string = specific target path, undefined = default to active frame
  const effectiveTarget = selectedTargetImage !== undefined ? selectedTargetImage : (activeScene?.image_path || null);
  const effectiveTargetVIdx = effectiveTarget ? imagesList.findIndex((p: string) => p === effectiveTarget) : -1;
  const effectiveTargetScene = effectiveTarget ? scenes.find((s: any) => {
    if (s.image_path === effectiveTarget) return true;
    if (s.images_list) {
      try {
        const parsed = typeof s.images_list === "string" ? JSON.parse(s.images_list) : s.images_list;
        return Array.isArray(parsed) && parsed.includes(effectiveTarget);
      } catch {
        return false;
      }
    }
    return false;
  }) : null;
  const targetFilename = effectiveTarget ? effectiveTarget.split("/").pop() : "";
  const effectiveTargetLabel = effectiveTargetVIdx >= 0 
    ? `V${effectiveTargetVIdx + 1}` 
    : (effectiveTargetScene 
        ? `Scene #${String(effectiveTargetScene.scene_number).padStart(2, "0")}` 
        : (targetFilename || "Target Frame"));

  // Helper to format any image reference path into a human readable badge label
  const getImageLabel = (path: string) => {
    if (!path) return "";
    const vIdx = imagesList.findIndex((p: string) => p === path);
    const matched = scenes.find((s: any) => {
      if (s.image_path === path) return true;
      if (s.images_list) {
        try {
          const parsed = typeof s.images_list === "string" ? JSON.parse(s.images_list) : s.images_list;
          return Array.isArray(parsed) && parsed.includes(path);
        } catch {
          return false;
        }
      }
      return false;
    });
    if (vIdx >= 0) return `V${vIdx + 1}`;
    if (matched) return `Scene #${String(matched.scene_number).padStart(2, "0")}`;
    if (!path.includes("/")) return `UUID: ${path.slice(0, 8)}...`;
    return path.split("/").pop() || "Image";
  };

  // Dynamic placeholder guiding the user on Target vs Reference usage
  const copilotPlaceholder = useMemo(() => {
    if (effectiveTarget && referenceImages.length > 0) {
      return `e.g. "Change the color of the shirt of this girl in @Target based on the outfit from @Ref 1, keep same pose..."`;
    }
    if (effectiveTarget) {
      return `e.g. "Modify @Target: make lighting warmer, add a coffee cup beside the girl..."`;
    }
    if (referenceImages.length > 0) {
      return `e.g. "Generate a new scene showing stickman girl at the cafe, using character style from @Ref 1..."`;
    }
    return "Tell Flow what to generate or adjust...";
  }, [effectiveTarget, referenceImages.length]);

  return (
    <div className="flex flex-col h-[calc(100vh-56px-48px)] max-h-[calc(100vh-56px-48px)] animate-in fade-in duration-200 select-none">
      
      {/* ========================================================= */}
      {/* 3-COLUMN WORKSPACE: SCENES | EDITOR & COPILOT | RENDER     */}
      {/* ========================================================= */}
      <div className="flex gap-4 w-full flex-1 min-h-0 pt-0.5 overflow-hidden">
        
        {/* ======================================================= */}
        {/* COLUMN 1: VERTICAL SCENE NAVIGATOR (~260px)              */}
        {/* ======================================================= */}
        <div className="w-60 xl:w-68 shrink-0 flex flex-col h-full gap-2">
          
          {/* Scenes Card Container */}
          <div className="flex-1 min-h-0 flex flex-col bg-card rounded-xl border border-border/70 shadow-2xs overflow-hidden">
            
            {/* Navigator Header */}
            <div className="h-10 px-3.5 border-b border-border/70 flex items-center justify-between shrink-0 bg-panel-header/60">
              <div className="flex items-center gap-2">
                <Layers size={13} className="text-panel-icon" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                  Scenes
                </span>
                <span className="text-[10px] font-mono text-panel-text">
                  ({scenes.length})
                </span>
              </div>

              {/* Generated Status Counter */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Check size={9} strokeWidth={2.5} />
                <span>{generatedScenesCount}/{scenes.length} Ready</span>
              </div>
            </div>

            {/* Vertical Scene List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5 min-h-0">
              {scenes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-4 text-center text-panel-text/60">
                  <ImageIcon size={24} className="opacity-30 mb-2" />
                  <p className="text-xs">No scenes found.</p>
                </div>
              ) : (
                scenes.map((s: any, idx: number) => {
                  const isSelected = activeSceneIndex === idx;
                  const hasImage = !!s.image_path;
                  const isProcessing = s.image_status === "processing" || submittingSceneIds.includes(s.id);
                  const isFailed = s.image_status === "failed";
                  const isSceneActiveRendering = activeProcessingScene?.id === s.id;
                  const sceneQueueIdx = processingScenes.findIndex((ps: any) => ps.id === s.id);
                  
                  // Count variants for this scene
                  let vCount = hasImage ? 1 : 0;
                  if (s.images_list) {
                    try {
                      const parsed = typeof s.images_list === "string" ? JSON.parse(s.images_list) : s.images_list;
                      if (Array.isArray(parsed) && parsed.length > 0) vCount = parsed.length;
                    } catch {}
                  }

                  const isBeingDragged = draggedSceneIdx === idx;
                  const isDropTarget = dragOverSceneIdx === idx;

                  return (
                    <div
                      key={s.id || idx}
                      draggable={dragHandleActiveIdx === idx}
                      onDragStart={(e) => handleSceneDragStart(e, idx)}
                      onDragOver={(e) => handleSceneDragOver(e, idx)}
                      onDrop={(e) => handleSceneDrop(e, idx)}
                      onDragEnd={handleSceneDragEnd}
                      onClick={() => setActiveSceneIndex(idx)}
                      className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 relative select-none ${
                        isBeingDragged ? "opacity-30 scale-[0.98] border-dashed border-primary" : ""
                      } ${
                        isDropTarget && dropPosition === "before" ? "border-t-2 border-t-primary" : ""
                      } ${
                        isDropTarget && dropPosition === "after" ? "border-b-2 border-b-primary" : ""
                      } ${
                        isSelected
                          ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary/30 shadow-2xs"
                          : hasImage
                            ? "bg-card hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 border-border/70 text-foreground"
                            : "bg-card/40 hover:bg-zinc-100/50 dark:hover:bg-zinc-855/40 border-border/40 text-panel-text"
                      }`}
                    >
                      {/* Scene Top: Number & Status Badge */}
                      <div className="flex items-center justify-between gap-1 w-full">
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="cursor-grab active:cursor-grabbing text-panel-text/40 hover:text-foreground transition-colors p-0.5" 
                            title="Drag to reorder sequence"
                            onMouseEnter={() => setDragHandleActiveIdx(idx)}
                            onMouseLeave={() => {
                              if (draggedSceneIdx === null) setDragHandleActiveIdx(null);
                            }}
                            onMouseDown={() => setDragHandleActiveIdx(idx)}
                            onTouchStart={() => setDragHandleActiveIdx(idx)}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical size={11} />
                          </span>
                          <span className={`text-[11px] font-bold font-mono ${isSelected ? "text-primary" : "text-foreground"}`}>
                            #{String(s.scene_number || idx + 1).padStart(2, "0")}
                          </span>
                          {vCount > 1 && (
                            <span className="px-1 py-0.2 rounded text-[8.5px] font-mono font-medium bg-zinc-200/70 dark:bg-zinc-800 text-panel-text">
                              {vCount}v
                            </span>
                          )}
                        </div>

                        {/* Status indicator badge */}
                        {isProcessing ? (
                          isSceneActiveRendering ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                              <Loader2 size={8} className="animate-spin" />
                              <span>Rendering</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                              <Clock size={8} />
                              <span>In Queue {sceneQueueIdx >= 0 ? `(#${sceneQueueIdx + 1})` : ""}</span>
                            </span>
                          )
                        ) : isFailed ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
                            <span>Failed</span>
                          </span>
                        ) : hasImage ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Check size={8} strokeWidth={2.5} />
                            <span>Ready</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[8.5px] font-medium text-panel-text/70 bg-zinc-100 dark:bg-zinc-800/60 border border-border/40">
                            Empty
                          </span>
                        )}
                      </div>

                      {/* Scene Card Body: Thumbnail & Script Snippet */}
                      <div className="flex items-center gap-2 w-full">
                        {hasImage ? (
                          <img
                            src={`http://localhost:8000/static/${s.image_path}?t=${cacheBuster}`}
                            alt={`Scene ${idx + 1}`}
                            className="w-12 h-8 rounded object-cover border border-border/60 shrink-0 bg-zinc-100 dark:bg-zinc-900"
                          />
                        ) : (
                          <div className="w-12 h-8 rounded border border-dashed border-border/60 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-center shrink-0">
                            <ImageIcon size={12} className="text-panel-text/30" />
                          </div>
                        )}
                        
                        <p className="text-[10px] text-panel-text line-clamp-2 leading-tight flex-1 select-none">
                          {s.narration_khmer || s.image_prompt_english || "No script yet..."}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Action Button Below Scenes Card */}
          <div className="shrink-0 h-9">
            {!isBatchActive ? (
              <div className="flex items-center gap-2 h-full">
                <button
                  type="button"
                  onClick={handleGenerateAllScenes}
                  disabled={scenes.length === 0 || isBatchSubmitting}
                  className="flex-1 h-full rounded-xl bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                  title="Queue all scenes in project"
                >
                  <Sparkles size={12} />
                  <span>Generate All</span>
                </button>

                <button
                  type="button"
                  onClick={openBatchSelectModal}
                  disabled={scenes.length === 0 || isBatchSubmitting}
                  className="flex-1 h-full rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-foreground border border-border/70 text-[11px] font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                  title="Select specific scenes or empty scenes to generate"
                >
                  <CheckSquare size={12} className="text-primary" />
                  <span>Generate Some</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStopAllScenes}
                className="w-full h-full rounded-xl bg-red-600 hover:bg-red-700 text-white text-[12px] font-semibold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                title="Stop batch generation"
              >
                <Loader2 size={13} className="animate-spin" />
                <span>Stop Generation</span>
              </button>
            )}
          </div>

        </div>

        {/* ======================================================= */}
        {/* COLUMN 2: SCENE EDITOR & COPILOT                         */}
        {/* ======================================================= */}
        <div className="flex-1 min-w-[320px] flex flex-col h-full bg-card rounded-xl border border-border/70 p-4 shadow-2xs overflow-hidden min-h-0">
          
          {!activeScene ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-panel-text">
              <ImageIcon size={32} className="opacity-30 mb-2" />
              <p className="text-sm">No scene selected.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between overflow-hidden min-h-0">
              
              {/* Scene Navigation Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-foreground">
                    Scene #{String(activeScene?.scene_number || activeSceneIndex + 1).padStart(2, "0")}
                  </span>
                  {isActiveSceneProcessing ? (
                    isActiveSceneRendering ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                        <Loader2 size={8} className="animate-spin" />
                        <span>Rendering Frame...</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
                        <Clock size={8} />
                        <span>In Queue {activeSceneQueueIndex >= 0 ? `(#${activeSceneQueueIndex + 1})` : ""}</span>
                      </span>
                    )
                  ) : activeScene.image_path ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Active Frame Ready
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-zinc-100 dark:bg-zinc-800 text-panel-text border border-border/40">
                      No Frame Rendered
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={activeSceneIndex <= 0}
                    onClick={() => setActiveSceneIndex(prev => Math.max(0, prev - 1))}
                    className="p-1 rounded border border-border/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Previous scene"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={activeSceneIndex >= scenes.length - 1}
                    onClick={() => setActiveSceneIndex(prev => Math.min(scenes.length - 1, prev + 1))}
                    className="p-1 rounded border border-border/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="Next scene"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {/* Scrollable Upper Content: Voiceover, Visual Prompt, Exclusions, References */}
              <div className="overflow-y-auto custom-scrollbar space-y-3 py-3 pr-1 flex-1 min-h-0">
                
                {/* 1. Voiceover (Khmer) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9.5px] font-semibold text-panel-text uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 size={11} className="text-panel-icon" />
                      Voiceover (Khmer)
                    </label>
                  </div>
                  <AutoResizeTextarea
                    defaultValue={activeScene.narration_khmer || ""}
                    onBlur={(val) => updateSingleScene(activeScene.id, { narration_khmer: val })}
                    placeholder="Khmer voiceover narration..."
                    className="w-full bg-transparent text-[13px] text-foreground leading-relaxed outline-none border-b border-border/40 focus:border-primary transition-colors py-1"
                  />
                </div>

                {/* 2. Visual Prompt (English) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9.5px] font-semibold text-panel-text uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={11} className="text-panel-icon" />
                      Visual Prompt (English)
                    </label>
                  </div>
                  <AutoResizeTextarea
                    defaultValue={activeScene.image_prompt_english || ""}
                    onBlur={(val) => updateSingleScene(activeScene.id, { image_prompt_english: val })}
                    placeholder="Visual prompt in English..."
                    className="w-full bg-transparent font-mono text-[11px] text-foreground/90 leading-relaxed outline-none border-b border-border/40 focus:border-primary transition-colors py-1"
                  />
                </div>

                {/* 3. Exclusions / Negative Constraints (Collapsible) */}
                <div className="pt-1 border-t border-border/30">
                  <button
                    type="button"
                    onClick={() => setIsExclusionsExpanded(prev => !prev)}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-panel-text hover:text-foreground cursor-pointer transition-colors py-0.5 w-full text-left"
                  >
                    <ChevronRight 
                      size={11} 
                      className={`text-panel-text transition-transform duration-150 shrink-0 ${
                        isExclusionsExpanded ? "rotate-90 text-primary" : ""
                      }`} 
                    />
                    <span className="uppercase tracking-wider text-[9px] font-semibold">
                      Exclusions (Negative)
                    </span>
                    {!isExclusionsExpanded && activeScene.negative_prompt && (
                      <span className="text-[9.5px] font-mono text-panel-text/60 truncate flex-1 ml-1">
                        — {activeScene.negative_prompt}
                      </span>
                    )}
                  </button>

                  {isExclusionsExpanded && (
                    <div className="pt-1.5 animate-in fade-in duration-100">
                      <AutoResizeTextarea
                        defaultValue={activeScene.negative_prompt || ""}
                        onBlur={(val) => updateSingleScene(activeScene.id, { negative_prompt: val })}
                        placeholder="e.g. text, watermark, bad anatomy, 3D render..."
                        className="w-full bg-zinc-100/60 dark:bg-zinc-900/60 p-2 rounded-lg font-mono text-[10px] text-foreground leading-relaxed outline-none border border-border/60 focus:border-primary transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* 4. Reference Images Shelf */}
                <div className="pt-1 border-t border-border/30">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-panel-text flex items-center gap-1">
                      <Paperclip size={10} className="text-panel-icon" />
                      Reference Images ({referenceImages.length})
                    </span>
                    <div className="relative" ref={addRefMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsAddRefMenuOpen(!isAddRefMenuOpen)}
                        disabled={isUploadingRef}
                        className="text-[10px] font-medium text-primary hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {isUploadingRef ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                        <span>Add Ref</span>
                      </button>

                      {isAddRefMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-1 w-48 bg-card border border-border/80 rounded-xl shadow-xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddRefMenuOpen(false);
                              refInputRef.current?.click();
                            }}
                            className="w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Upload size={12} className="text-panel-icon" />
                            <span>Upload from File</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsAddRefMenuOpen(false);
                              setIsScenePickerOpen(true);
                            }}
                            className="w-full px-2.5 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Layers size={12} className="text-panel-icon" />
                            <span>From Existing Scene...</span>
                          </button>
                        </div>
                      )}

                      <input 
                        ref={refInputRef} 
                        type="file" 
                        accept="image/*" 
                        onChange={handleUploadReference} 
                        className="hidden" 
                      />
                    </div>
                  </div>

                  {referenceImages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {referenceImages.map((refItem, idx) => {
                        const isFlowUuid = !refItem.includes("/");
                        const matchedScene = scenes.find((s: any) => {
                          if (s.image_path === refItem) return true;
                          if (s.images_list) {
                            try {
                              const parsed = typeof s.images_list === "string" ? JSON.parse(s.images_list) : s.images_list;
                              return Array.isArray(parsed) && parsed.includes(refItem);
                            } catch {
                              return false;
                            }
                          }
                          return false;
                        });
                        const displayName = matchedScene 
                          ? `Scene #${String(matchedScene.scene_number).padStart(2, "0")}`
                          : (isFlowUuid ? `UUID: ${refItem.slice(0, 8)}...` : refItem.split("/").pop());

                        const isTarget = effectiveTarget === refItem;

                        return (
                          <div 
                            key={idx}
                            onClick={() => setSelectedTargetImage(refItem)}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] border font-mono transition-all cursor-pointer ${
                              isTarget
                                ? "bg-primary/10 text-primary border-primary/40 ring-1 ring-primary/20 font-bold"
                                : "bg-zinc-100 dark:bg-zinc-900 text-foreground border-border/60 hover:border-primary/40"
                            }`}
                            title={`Click to set as Target Image to modify (${refItem})`}
                          >
                            {!isFlowUuid && (
                              <img 
                                src={`http://localhost:8000/static/${refItem}?t=${cacheBuster}`} 
                                alt="Ref preview" 
                                className="w-3.5 h-3.5 rounded-xs object-cover" 
                              />
                            )}
                            <span className="truncate max-w-[120px]" title={refItem}>{displayName}</span>
                            {isTarget && (
                              <span className="text-[8px] font-sans font-bold uppercase tracking-wider text-primary">
                                Target
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveReference(refItem);
                                if (effectiveTarget === refItem) {
                                  setSelectedTargetImage(undefined);
                                }
                              }}
                              className="text-zinc-400 hover:text-red-500 transition-colors ml-0.5 cursor-pointer"
                              title="Remove Reference"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* ======================================================= */}
              {/* FLOW COPILOT (TARGET VS REFERENCE SPACE & PROMPT BOX)    */}
              {/* ======================================================= */}
              <div className="pt-2.5 border-t border-border/50 shrink-0 space-y-2">
                
                {/* Copilot Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wand2 size={11} className="text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Flow Copilot
                    </span>
                  </div>

                  {/* Mode Badge */}
                  <span className="text-[9px] font-mono text-panel-text">
                    {effectiveTarget ? "Image-to-Image Adjustment" : "Prompt-Driven Generation"}
                  </span>
                </div>

                {/* 1. Dedicated Target Image Selector Card */}
                <div className="relative" ref={targetMenuRef}>
                  {effectiveTarget ? (
                    <div className="p-2 rounded-xl bg-primary/5 border border-primary/30 flex items-center justify-between gap-2 transition-all">
                      <div className="flex items-center gap-2 min-w-0">
                        <img 
                          src={`http://localhost:8000/static/${effectiveTarget}?t=${cacheBuster}`}
                          alt="Target Frame"
                          className="w-7 h-7 rounded-lg object-cover border border-primary/40 shrink-0 shadow-2xs"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                              <Crosshair size={10} /> Target to Modify
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">
                              {effectiveTargetLabel}
                            </span>
                          </div>
                          <p className="text-[9.5px] text-panel-text truncate">Preserve composition & adjust selected elements</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsTargetMenuOpen(!isTargetMenuOpen)}
                          className="px-2 py-0.5 rounded-lg text-[9.5px] font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer border border-primary/25 flex items-center gap-1"
                          title="Change target image"
                        >
                          <span>Change</span>
                          <ChevronDown size={11} className={`transition-transform duration-150 ${isTargetMenuOpen ? "rotate-180" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedTargetImage(null)}
                          className="p-1 rounded-lg text-panel-text hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Clear Target: Generate completely new image from scratch without matching layout"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-900/60 border border-border/80 flex items-center justify-between gap-2 transition-all">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-zinc-200/60 dark:bg-zinc-800 flex items-center justify-center text-panel-text shrink-0">
                          <Sparkles size={13} className="text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-panel-text flex items-center gap-1">
                              <Crosshair size={10} /> Target: None
                            </span>
                            <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold font-mono">
                              New Canvas
                            </span>
                          </div>
                          <p className="text-[9.5px] text-panel-text/70 truncate">Generates a fresh scene from scratch using references as guides</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsTargetMenuOpen(!isTargetMenuOpen)}
                        className="px-2.5 py-1 rounded-lg text-[9.5px] font-semibold text-foreground bg-card border border-border/80 hover:border-primary/50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Target size={11} className="text-primary" />
                        <span>Set Target</span>
                        <ChevronDown size={11} className={`text-panel-text transition-transform duration-150 ${isTargetMenuOpen ? "rotate-180 text-primary" : ""}`} />
                      </button>
                    </div>
                  )}

                  {/* Target Selection Dropdown Menu - Opens UPWARDS into spacious viewport to avoid bottom clipping */}
                  {isTargetMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-1.5 w-64 bg-card border border-border/80 rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-panel-text border-b border-border/40">
                        Select Target to Modify
                      </div>

                      {activeScene?.image_path && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTargetImage(activeScene.image_path);
                            setIsTargetMenuOpen(false);
                          }}
                          className={`w-full px-2 py-1.5 text-left text-[11px] font-medium rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                            effectiveTarget === activeScene.image_path
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <img src={`http://localhost:8000/static/${activeScene.image_path}?t=${cacheBuster}`} className="w-5 h-5 rounded object-cover" />
                          <span className="truncate">Current Active Frame</span>
                        </button>
                      )}

                      {/* Scene Variations */}
                      {imagesList.map((vPath, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSelectedTargetImage(vPath);
                            setIsTargetMenuOpen(false);
                          }}
                          className={`w-full px-2 py-1.5 text-left text-[11px] font-medium rounded-lg flex items-center gap-2 transition-colors cursor-pointer ${
                            effectiveTarget === vPath
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          <img src={`http://localhost:8000/static/${vPath}?t=${cacheBuster}`} className="w-5 h-5 rounded object-cover" />
                          <span className="truncate">Variation V{idx + 1}</span>
                        </button>
                      ))}

                      {(activeScene?.image_path || imagesList.length > 0) && (
                        <div className="border-t border-border/40 my-0.5" />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsTargetMenuOpen(false);
                          setScenePickerMode("target");
                          setIsScenePickerOpen(true);
                        }}
                        className="w-full px-2 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Layers size={13} className="text-panel-icon" />
                        <span>From Existing Scene...</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsTargetMenuOpen(false);
                          targetFileInputRef.current?.click();
                        }}
                        className="w-full px-2 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Upload size={13} className="text-panel-icon" />
                        <span>Upload Target Image File...</span>
                      </button>

                      <div className="border-t border-border/40 my-0.5" />

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTargetImage(null);
                          setIsTargetMenuOpen(false);
                        }}
                        className="w-full px-2 py-1.5 text-left text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Sparkles size={13} />
                        <span>✕ No Target (Generate New Image)</span>
                      </button>
                    </div>
                  )}

                  <input 
                    ref={targetFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadTarget}
                    className="hidden"
                  />
                </div>

                {/* 2. Quick Mention Pills (@Target, @Ref 1, @Ref 2) */}
                {(effectiveTarget || referenceImages.length > 0) && (
                  <div className="flex items-center gap-1.5 flex-wrap px-0.5">
                    <span className="text-[9px] text-panel-text/60 font-mono">Insert:</span>
                    {effectiveTarget && (
                      <button
                        type="button"
                        onClick={() => {
                          setCopilotInput(prev => prev.includes("@Target") ? prev : (prev ? `${prev} @Target` : "@Target "));
                          copilotInputRef.current?.focus();
                        }}
                        className="px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-[9.5px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        title="Insert @Target in prompt"
                      >
                        <Crosshair size={9} />
                        <span>@Target ({effectiveTargetLabel})</span>
                      </button>
                    )}
                    {referenceImages.map((refItem, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const tag = `@Ref ${idx + 1}`;
                          setCopilotInput(prev => prev.includes(tag) ? prev : (prev ? `${prev} ${tag}` : `${tag} `));
                          copilotInputRef.current?.focus();
                        }}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9.5px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                        title={`Insert @Ref ${idx + 1} (${getImageLabel(refItem)}) in prompt`}
                      >
                        <Paperclip size={9} />
                        <span>@Ref {idx + 1} ({getImageLabel(refItem)})</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Copilot Feedback Banner */}
                {copilotSummary && (
                  <div className="p-1.5 rounded-md bg-primary/10 border border-primary/20 flex items-start justify-between gap-1.5 animate-in fade-in duration-150">
                    <p className="text-[10px] text-foreground leading-tight flex-1">
                      <span className="font-bold text-primary mr-1">✓ Flow:</span>
                      {copilotSummary}
                    </p>
                    <button 
                      type="button" 
                      onClick={() => setCopilotSummary(null)} 
                      className="text-panel-text hover:text-foreground shrink-0 cursor-pointer p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}

                {/* Copilot Prompt Input Container */}
                <div className="rounded-xl border border-border/80 bg-zinc-50/50 dark:bg-zinc-900/40 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all flex flex-col">
                  <textarea
                    ref={copilotInputRef}
                    rows={2}
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    disabled={isCopilotRunning}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (copilotInput.trim() && !isCopilotRunning && !isActiveSceneProcessing) {
                          handleCopilotSubmit(true);
                        }
                      }
                    }}
                    placeholder={copilotPlaceholder}
                    className="w-full px-2.5 pt-2 pb-1 bg-transparent text-[11.5px] text-foreground outline-none resize-none leading-relaxed placeholder:text-panel-text/50 disabled:opacity-50"
                  />

                  {/* Action Toolbar */}
                  <div className="flex items-center justify-between px-2 py-1 border-t border-border/30 bg-card/60 rounded-b-xl">
                    <span className="text-[9px] text-panel-text/50 font-mono">
                      ↵ Enter to submit
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!copilotInput.trim() || isCopilotRunning}
                        onClick={() => handleCopilotSubmit(false)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium text-panel-text hover:text-foreground hover:bg-zinc-200/50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
                        title="Refine prompt & script without rendering image"
                      >
                        Refine Text Only
                      </button>

                      <button
                        type="button"
                        disabled={!copilotInput.trim() || isCopilotRunning || isActiveSceneProcessing}
                        onClick={() => handleCopilotSubmit(true)}
                        className="px-2.5 py-0.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-[10px] font-semibold flex items-center gap-1 shadow-2xs disabled:opacity-40 transition-all cursor-pointer"
                      >
                        {isCopilotRunning ? (
                          <>
                            <Loader2 size={10} className="animate-spin" />
                            <span>Adjusting...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={10} />
                            <span>Adjust & Generate</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* ======================================================= */}
        {/* COLUMN 3: RENDER STUDIO, TOOLBAR & VARIATIONS           */}
        {/* ======================================================= */}
        <div className="flex-1 min-w-[380px] flex flex-col h-full space-y-2 overflow-hidden min-h-0">
          
          {/* Top Options Toolbar (Cleanly Segmented) */}
          <div className="h-8 shrink-0 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
            
            <div className="flex items-center gap-2 shrink-0">
              {/* Aspect Ratio Pills */}
              <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs" title="Aspect Ratio">
                {["16:9", "4:3", "1:1", "9:16", "2:3"].map((ratio) => {
                  const isActive = aspectRatioValue === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={async () => {
                        setAspectRatioValue(ratio);
                        if (activeProject?.id) {
                          await updateActiveProject({ aspect_ratio: ratio });
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono flex items-center gap-1 transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-white font-bold shadow-2xs"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                      title={`Aspect Ratio ${ratio}`}
                    >
                      <AspectRatioGraphic ratio={ratio} />
                      <span>{ratio}</span>
                    </button>
                  );
                })}
              </div>

              {/* Flow Model Dropdown */}
              {imageProvider === "flow" && (
                <select
                  value={flowModel}
                  onChange={(e) => setFlowModel(e.target.value as "nano2" | "nano-pro")}
                  className="px-2 py-0.5 h-7 bg-card border border-border/70 rounded-lg text-[10px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                  title="Google Flow Image Model"
                >
                  <option value="nano2">Nano Banana 2 (Fast)</option>
                  <option value="nano-pro">Nano Banana Pro (Quality)</option>
                </select>
              )}

              {/* Batch Count Selector */}
              {imageProvider === "flow" && (
                <div className="flex items-center gap-0.5 bg-card border border-border/70 p-0.5 rounded-lg shadow-2xs" title="Batch Generation Count">
                  <span className="text-[9px] font-mono px-1 text-panel-text">x</span>
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setImageCount(num)}
                      className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium transition-all cursor-pointer ${
                        imageCount === num
                          ? "bg-primary text-white font-bold"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Daemon Status & Engine Toggle */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Flow Daemon Pill */}
              {imageProvider === "flow" && (
                <div 
                  className={`px-2 py-0.5 rounded-md border text-[9.5px] font-medium flex items-center gap-1.5 shadow-2xs ${
                    flowStatus?.daemon_running 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" 
                      : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                  }`}
                  title={flowStatus?.daemon_running ? "MCP Daemon running on :8765" : "Run ./scripts/start_flow_daemon.sh"}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${flowStatus?.daemon_running ? "bg-emerald-500" : "bg-red-500"}`} />
                  <span>{flowStatus?.daemon_running ? ":8765 Connected" : "Offline"}</span>
                </div>
              )}

              {/* Image Engine Selector */}
              <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/90 rounded-lg border border-border/60 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectImageEngine("agy")}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                    imageProvider === "agy"
                      ? "bg-card text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Antigravity Native Agent API"
                >
                  ✨ AGY API
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectImageEngine("local")}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                    imageProvider === "local"
                      ? "bg-card text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Draw Things (Local port 7860)"
                >
                  💻 Local
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectImageEngine("cloud")}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                    imageProvider === "cloud"
                      ? "bg-card text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Pollinations Cloud Direct"
                >
                  ☁️ Cloud
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectImageEngine("flow")}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all cursor-pointer ${
                    imageProvider === "flow"
                      ? "bg-card text-foreground shadow-2xs font-semibold ring-1 ring-primary/30"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Google Flow MCP (port 8765)"
                >
                  ⚡ Flow
                </button>
              </div>
            </div>

          </div>

          {/* Render Output Frame & Variations Card */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 bg-card rounded-xl border transition-all shadow-2xs flex flex-col overflow-hidden min-h-0 relative ${
              isDraggingOver ? "border-primary ring-2 ring-primary/20" : "border-border/70"
            }`}
          >
            {/* Viewfinder Header */}
            <div className="h-8 px-3 bg-panel-header/80 border-b border-border/70 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon size={11} className="text-panel-icon" />
                <span className="text-[10px] font-semibold tracking-wider uppercase text-panel-text">
                  Render Output Frame
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-[9.5px] font-medium text-foreground transition-colors flex items-center gap-1 cursor-pointer"
                  title="Upload an image file directly into this scene"
                >
                  {isUploading ? <Loader2 size={9} className="animate-spin" /> : <Upload size={9} />}
                  <span>{isUploading ? "Uploading..." : "Upload"}</span>
                </button>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDirectUpload(f);
                  }} 
                  className="hidden" 
                />

                {activeScene?.image_path && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSelectedTargetImage(activeScene.image_path!)}
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                        effectiveTarget === activeScene.image_path
                          ? "bg-primary text-white font-bold shadow-2xs"
                          : "bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-foreground"
                      }`}
                      title="Set active frame as Target Image to modify in Copilot"
                    >
                      <Crosshair size={9} />
                      <span>{effectiveTarget === activeScene.image_path ? "Active Target" : "Set Target"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handlePinVariantAsRef(activeScene.image_path!, e)}
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                        referenceImages.includes(activeScene.image_path!)
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold"
                          : "bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-foreground"
                      }`}
                      title="Add active frame as reference guide"
                    >
                      <Paperclip size={9} />
                      <span>{referenceImages.includes(activeScene.image_path!) ? "In Refs" : "Add Ref"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsZoomed(true)}
                      className="p-1 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground transition-colors cursor-pointer"
                      title="Zoom in Lightbox"
                    >
                      <Maximize2 size={11} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Viewport Canvas */}
            <div className="flex-1 flex items-center justify-center p-3 overflow-hidden relative min-h-0 bg-zinc-50/20 dark:bg-zinc-950/20">
              {isActiveSceneProcessing ? (
                isActiveSceneRendering ? (
                  activeScene?.image_path ? (
                    <div className="w-full h-full relative group flex items-center justify-center">
                      <img 
                        src={`http://localhost:8000/static/${activeScene.image_path}?t=${cacheBuster}`} 
                        alt={`Scene ${activeScene.scene_number}`} 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xs"
                      />
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] rounded-lg flex flex-col items-center justify-center text-center p-4 select-none animate-pulse">
                        <Loader2 size={24} className="mb-2 animate-spin text-primary" />
                        <p className="text-[10.5px] uppercase tracking-widest font-bold text-white">
                          {imageProvider === "agy" ? "Generating via AGY API..." : imageProvider === "flow" ? "Rendering via Google Flow MCP..." : imageProvider === "cloud" ? "Synthesizing frame via Cloud..." : "Synthesizing frame locally..."}
                        </p>
                        <p className="text-[9.5px] text-zinc-300 mt-0.5">
                          Generating frame variation & updating timeline
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 select-none animate-pulse">
                      <Loader2 size={24} className="mb-2 animate-spin text-primary opacity-80" />
                      <p className="text-[10.5px] uppercase tracking-widest font-bold text-foreground">
                        {imageProvider === "agy" ? "Generating via AGY API..." : imageProvider === "flow" ? "Rendering via Google Flow MCP..." : imageProvider === "cloud" ? "Synthesizing frame via Cloud..." : "Synthesizing frame locally..."}
                      </p>
                      <p className="text-[9.5px] text-panel-text/70 mt-0.5">
                        Generating frame variation & updating timeline
                      </p>
                    </div>
                  )
                ) : (
                  /* Active scene is in queue */
                  activeScene?.image_path ? (
                    <div className="w-full h-full relative group flex items-center justify-center">
                      <img 
                        src={`http://localhost:8000/static/${activeScene.image_path}?t=${cacheBuster}`} 
                        alt={`Scene ${activeScene.scene_number}`} 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xs"
                      />
                      <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center text-center p-4 select-none">
                        <Clock size={24} className="mb-2 text-amber-400 animate-pulse" />
                        <p className="text-[10.5px] uppercase tracking-widest font-bold text-white">
                          In Generation Queue {activeSceneQueueIndex >= 0 ? `(Position #${activeSceneQueueIndex + 1})` : ""}
                        </p>
                        <p className="text-[9.5px] text-zinc-300 mt-0.5">
                          Waiting for preceding scene to finish rendering...
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-6 select-none">
                      <Clock size={26} className="mb-2 text-amber-500 animate-pulse" />
                      <p className="text-[10.5px] uppercase tracking-widest font-bold text-foreground">
                        In Generation Queue {activeSceneQueueIndex >= 0 ? `(Position #${activeSceneQueueIndex + 1})` : ""}
                      </p>
                      <p className="text-[9.5px] text-panel-text/70 mt-1 max-w-[240px] leading-relaxed">
                        Waiting for preceding scene to finish rendering...
                      </p>
                    </div>
                  )
                )
              ) : activeScene?.image_path ? (
                <div className="w-full h-full relative group flex items-center justify-center">
                  <img 
                    src={`http://localhost:8000/static/${activeScene.image_path}?t=${cacheBuster}`} 
                    alt={`Scene ${activeScene.scene_number}`} 
                    className="max-w-full max-h-full object-contain rounded-lg shadow-xs"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 select-none text-panel-text">
                  <ImageIcon size={28} className="mb-2 opacity-30" />
                  <p className="text-[10.5px] uppercase tracking-widest font-semibold text-panel-text">
                    No Render Output
                  </p>
                  <p className="text-[9.5px] text-panel-text/60 mt-1 max-w-[220px] leading-relaxed">
                    Click "Generate Frame", talk to Flow Copilot, or drop an image file here.
                  </p>
                </div>
              )}
            </div>

            {/* ======================================================= */}
            {/* VARIATIONS STRIP (SAFE CLICK-TO-SELECT & SAFE ACTIONS)  */}
            {/* ======================================================= */}
            {imagesList.length > 0 && (
              <div className="border-t border-border/70 bg-panel-header/50 p-2.5 shrink-0">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-panel-text flex items-center gap-1">
                      <Layers size={11} /> Variations ({imagesList.length})
                    </span>
                    {activeVariantIdx >= 0 && (
                      <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        V{activeVariantIdx + 1} Active
                      </span>
                    )}
                  </div>

                  {/* Explicit Action Buttons for the Active/Selected Variant */}
                  {activeScene?.image_path && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTargetImage(activeScene.image_path!);
                        }}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                          effectiveTarget === activeScene.image_path
                            ? "bg-primary text-white font-bold shadow-2xs"
                            : "text-panel-text hover:text-foreground bg-zinc-200/50 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750"
                        }`}
                        title="Set active frame as Target Image to modify in Copilot"
                      >
                        <Crosshair size={9} />
                        <span>{effectiveTarget === activeScene.image_path ? "Active Target" : "Set Target"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handlePinVariantAsRef(activeScene.image_path!, e)}
                        className={`px-2 py-0.5 rounded text-[9.5px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                          referenceImages.includes(activeScene.image_path!)
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold"
                            : "text-panel-text hover:text-foreground bg-zinc-200/50 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750"
                        }`}
                        title="Add active frame as reference guide"
                      >
                        <Paperclip size={9} />
                        <span>{referenceImages.includes(activeScene.image_path!) ? "In Refs" : "Add Ref"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteVariant(activeScene.image_path!, e)}
                        className="px-2 py-0.5 rounded text-[9.5px] font-medium text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Delete active variant"
                      >
                        <Trash2 size={9} />
                        <span>Delete Variant</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Safe Thumbnail List (Clicking thumbnail ALWAYS ticks it safely) */}
                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-0.5">
                  {imagesList.map((variantPath, vIdx) => {
                    const isActiveVariant = activeScene.image_path === variantPath;
                    const isTarget = effectiveTarget === variantPath;
                    const isRef = referenceImages.includes(variantPath);

                    return (
                      <div
                        key={vIdx}
                        onClick={() => handleSetActiveVariant(variantPath)}
                        className={`relative group shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          isActiveVariant 
                            ? "border-emerald-500 shadow-xs ring-2 ring-emerald-500/30" 
                            : isTarget
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border/70 hover:border-zinc-400 opacity-80 hover:opacity-100"
                        }`}
                        title={`Variant ${vIdx + 1} - Click to activate`}
                      >
                        <img 
                          src={`http://localhost:8000/static/${variantPath}?t=${cacheBuster}`} 
                          alt={`Variant ${vIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Variant Number Tag */}
                        <div className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-black/75 backdrop-blur-xs text-white text-[8px] font-mono font-bold flex items-center gap-0.5">
                          <span>V{vIdx + 1}</span>
                          {isTarget && <span className="text-primary font-sans">🎯</span>}
                          {isRef && <span className="text-emerald-400 font-sans">📎</span>}
                        </div>

                        {/* Top Action Badges & Hover Controls */}
                        <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
                          {isActiveVariant && (
                            <div className="bg-emerald-500 text-white rounded-full p-0.5 shadow-xs">
                              <Check size={8} strokeWidth={3} />
                            </div>
                          )}

                          {/* Quick Set Target Button on Hover */}
                          {!isTarget && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTargetImage(variantPath);
                              }}
                              className="p-0.5 rounded bg-black/70 hover:bg-primary text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                              title={`Set V${vIdx + 1} as Copilot Target Image`}
                            >
                              <Crosshair size={9} />
                            </button>
                          )}

                          {/* Quick Add Ref Button on Hover */}
                          {!isRef && (
                            <button
                              type="button"
                              onClick={(e) => handlePinVariantAsRef(variantPath, e)}
                              className="p-0.5 rounded bg-black/70 hover:bg-emerald-600 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                              title={`Add V${vIdx + 1} to Reference Guides`}
                            >
                              <Paperclip size={9} />
                            </button>
                          )}

                          {/* Delete variant (only for non-active variant) */}
                          {!isActiveVariant && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteVariant(variantPath, e)}
                              className="p-0.5 rounded bg-black/70 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                              title={`Delete V${vIdx + 1}`}
                            >
                              <Trash2 size={8} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Bottom Action Buttons */}
          <div className="flex gap-2 shrink-0 h-9">
            {isActiveSceneProcessing ? (
              <button 
                type="button"
                onClick={handleStop}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[12px] font-medium shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <X size={13} />
                <span>
                  {isActiveSceneQueued 
                    ? `Cancel Queue ${activeSceneQueueIndex >= 0 ? `(Position #${activeSceneQueueIndex + 1})` : ""}` 
                    : "Stop Rendering"}
                </span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleGenerateFrame}
                disabled={!activeScene || isActiveSceneSubmitting}
                className="flex-1 bg-primary hover:bg-primary-hover text-white rounded-xl text-[12px] font-semibold shadow-2xs transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {isActiveSceneSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Adding to Queue...</span>
                  </>
                ) : isAnySceneProcessing ? (
                  <>
                    <Clock size={13} />
                    <span>Queue Frame ({imageProvider === "agy" ? "AGY" : imageProvider === "flow" ? "Flow" : imageProvider === "cloud" ? "Cloud" : "Local"})</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={13} />
                    <span>Generate Frame ({imageProvider === "agy" ? "AGY" : imageProvider === "flow" ? "Flow" : imageProvider === "cloud" ? "Cloud" : "Local"})</span>
                  </>
                )}
              </button>
            )}

            <button 
              type="button"
              onClick={handleTrashAll}
              disabled={isActiveSceneProcessing || !activeScene || !activeScene.image_path}
              className="bg-card border border-border/70 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 px-3 rounded-xl text-panel-text hover:border-red-300 dark:hover:border-red-800 transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer"
              title="Clear Active Frame for this Scene"
            >
              <Trash2 size={13} />
            </button>
          </div>

        </div>

      </div>

      {/* ========================================================= */}
      {/* LIGHTBOX ZOOM MODAL WINDOW                                */}
      {/* ========================================================= */}
      {isZoomed && activeScene?.image_path && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6 animate-in fade-in duration-150"
          onClick={() => setIsZoomed(false)}
        >
          <button 
            type="button"
            className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
            onClick={() => setIsZoomed(false)}
          >
            <X size={18} />
          </button>
          <img 
            src={`http://localhost:8000/static/${activeScene.image_path}?t=${cacheBuster}`} 
            alt={`Scene ${activeScene.scene_number} Fullscreen`} 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* SCENE REFERENCE PICKER MODAL WINDOW                       */}
      {/* ========================================================= */}
      {isScenePickerOpen && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none"
          onClick={() => setIsScenePickerOpen(false)}
        >
          <div 
            className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-panel-header/80">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${scenePickerMode === "target" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                  {scenePickerMode === "target" ? <Target size={16} /> : <Layers size={16} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {scenePickerMode === "target" ? "Select Target Image (Base to Modify)" : "Select Reference Guide"}
                  </h3>
                  <p className="text-[11px] text-panel-text">
                    {scenePickerMode === "target" 
                      ? "Choose any rendered frame from your project as the base image to modify slightly in Flow Copilot" 
                      : `Choose any rendered frame from your project to guide generation for Scene #${String(activeScene?.scene_number || activeSceneIndex + 1).padStart(2, "0")}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScenePickerOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content: Grid of Scenes */}
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              {availableSceneRefs.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center text-panel-text">
                  <ImageIcon size={36} className="opacity-30 mb-2" />
                  <p className="text-xs font-semibold">No rendered scenes available</p>
                  <p className="text-[11px] text-panel-text/70 mt-1 max-w-[280px]">
                    Generate images for other scenes first, or upload an image file from your computer.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsScenePickerOpen(false);
                      if (scenePickerMode === "target") {
                        targetFileInputRef.current?.click();
                      } else {
                        refInputRef.current?.click();
                      }
                    }}
                    className="mt-4 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Upload size={12} />
                    <span>Upload Image File</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {availableSceneRefs.map((item: any) => {
                    const isAlreadyAdded = referenceImages.includes(item.imagePath);
                    const isSelectedTarget = effectiveTarget === item.imagePath;
                    const isCurrentScene = item.sceneId === activeScene?.id;

                    const isHighlighted = scenePickerMode === "target" ? isSelectedTarget : isAlreadyAdded;

                    return (
                      <div
                        key={item.uniqueKey}
                        onClick={() => {
                          if (scenePickerMode === "target") {
                            setSelectedTargetImage(item.imagePath);
                            setIsScenePickerOpen(false);
                          } else {
                            if (!isAlreadyAdded) {
                              handleAddSceneRef(item.imagePath);
                              setIsScenePickerOpen(false);
                            }
                          }
                        }}
                        className={`group relative rounded-xl border p-2 flex flex-col gap-2 transition-all text-left ${
                          isHighlighted
                            ? "bg-primary/5 border-primary/50 ring-1 ring-primary/20 shadow-xs cursor-default"
                            : "bg-card hover:bg-zinc-50 dark:hover:bg-zinc-900 border-border/80 hover:border-primary/60 hover:shadow-md cursor-pointer"
                        }`}
                      >
                        {/* Thumbnail Image Container */}
                        <div className="w-full aspect-video rounded-lg overflow-hidden relative bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center border border-border/40">
                          <img
                            src={`http://localhost:8000/static/${item.imagePath}?t=${cacheBuster}`}
                            alt={`Scene ${item.sceneNumber}`}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                          />
                          {/* Scene Number Overlay Badge */}
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono font-bold flex items-center gap-1 shadow-xs">
                            <span>#{String(item.sceneNumber).padStart(2, "0")}</span>
                            {item.variantTag && (
                              <span className="text-zinc-300 font-normal">({item.variantTag})</span>
                            )}
                          </div>

                          {/* Target or Added indicator badge */}
                          {scenePickerMode === "target" && isSelectedTarget && (
                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px] font-medium flex items-center gap-1 shadow-xs">
                              <Target size={9} strokeWidth={3} />
                              <span>Target</span>
                            </div>
                          )}

                          {scenePickerMode === "reference" && isAlreadyAdded && (
                            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-medium flex items-center gap-1 shadow-xs">
                              <Check size={9} strokeWidth={3} />
                              <span>Added</span>
                            </div>
                          )}

                          {isCurrentScene && (
                            <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.2 rounded bg-primary/80 text-white text-[8px] font-medium">
                              Current Scene
                            </div>
                          )}
                        </div>

                        {/* Scene Script Snippet */}
                        <div className="px-0.5">
                          <p className="text-[10px] text-panel-text line-clamp-2 leading-snug">
                            {item.promptText || "Scene frame"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-border/70 flex items-center justify-between bg-panel-header/40 text-[11px] text-panel-text">
              <span>{availableSceneRefs.length} frame(s) available</span>
              <button
                type="button"
                onClick={() => {
                  setIsScenePickerOpen(false);
                  if (scenePickerMode === "target") {
                    targetFileInputRef.current?.click();
                  } else {
                    refInputRef.current?.click();
                  }
                }}
                className="text-primary hover:text-primary-hover font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Upload size={11} />
                <span>Upload {scenePickerMode === "target" ? "target" : "reference"} from computer instead</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* BATCH GENERATE / SCENE SELECTION MODAL                    */}
      {/* ========================================================= */}
      {isBatchSelectModalOpen && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none"
          onClick={() => setIsBatchSelectModalOpen(false)}
        >
          <div 
            className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between bg-panel-header/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <CheckSquare size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Select Scenes to Generate</h3>
                  <p className="text-[11px] text-panel-text">Choose specific scenes or filter by Empty/Failed for targeted batch generation.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchSelectModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-panel-text hover:text-foreground transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Filter & Selection Toolbar */}
            <div className="px-5 py-2.5 bg-zinc-50/70 dark:bg-zinc-900/40 border-b border-border/60 shrink-0 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold text-panel-text uppercase tracking-wider mr-1">Select:</span>
                <button
                  type="button"
                  onClick={handleSelectEmptyOnly}
                  disabled={emptyScenesCount === 0}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                    emptyScenesCount > 0
                      ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      : "opacity-40 cursor-not-allowed border-border/60 text-panel-text"
                  }`}
                  title="Select all scenes without images"
                >
                  Empty Only ({emptyScenesCount})
                </button>
                <button
                  type="button"
                  onClick={handleSelectFailedOnly}
                  disabled={failedScenesCount === 0}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                    failedScenesCount > 0
                      ? "bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30"
                      : "opacity-40 cursor-not-allowed border-border/60 text-panel-text"
                  }`}
                  title="Select all failed scenes"
                >
                  Failed Only ({failedScenesCount})
                </button>
                <button
                  type="button"
                  onClick={handleSelectReadyOnly}
                  disabled={generatedScenesCount === 0}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-foreground border border-border/60 transition-colors cursor-pointer disabled:opacity-40"
                  title="Select ready scenes to regenerate"
                >
                  Ready ({generatedScenesCount})
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-foreground border border-border/60 transition-colors cursor-pointer"
                  title="Select all scenes"
                >
                  All ({scenes.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Clear all selections"
                >
                  Clear
                </button>
              </div>

              {/* Status Summary */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{generatedScenesCount} Ready</span>
                <span className="text-panel-text/40">·</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{emptyScenesCount} Empty</span>
                {failedScenesCount > 0 && (
                  <>
                    <span className="text-panel-text/40">·</span>
                    <span className="text-red-500 font-semibold">{failedScenesCount} Failed</span>
                  </>
                )}
              </div>
            </div>

            {/* Scrollable Scene List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 min-h-0">
              {scenes.map((scene: any) => {
                const isSelected = selectedSceneIds.includes(scene.id);
                const hasImage = !!scene.image_path;
                const isFailed = scene.image_status === "failed";
                const isProcessing = scene.image_status === "processing";

                return (
                  <div
                    key={scene.id}
                    onClick={() => toggleSceneSelection(scene.id)}
                    className={`px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-2xs"
                        : "border-border/50 hover:border-border hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30"
                    }`}
                  >
                    {/* Left: Checkbox & Scene Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? "bg-primary border-primary text-white"
                            : "border-border/80 bg-zinc-100 dark:bg-zinc-800"
                        }`}
                      >
                        {isSelected && <Check size={11} strokeWidth={3} />}
                      </div>

                      {/* Thumbnail or placeholder */}
                      {hasImage ? (
                        <img
                          src={`http://localhost:8000/static/${scene.image_path}?t=${cacheBuster}`}
                          alt={`Scene ${scene.scene_number}`}
                          className="w-11 h-7 rounded object-cover border border-border/60 shrink-0 bg-zinc-100 dark:bg-zinc-900"
                        />
                      ) : (
                        <div className="w-11 h-7 rounded bg-zinc-100 dark:bg-zinc-900 border border-border/50 flex items-center justify-center text-panel-text/40 shrink-0">
                          <ImageIcon size={12} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold font-mono text-foreground">
                            Scene #{String(scene.scene_number).padStart(2, "0")}
                          </span>
                        </div>
                        <p className="text-[10px] text-panel-text truncate leading-tight mt-0.5">
                          {scene.narration_khmer || scene.image_prompt_english || "No script yet..."}
                        </p>
                      </div>
                    </div>

                    {/* Right: Status Badge */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      {isProcessing ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                          <Loader2 size={9} className="animate-spin" />
                          <span>Rendering</span>
                        </span>
                      ) : isFailed ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30">
                          <span>Failed</span>
                        </span>
                      ) : hasImage ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Check size={9} strokeWidth={2.5} />
                          <span>Ready</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-panel-text/70 bg-zinc-100 dark:bg-zinc-800 border border-border/40">
                          Empty
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-border/70 bg-zinc-50/50 dark:bg-zinc-900/30 shrink-0 flex items-center justify-between gap-3">
              <div className="text-[11px] text-panel-text font-medium">
                <span className="font-bold text-foreground">{selectedSceneIds.length}</span> of {scenes.length} selected
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchSelectModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-border/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] font-medium text-panel-text hover:text-foreground transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsBatchSelectModalOpen(false);
                    handleGenerateSelectedScenes(selectedSceneIds);
                  }}
                  disabled={selectedSceneIds.length === 0 || isBatchSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-40"
                >
                  <Sparkles size={12} />
                  <span>Generate Selected ({selectedSceneIds.length})</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
