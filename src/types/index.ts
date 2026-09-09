export const STAGES = [
  "intake",
  "research",
  "fact_check",
  "concept",
  "outline",
  "script",
  "storyboard",
  "assets",
  "voice",
  "music",
  "captions",
  "assembly",
  "qc",
  "render",
  "packaging",
  "final_review",
  "awaiting_approval",
  "complete",
  "failed",
  "paused",
  "cancelled",
] as const;

export type Stage = (typeof STAGES)[number];

export type ApprovalMode =
  | "full_automatic"
  | "approve_before_render"
  | "approve_final"
  | "approve_expensive";

export type VideoFormat =
  | "youtube_long"
  | "youtube_shorts"
  | "tiktok"
  | "instagram_reels"
  | "documentary"
  | "educational"
  | "storytelling"
  | "news_explainer"
  | "list"
  | "historical"
  | "faceless";

export type AspectRatio = "16:9" | "9:16" | "1:1";
export type ClaimCertainty = "KNOWN" | "SUPPORTED" | "INFERRED" | "UNCERTAIN";
export type ErrorClass =
  | "TEMPORARY"
  | "QUOTA"
  | "AUTHENTICATION"
  | "INVALID_REQUEST"
  | "PROVIDER_FAILURE"
  | "QUALITY_FAILURE"
  | "LICENSE_FAILURE"
  | "UNKNOWN";

export type MediaKind = "user" | "stock_video" | "stock_image" | "public_domain" | "graphic" | "ai_image" | "ai_video";

export interface CreateJobRequest {
  topic: string;
  format: VideoFormat;
  durationSec: number;
  audience: string;
  tone: string;
  language: string;
  voice: string;
  visualStyle: string;
  musicStyle: string;
  qualityLevel: "draft" | "standard" | "high";
  budgetUsd: number;
  approvalMode: ApprovalMode;
  aspectRatio: AspectRatio;
  demo?: boolean;
}

export interface SourceRecord {
  id: string;
  title: string;
  url: string;
  publisher: string;
  tier: 1 | 2 | 3;
  excerpt: string;
  retrievedAt: string;
  license?: string;
}

export interface Claim {
  id: string;
  text: string;
  certainty: ClaimCertainty;
  sourceIds: string[];
  notes?: string;
}

export interface ResearchPackage {
  topic: string;
  questions: string[];
  sources: SourceRecord[];
  claims: Claim[];
  conflicts: { claimA: string; claimB: string; note: string }[];
  summary: string;
}

export interface ScriptSceneHint {
  heading: string;
  narration: string;
  visualObjective: string;
}

export interface ScriptPackage {
  title: string;
  concept: string;
  hook: string;
  outline: { act: string; beats: string[] }[];
  draft: string;
  finalNarration: string;
  scenes: ScriptSceneHint[];
  wordCount: number;
}

export interface ScenePlan {
  id: string;
  index: number;
  narration: string;
  estimatedDurationSec: number;
  visualObjective: string;
  visualKeywords: string[];
  preferredMediaType: MediaKind;
  transition: "cut" | "crossfade" | "fade_black";
  cameraMotion: "static" | "zoom_in" | "zoom_out" | "pan_left" | "pan_right";
  textOverlay?: string;
  musicMood: string;
  claimIds: string[];
}

export interface LicensedAsset {
  id: string;
  sceneId: string;
  kind: MediaKind;
  path: string;
  sourceUrl?: string;
  title: string;
  creator: string;
  license: string;
  attribution: string;
  width?: number;
  height?: number;
  durationSec?: number;
  relevance: number;
}

export interface VoiceTrack {
  sceneId: string;
  path: string;
  durationSec: number;
  voice: string;
  provider: string;
}

export interface CaptionCue {
  startSec: number;
  endSec: number;
  text: string;
  words: { word: string; startSec: number; endSec: number }[];
}

export interface QcScores {
  factual: number;
  audio: number;
  visual: number;
  pacing: number;
  captions: number;
  overall: number;
  issues: QcIssue[];
}

export interface QcIssue {
  code: string;
  severity: "info" | "warn" | "error";
  message: string;
  sceneId?: string;
  autoFixable: boolean;
}

export interface YoutubePackage {
  titles: string[];
  description: string;
  tags: string[];
  chapters: { time: string; title: string }[];
  thumbnailPath?: string;
  thumbnailConcepts: string[];
  socialDescription: string;
  shortFormSuggestions: string[];
}

export interface CostRecord {
  provider: string;
  operation: string;
  estimatedUsd: number;
  actualUsd: number;
  tokensIn?: number;
  tokensOut?: number;
  paid: boolean;
}

export interface JobEvent {
  ts: string;
  jobId: string;
  stage: Stage;
  provider?: string;
  message: string;
  durationMs?: number;
  costUsd?: number;
  retry?: number;
  errorClass?: ErrorClass;
  data?: Record<string, unknown>;
}

export interface ProjectManifest {
  projectId: string;
  jobId: string;
  request: CreateJobRequest;
  stage: Stage;
  createdAt: string;
  updatedAt: string;
  research?: ResearchPackage;
  script?: ScriptPackage;
  scenes?: ScenePlan[];
  assets?: LicensedAsset[];
  voices?: VoiceTrack[];
  captions?: CaptionCue[];
  musicPath?: string;
  musicMeta?: {
    title: string;
    creator: string;
    license: string;
    attribution: string;
    mood: string;
    bpm?: number;
  };
  qc?: QcScores;
  youtube?: YoutubePackage;
  renderPath?: string;
  previewPath?: string;
  costs: CostRecord[];
  warnings: string[];
  retries: number;
  humanApprovalRequired: boolean;
  approvedAt?: string;
}

export interface ProviderHealth {
  id: string;
  kind: string;
  configured: boolean;
  free: boolean;
  lastError?: string;
  lastLatencyMs?: number;
  qualityScore: number;
  availabilityScore: number;
  freeQuotaScore: number;
  speedScore: number;
  costScore: number;
  calls: number;
  failures: number;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmResult {
  text: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
}
