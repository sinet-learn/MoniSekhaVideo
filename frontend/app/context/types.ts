 
export interface SceneData {
  id: number;
  project_id: number;
  scene_number: number;
  narration_khmer: string | null;
  image_prompt_english: string | null;
  video_prompt?: string | null;
  video_status?: string;
  video_error?: string | null;
  video_model?: string | null;
  negative_prompt: string | null;
  user_refinement_prompt: string | null;
  image_path: string | null;
  images_list?: string | string[];
  reference_images?: string | string[];
  image_status: string;
  audio_path: string | null;
  audio_status: string;
  audio_text?: string | null;
  audio_error?: string | null;
  audio_duration?: number;
  character_id?: number;
  character_name?: string;
}

export interface Project {
  id: number;
  title: string;
  slug: string;
  is_pinned?: boolean;
  raw_research: string | null;
  script_narrative: string | null;
  video_concept: string | null;
  visual_mode?: "images" | "video";
  illustration_style: string | null;
  global_voice_style: string | null;
  structured_json_data: string | object | null;
  master_audio_path?: string;
  voice_profile_tag?: string;
  voice_provider?: "voxcpm2" | "gemini";
  gemini_voice_name?: string;
  gemini_voice_style?: string;
  audio_format?: string;
  voice_cfg_value?: number;
  voice_inference_steps?: number;
  theme_era?: string | null;
  theme_region?: string | null;
  theme_mood?: string | null;
  theme_custom?: string | null;
  aspect_ratio?: string | null;
  character_attire?: string | null;
  scene_staging?: string | null;
  art_style?: string | null;
  flow_project_id?: string | null;
  timeline_data?: string | null;
  scenes: SceneData[];
}
