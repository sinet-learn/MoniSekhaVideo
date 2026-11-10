/* eslint-disable */
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import type { Project, SceneData } from "./types";

const API_BASE = "http://localhost:8000";

interface ProjectDataContextType {
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
  selectProject: (id: number) => Promise<void>;
  refreshActive: () => Promise<void>;
  updateActiveProject: (fields: Partial<Project>) => Promise<void>;
  updateSingleScene: (sceneId: number, fields: Partial<SceneData>) => Promise<void>;
  reorderScenes: (newSceneIds: number[]) => Promise<void>;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(undefined);

export const ProjectDataProvider = ({ children }: { children: ReactNode }) => {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  const loadProject = useCallback(async (id: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/projects/${id}`);
      if (response.ok) {
        const data: Project = await response.json();
        setActiveProject(data);
        setLoadedId(id);
        if (typeof window !== "undefined") {
          localStorage.setItem("activeProjectId", String(id));
        }
      } else if (response.status === 404) {
        setActiveProject(null);
        setLoadedId(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("activeProjectId");
        }
        setError("Project not found");
      } else {
        setError("Failed to load project details");
      }
    } catch (err) {
      console.error(err);
      setError("Error loading project details");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectProject = useCallback(
    async (id: number) => {
      if (loadedId === id && activeProject) {
        return;
      }
      await loadProject(id);
    },
    [loadedId, activeProject, loadProject]
  );

  const refreshActive = useCallback(async () => {
    if (!activeProject) return;
    try {
      const response = await fetch(`${API_BASE}/api/projects/${activeProject.id}`);
      if (response.ok) {
        const data: Project = await response.json();
        setActiveProject(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [activeProject]);

  useEffect(() => {
    const handleProjectUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updated = customEvent.detail;
      if (updated && activeProject && updated.id === activeProject.id) {
        refreshActive();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("project-updated", handleProjectUpdated);
      return () => window.removeEventListener("project-updated", handleProjectUpdated);
    }
  }, [activeProject, refreshActive]);

  const updateActiveProject = async (fields: Partial<Project>) => {
    if (!activeProject) return;

    setActiveProject((prev) => (prev ? { ...prev, ...fields } : null));

    try {
      const response = await fetch(`${API_BASE}/api/projects/${activeProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        console.error("Failed to sync project update to backend");
        await refreshActive();
      } else {
        const updated: Project = await response.json();
        setActiveProject(updated);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("project-updated", { detail: updated }));
        }
      }
    } catch (err) {
      console.error("Error updating project:", err);
      await refreshActive();
    }
  };

  const updateSingleScene = async (sceneId: number, fields: Partial<SceneData>) => {
    setActiveProject((prev) => {
      if (!prev) return prev;
      
      const newScenes = prev.scenes.map((scene) => {
        if (scene.id !== sceneId) return scene;
        
        const updated = { ...scene, ...fields };

        // Optimistically detect out-of-sync audio when text or character voice changes
        const narrationChanged = fields.narration_khmer !== undefined && 
          (fields.narration_khmer || "").trim() !== (scene.audio_text || scene.narration_khmer || "").trim();
        const charChanged = fields.character_id !== undefined && 
          fields.character_id !== scene.character_id;
          
        if ((narrationChanged || charChanged) && (scene.audio_status === "completed" || scene.audio_path)) {
          updated.audio_status = "outdated";
        } else if (
          fields.narration_khmer !== undefined &&
          scene.audio_text &&
          (fields.narration_khmer || "").trim() === scene.audio_text.trim() &&
          (!charChanged || fields.character_id === scene.character_id) &&
          scene.audio_path
        ) {
          updated.audio_status = "completed";
        }

        return updated;
      });
      
      const cleanJsonArray = newScenes.map((scene) => ({
        scene_number: scene.scene_number,
        narration_khmer: scene.narration_khmer,
        image_prompt_english: scene.image_prompt_english,
        video_prompt: scene.video_prompt,
        negative_prompt: scene.negative_prompt,
        image_path: scene.image_path,
        audio_path: scene.audio_path,
        character_id: scene.character_id,
        character_name: scene.character_name,
      }));

      return {
        ...prev,
        scenes: newScenes,
        structured_json_data: JSON.stringify(cleanJsonArray, null, 2),
      };
    });

    try {
      const response = await fetch(`${API_BASE}/api/scenes/${sceneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (response.ok) {
        const savedScene = await response.json();
        setActiveProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            scenes: prev.scenes.map((s) => (s.id === sceneId ? { ...s, ...savedScene } : s)),
          };
        });
      } else {
        console.error("Failed to sync scene update to backend");
      }
    } catch (err) {
      console.error("Error updating scene:", err);
    }
  };

  const reorderScenes = async (newSceneIds: number[]) => {
    if (!activeProject || !activeProject.scenes) return;

    const previousScenes = activeProject.scenes;
    const sceneMap = new Map(previousScenes.map((s) => [s.id, s]));

    const reordered: SceneData[] = [];
    newSceneIds.forEach((id, idx) => {
      const s = sceneMap.get(id);
      if (s) {
        reordered.push({ ...s, scene_number: idx + 1 });
      }
    });

    // Append any scenes not in newSceneIds to avoid dropping scenes
    previousScenes.forEach((s) => {
      if (!newSceneIds.includes(s.id)) {
        reordered.push({ ...s, scene_number: reordered.length + 1 });
      }
    });

    const cleanJsonArray = reordered.map((scene) => ({
      scene_number: scene.scene_number,
      narration_khmer: scene.narration_khmer,
      image_prompt_english: scene.image_prompt_english,
      negative_prompt: scene.negative_prompt,
      image_path: scene.image_path,
      audio_path: scene.audio_path,
      character_id: scene.character_id,
      character_name: scene.character_name,
    }));

    // Optimistic update
    setActiveProject((prev) =>
      prev
        ? {
            ...prev,
            scenes: reordered,
            structured_json_data: JSON.stringify(cleanJsonArray, null, 2),
          }
        : null
    );

    try {
      const response = await fetch(`${API_BASE}/api/projects/${activeProject.id}/reorder-scenes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene_ids: newSceneIds }),
      });

      if (response.ok) {
        const data: Project = await response.json();
        setActiveProject(data);
      } else {
        console.error("Failed to sync scene reorder to backend");
        await refreshActive();
      }
    } catch (err) {
      console.error("Error reordering scenes:", err);
      await refreshActive();
    }
  };

  return (
    <ProjectDataContext.Provider
      value={{
        activeProject,
        isLoading,
        error,
        selectProject,
        refreshActive,
        updateActiveProject,
        updateSingleScene,
        reorderScenes,
      }}
    >
      {children}
    </ProjectDataContext.Provider>
  );
};

export const useProjectDataContext = () => {
  const ctx = useContext(ProjectDataContext);
  if (!ctx) throw new Error("useProjectDataContext must be used within a ProjectDataProvider");
  return ctx;
};
