"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { 
  Folder, 
  Sun, 
  Moon, 
  Plus, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Settings, 
  MoreHorizontal, 
  Pencil, 
  Copy, 
  Trash2, 
  X, 
  Film,
  Pin,
  PinOff,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { useProjectsListContext, useUIContext } from "../../context/ProjectContext";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { projectsList, createNewProject, updateProject, deleteExistingProject, duplicateProject } = useProjectsListContext();
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed } = useUIContext();
  const [isCreating, setIsCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<number | null>(null);
  const [renamingTitle, setRenamingTitle] = useState("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [provider, setProvider] = useState<"gemini" | "groq">("gemini");
  const [slot, setSlot] = useState<1 | 2>(1);
  const [imageProvider, setImageProvider] = useState<"agy" | "local" | "cloud" | "flow">("agy");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [keysStatus, setKeysStatus] = useState<Record<string, { has_key: boolean; masked: string }>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const fetchSettings = () => {
    fetch("http://localhost:8000/api/settings")
      .then(res => res.json())
      .then(data => {
        setProvider(data.active_provider || "gemini");
        setSlot(data.active_slot || 1);
        setImageProvider(data.image_provider || "local");
        if (data.keys_status) {
          setKeysStatus(data.keys_status);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const payload: any = { 
        active_provider: provider, 
        active_slot: slot, 
        image_provider: imageProvider 
      };
      if (apiKey.trim()) {
        payload.api_key = apiKey.trim();
      }

      const res = await fetch("http://localhost:8000/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setApiKey("");
        fetchSettings();
        setIsSettingsOpen(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const menuRef = useRef<HTMLDivElement>(null);

  const isCollapsed = sidebarCollapsed;
  const toggleCollapse = () => setSidebarCollapsed(!sidebarCollapsed);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCreateProject = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const created = await createNewProject();
      if (created) {
        if (isCollapsed) setSidebarCollapsed(false);
        setRenamingProjectId(created.id);
        setRenamingTitle(created.title);
        router.push(`/projects/${created.id}/brainstorming`);
      }
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div 
      className={`relative h-full flex flex-col bg-card border-r border-border text-card-foreground transition-all duration-200 ease-in-out z-20 overflow-hidden ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* 1. Brand Header Bar */}
      <div className="h-14 flex items-center shrink-0 border-b border-border px-3.5 justify-between">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 flex items-center justify-center shadow-2xs shrink-0">
                <Film size={14} strokeWidth={2} />
              </div>
              <span className="font-semibold text-[14px] tracking-tight text-foreground truncate">
                MoniSekha
              </span>
            </div>
            <button
              onClick={toggleCollapse}
              className="w-7 h-7 flex items-center justify-center text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer shrink-0"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={15} strokeWidth={1.8} />
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            <button
              onClick={toggleCollapse}
              className="w-8 h-8 flex items-center justify-center text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>

      {/* 2. New Project Action Button */}
      <div className="px-3 pt-3 pb-1 shrink-0 w-full">
        {!isCollapsed ? (
          <button
            onClick={handleCreateProject}
            disabled={isCreating}
            className="w-full h-8.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/85 text-zinc-800 hover:text-zinc-950 border border-zinc-200/90 dark:bg-zinc-800/90 dark:hover:bg-zinc-750 dark:text-zinc-200 dark:hover:text-zinc-100 dark:border-zinc-700/80 text-[13px] font-medium flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            title="Create New Project"
          >
            <Plus size={14} strokeWidth={2} />
            <span>{isCreating ? "Creating..." : "New Project"}</span>
          </button>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={handleCreateProject}
              disabled={isCreating}
              className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200/85 text-zinc-800 hover:text-zinc-950 border border-zinc-200/90 dark:bg-zinc-800/90 dark:hover:bg-zinc-750 dark:text-zinc-200 dark:hover:text-zinc-100 dark:border-zinc-700/80 flex items-center justify-center shadow-2xs transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              title="New Project"
            >
              <Plus size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* 3. Project Navigation */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 custom-scrollbar overflow-x-hidden w-full flex flex-col">
        {!isCollapsed && (
          <div className="flex items-center justify-between px-2 pt-2.5 pb-1 text-[11px] font-medium text-panel-text/70 uppercase tracking-wider">
            <span>Projects</span>
            <span className="font-mono text-[11px] text-panel-text/50 tabular-nums">
              {projectsList.length}
            </span>
          </div>
        )}
        
        {projectsList.length === 0 ? (
          !isCollapsed && (
            <p className="text-xs text-panel-text/50 px-3 py-4 italic text-center">
              No projects yet
            </p>
          )
        ) : (
          projectsList.map((project) => {
            const isActive = pathname === `/projects/${project.id}` || pathname?.startsWith(`/projects/${project.id}/`);
            return (
              <div key={project.id} className="relative group shrink-0 w-full">
                {!isCollapsed ? (
                  <div
                    onClick={() => router.push(`/projects/${project.id}/brainstorming`)}
                    className={`w-full h-8 flex items-center rounded-md text-left px-2.5 shrink-0 cursor-pointer transition-colors group ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800/80 text-foreground font-medium"
                        : "text-panel-text hover:text-foreground hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40"
                    }`}
                    title={project.title || project.slug || "Untitled"}
                  >
                    <Folder 
                      size={14} 
                      strokeWidth={isActive ? 2 : 1.75}
                      className={`shrink-0 mr-2.5 transition-colors ${
                        isActive ? "text-foreground" : "opacity-60 group-hover:opacity-90"
                      }`} 
                    />
                    
                    {renamingProjectId === project.id ? (
                      <input
                        autoFocus
                        className="text-[13px] flex-1 bg-background border border-primary/50 rounded px-1.5 py-0.5 outline-none text-foreground font-normal"
                        value={renamingTitle}
                        onChange={(e) => setRenamingTitle(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={async () => {
                          if (renamingTitle.trim() && renamingTitle !== (project.title || project.slug)) {
                            await updateProject(project.id, { title: renamingTitle.trim() });
                          }
                          setRenamingProjectId(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            if (renamingTitle.trim() && renamingTitle !== (project.title || project.slug)) {
                              await updateProject(project.id, { title: renamingTitle.trim() });
                            }
                            setRenamingProjectId(null);
                          } else if (e.key === "Escape") {
                            e.stopPropagation();
                            setRenamingProjectId(null);
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="truncate text-[13px] flex-1 pr-1">
                        {project.title || project.slug || "Untitled"}
                      </span>
                    )}

                    {project.is_pinned && renamingProjectId !== project.id && (
                      <Pin
                        size={11}
                        fill="currentColor"
                        className="shrink-0 mr-0.5 opacity-55"
                        aria-label="Pinned project"
                      />
                    )}

                    <button 
                      type="button"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 text-panel-text hover:text-foreground cursor-pointer shrink-0 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === project.id ? null : project.id);
                      }}
                      title="More options"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center">
                    <button
                      onClick={() => router.push(`/projects/${project.id}/brainstorming`)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-100 dark:bg-zinc-800/80 text-foreground"
                          : "text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                      title={`${project.title || project.slug || "Untitled"}${project.is_pinned ? " (Pinned)" : ""}`}
                    >
                      <Folder size={15} strokeWidth={isActive ? 2 : 1.75} />
                    </button>
                  </div>
                )}

                {/* Dropdown Menu Overlay */}
                {openMenuId === project.id && !isCollapsed && (
                  <div 
                    ref={menuRef}
                    className="absolute right-2 top-8 z-50 bg-card border border-border rounded-lg shadow-xl p-1 w-34 text-[12.5px] animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
                  >
                    <button 
                      className="w-full text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-2.5 py-1.5 cursor-pointer text-foreground flex items-center gap-2 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingProjectId(project.id);
                        setRenamingTitle(project.title || project.slug || "");
                        setOpenMenuId(null);
                      }}
                    >
                      <Pencil size={13} className="opacity-70" />
                      <span>Rename</span>
                    </button>
                    <button
                      className="w-full text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-2.5 py-1.5 cursor-pointer text-foreground flex items-center gap-2 transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        await updateProject(project.id, { is_pinned: !project.is_pinned });
                      }}
                    >
                      {project.is_pinned ? (
                        <PinOff size={13} className="opacity-70" />
                      ) : (
                        <Pin size={13} className="opacity-70" />
                      )}
                      <span>{project.is_pinned ? "Unpin" : "Pin to top"}</span>
                    </button>
                    <button 
                      className="w-full text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded px-2.5 py-1.5 cursor-pointer text-foreground flex items-center gap-2 transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        const dup = await duplicateProject(project.id);
                        if (dup) {
                          router.push(`/projects/${dup.id}/brainstorming`);
                        }
                      }}
                    >
                      <Copy size={13} className="opacity-70" />
                      <span>Duplicate</span>
                    </button>
                    <div className="my-1 border-t border-border/60" />
                    <button 
                      className="w-full text-left text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded px-2.5 py-1.5 cursor-pointer font-medium flex items-center gap-2 transition-colors"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setOpenMenuId(null);
                        if (window.confirm("Are you sure you want to delete this project? This cannot be undone.")) {
                          await deleteExistingProject(project.id);
                          if (pathname?.startsWith(`/projects/${project.id}`)) {
                            router.push("/");
                          }
                        }
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Footer Actions */}
      <div className="p-2 border-t border-border flex flex-col gap-1 shrink-0 w-full">
        {!isCollapsed ? (
          <>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-full h-8 flex items-center gap-2.5 px-2.5 rounded-md text-[12.5px] font-medium text-panel-text hover:text-foreground hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
              title="Engine Settings"
            >
              <Settings size={14} className="opacity-70 shrink-0" />
              <span>Engine Settings</span>
            </button>
            
            <div className="w-full h-8 flex items-center justify-between px-2.5 text-[12.5px]">
              <span className="text-panel-text font-medium text-[12.5px]">Theme</span>
              <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-border/40">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Light mode"
                >
                  <Sun size={12} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-card text-foreground shadow-2xs font-semibold"
                      : "text-panel-text hover:text-foreground"
                  }`}
                  title="Dark mode"
                >
                  <Moon size={12} />
                  <span>Dark</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 w-full">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-md text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Engine Settings"
            >
              <Settings size={15} className="opacity-70" />
            </button>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-md text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div 
          onClick={() => setIsSettingsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 dark:bg-black/60 backdrop-blur-xs p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border p-5 rounded-2xl w-full max-w-md text-foreground animate-in fade-in zoom-in-95 duration-150 shadow-2xl cursor-default flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-panel-text border border-border/40 shrink-0">
                  <Settings size={14} strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-[14.5px] font-semibold tracking-tight text-foreground">Engine Settings</h2>
                  <p className="text-[11px] text-panel-text">Configure inference and image generation engines</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsSettingsOpen(false)}
                className="text-panel-text hover:text-foreground p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
            
            {/* Setting Rows */}
            <div className="space-y-2.5 py-1">
              {/* Row 1: LLM Provider */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background/60 border border-border/50">
                <div>
                  <div className="text-[12.5px] font-medium text-foreground">LLM Provider</div>
                  <div className="text-[11px] text-panel-text">Inference engine for scripts</div>
                </div>
                <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/90 rounded-lg border border-border/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setProvider("gemini")}
                    className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-all cursor-pointer ${
                      provider === "gemini"
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                  >
                    Gemini
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider("groq")}
                    className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-all cursor-pointer ${
                      provider === "groq"
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                  >
                    Groq
                  </button>
                </div>
              </div>

              {/* Row 2: API Key Slot */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background/60 border border-border/50">
                <div>
                  <div className="text-[12.5px] font-medium text-foreground">API Key Slot</div>
                  <div className="text-[11px] text-panel-text">Credential slot</div>
                </div>
                <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/90 rounded-lg border border-border/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSlot(1)}
                    className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-all cursor-pointer ${
                      slot === 1
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                  >
                    Slot 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlot(2)}
                    className={`px-3 py-1 rounded-md text-[11.5px] font-medium transition-all cursor-pointer ${
                      slot === 2
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-panel-text hover:text-foreground"
                    }`}
                  >
                    Slot 2
                  </button>
                </div>
              </div>

              {/* Row 2.5: API Key Input directly from UI */}
              {(() => {
                const currentKeyInfo = keysStatus[`${provider}_${slot}`] || { has_key: false, masked: "" };
                return (
                  <div className="p-3 rounded-xl bg-background/60 border border-border/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Key size={13} className="text-primary" />
                        <span className="text-[12.5px] font-medium text-foreground">
                          {provider === "gemini" ? "Gemini API Key" : "Groq API Key"} (Slot {slot})
                        </span>
                      </div>
                      {currentKeyInfo.has_key ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          <CheckCircle2 size={10} />
                          {currentKeyInfo.masked || "Configured"}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-500 font-medium">Not configured</span>
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={
                          currentKeyInfo.has_key 
                            ? "Paste new key to replace..." 
                            : (provider === "gemini" ? "Paste Gemini key (AIzaSy...)" : "Paste Groq key (gsk_...)")
                        }
                        className="w-full h-8.5 px-3 pr-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[12px] font-mono border border-border/60 text-foreground placeholder:text-panel-text focus:outline-none focus:border-primary/60 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 text-panel-text hover:text-foreground transition-colors p-1"
                        title={showApiKey ? "Hide key" : "Show key"}
                      >
                        {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-panel-text pt-0.5">
                      <span>Saved locally in your environment</span>
                      <a
                        href={provider === "gemini" ? "https://aistudio.google.com/apikey" : "https://console.groq.com/keys"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        Get free key <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                );
              })()}

              {/* Row 3: Image Synthesis Engine */}
              <div className="flex flex-col gap-2 p-3 rounded-xl bg-background/60 border border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[12.5px] font-medium text-foreground">Image Synthesis Engine</div>
                    <div className="text-[11px] text-panel-text">Select provider for scene illustration rendering</div>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    {imageProvider === "agy" ? "AGY Native" : imageProvider === "local" ? "Offline" : imageProvider === "cloud" ? "Cloud" : "MCP"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setImageProvider("agy")}
                    className={`px-2 py-1.5 rounded-lg text-[11.5px] font-medium transition-all text-center cursor-pointer border ${
                      imageProvider === "agy"
                        ? "bg-card text-foreground shadow-2xs font-semibold border-primary/40 ring-1 ring-primary/20"
                        : "bg-background/40 text-panel-text hover:text-foreground border-border/40"
                    }`}
                  >
                    ✨ AGY API
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageProvider("local")}
                    className={`px-2 py-1.5 rounded-lg text-[11.5px] font-medium transition-all text-center cursor-pointer border ${
                      imageProvider === "local"
                        ? "bg-card text-foreground shadow-2xs font-semibold border-primary/40 ring-1 ring-primary/20"
                        : "bg-background/40 text-panel-text hover:text-foreground border-border/40"
                    }`}
                  >
                    💻 Draw Things
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageProvider("cloud")}
                    className={`px-2 py-1.5 rounded-lg text-[11.5px] font-medium transition-all text-center cursor-pointer border ${
                      imageProvider === "cloud"
                        ? "bg-card text-foreground shadow-2xs font-semibold border-primary/40 ring-1 ring-primary/20"
                        : "bg-background/40 text-panel-text hover:text-foreground border-border/40"
                    }`}
                  >
                    ☁️ Cloud Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageProvider("flow")}
                    className={`px-2 py-1.5 rounded-lg text-[11.5px] font-medium transition-all text-center cursor-pointer border ${
                      imageProvider === "flow"
                        ? "bg-card text-foreground shadow-2xs font-semibold border-primary/40 ring-1 ring-primary/20"
                        : "bg-background/40 text-panel-text hover:text-foreground border-border/40"
                    }`}
                  >
                    ⚡ Google Flow
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-3.5 py-1.5 text-[12.5px] font-medium text-panel-text hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200/85 text-zinc-800 hover:text-zinc-950 border border-zinc-200/90 dark:bg-zinc-800/90 dark:hover:bg-zinc-750 dark:text-zinc-100 dark:border-zinc-700/80 font-medium rounded-lg text-[12.5px] shadow-2xs transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
