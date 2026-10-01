export type AvatarId =
  | 'three_robot'
  | 'cat_3d'
  | 'dog_3d'
  | 'female_3d'
  | 'horse_3d'
  | 'fox_sensei'
  | 'mesh_outline'
  | 'cyber_nova'
  | 'bot_9000'
  | 'pixel_punk'
  | 'astro_cadet'
  | 'face_cap';

export interface AvatarTrackingProfile {
  avatarId: AvatarId;
  name: string;
  pointsCount: number;
  badge: string;
  description: string;
  color: string;
  dotColor: string;
  glowColor?: string;
  activeIndices: number[];
  contours: Array<{
    name: string;
    indices: number[];
    isClosed?: boolean;
    color?: string;
    width?: number;
  }>;
  // 3D Anchor points placed directly on the avatar's 3D anatomy (ears, snout, eyes, visor, etc.)
  mesh3DPoints?: Array<{
    name: string;
    localPos: [number, number, number];
    indexRef?: number;
    color?: string;
    size?: number;
  }>;
}

export interface AvatarDefinition {
  id: AvatarId;
  name: string;
  tagline: string;
  category: 'Sci-Fi' | 'Anime' | 'Robot' | 'Retro' | 'Fantasy' | 'Animals' | 'Character';
  themeColor: string;
  accentColor: string;
  badge: string;
  emoji?: string;
  trackingProfile?: AvatarTrackingProfile;
}

export interface FaceFeatures {
  // Head pose (degrees or normalized -1 to 1)
  pitch: number;      // -1 (down) to 1 (up)
  yaw: number;        // -1 (left) to 1 (right)
  roll: number;       // -1 (tilt left) to 1 (tilt right)

  // Eyes
  eyeBlinkLeft: number;   // 0 (open) to 1 (closed)
  eyeBlinkRight: number;  // 0 (open) to 1 (closed)
  eyeWideLeft: number;
  eyeWideRight: number;
  gazeX: number;          // -1 (look left) to 1 (look right)
  gazeY: number;          // -1 (look up) to 1 (look down)

  // Eyebrows
  browRaise: number;      // 0 (neutral) to 1 (raised)
  browFurrow: number;     // 0 (neutral) to 1 (furrowed/angry)

  // Mouth & Detailed Capture Points
  jawOpen: number;        // 0 (closed) to 1 (wide open)
  mouthSmile: number;     // -1 (frown) to 1 (smile)
  mouthSmileLeft?: number;
  mouthSmileRight?: number;
  mouthOpenCenter?: number;
  mouthOpenLeft?: number;
  mouthOpenRight?: number;
  mouthPucker: number;    // 0 (neutral) to 1 (pucker/kiss)
  mouthX: number;         // -1 (mouth skew left) to 1 (skew right)
  mouthPointsCount?: number;

  // Audio / Speech Reactivity
  audioVolume: number;    // 0 to 1

  // Status & Telemetry
  isFaceDetected: boolean;
  blendshapes?: Record<string, number>;
  fps?: number;
  latencyMs?: number;
}

export interface User {
  id: string;
  name: string;
  avatarId: AvatarId;
  role: 'admin' | 'participant';
  roomId: string;
  isMuted: boolean;
  isCameraActive: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  adminId: string;
  isLocked: boolean;
  isAllMuted?: boolean;
  participants: User[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  role: 'admin' | 'participant';
  text: string;
  reaction?: string;
  timestamp: number;
}

export type ViewLayoutMode = 'grid' | 'speaker_focus' | 'stage';

export interface VideoQueueItem {
  id: string;
  url: string;
  videoId: string;
  title: string;
  thumbnailUrl: string;
  durationSec?: number;
  addedByUserId: string;
  addedByUserName: string;
  addedAt: number;
}

export interface RoomMediaState {
  currentVideo: VideoQueueItem | null;
  queue: VideoQueueItem[];
  isPlaying: boolean;
  playbackTime: number; // in seconds
  lastSyncTimestamp: number; // Date.now() when playbackTime was reported
  syncedByUserId: string;
}
