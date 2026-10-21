import { FaceFeatures, DynamicTrackingMode } from '../../types';

export type CanonicalTrackingMode = 'parafernalia' | 'gestures' | 'lipsync';

/**
 * Normaliza cualquier identificador o alias de modo al nombre canónico oficial:
 * - 'parafernalia' (o 'hybrid'): Modo divertido, voz + ritmo + zoom dinámico
 * - 'gestures' (o 'camera_only'): 100% visión y reconocimiento de gestos de cámara, sin alteración por audio
 * - 'lipsync' (o 'audio_only'): Máscara estática, animación exclusiva de labios y boca por audio sin requerir video
 */
export function normalizeTrackingMode(mode?: DynamicTrackingMode | string): CanonicalTrackingMode {
  if (mode === 'gestures' || mode === 'camera_only') return 'gestures';
  if (mode === 'lipsync' || mode === 'audio_only') return 'lipsync';
  return 'parafernalia';
}

export interface TrackingModeConfig {
  id: DynamicTrackingMode;
  canonicalId: CanonicalTrackingMode;
  label: string;
  sublabel: string;
  description: string;
  color: string;
  badge: string;
  icon: 'sparkles' | 'scanFace' | 'radio';
}

const BASE_CONFIGS: Record<CanonicalTrackingMode, TrackingModeConfig> = {
  parafernalia: {
    id: 'parafernalia',
    canonicalId: 'parafernalia',
    label: 'Parafernalia',
    sublabel: 'Voz, Ritmo & Zoom',
    description: 'Modo divertido: la máscara se mueve al ritmo de la voz, con gestos faciales y zoom dinámico reactivo',
    color: '#ffe600',
    badge: 'Parafernalia',
    icon: 'sparkles',
  },
  gestures: {
    id: 'gestures',
    canonicalId: 'gestures',
    label: 'Emo',
    sublabel: 'Face tracking',
    description: 'Reconoce única y exclusivamente gestos faciales por cámara y los iguala en el avatar',
    color: '#3b82f6',
    badge: 'Emo',
    icon: 'scanFace',
  },
  lipsync: {
    id: 'lipsync',
    canonicalId: 'lipsync',
    label: 'Lip Sync',
    sublabel: 'Solo Labios y Boca',
    description: 'Máscara estática: el audio anima únicamente la sección de los labios y la boca, sin requerir video',
    color: '#f43f5e',
    badge: 'Lip Sync',
    icon: 'radio',
  },
};

export const TRACKING_MODES_CONFIG: Record<DynamicTrackingMode, TrackingModeConfig> = {
  parafernalia: BASE_CONFIGS.parafernalia,
  gestures: BASE_CONFIGS.gestures,
  lipsync: BASE_CONFIGS.lipsync,
  // Compatibilidad hacia atrás con identificadores previos:
  hybrid: { ...BASE_CONFIGS.parafernalia, id: 'hybrid' },
  camera_only: { ...BASE_CONFIGS.gestures, id: 'camera_only' },
  audio_only: { ...BASE_CONFIGS.lipsync, id: 'audio_only' },
};

/**
 * Lista ordenada oficial de modos para renderizar selectores y conmutadores en UI
 */
export const OFFICIAL_TRACKING_MODES: CanonicalTrackingMode[] = [
  'parafernalia',
  'gestures',
  'lipsync',
];

export type QuickGestureType = 'smile' | 'surprise' | 'wink' | 'furrow' | 'pucker' | 'neutral';

export interface QuickGestureConfig {
  id: QuickGestureType;
  emoji: string;
  label: string;
}

export const QUICK_GESTURES: QuickGestureConfig[] = [
  { id: 'smile', emoji: '😊', label: 'Sonrisa' },
  { id: 'surprise', emoji: '😲', label: 'Sorpresa' },
  { id: 'wink', emoji: '😉', label: 'Guiño' },
  { id: 'furrow', emoji: '😠', label: 'Ceño' },
];

/**
 * Superpone un gesto facial rápido sobre las características faciales (features)
 * y su diccionario ARKit blendshapes correspondiente.
 */
export function applyQuickGesture(
  features: FaceFeatures,
  gesture?: QuickGestureType | null
): FaceFeatures {
  if (!gesture || gesture === 'neutral') {
    return features;
  }

  const baseBlendshapes = { ...(features.blendshapes || {}) };

  switch (gesture) {
    case 'smile':
      return {
        ...features,
        mouthSmile: 0.95,
        mouthSmileLeft: 0.95,
        mouthSmileRight: 0.95,
        blendshapes: {
          ...baseBlendshapes,
          mouthSmileLeft: 0.95,
          mouthSmileRight: 0.95,
          cheekSquintLeft: 0.4,
          cheekSquintRight: 0.4,
        },
      };

    case 'surprise':
      return {
        ...features,
        jawOpen: 0.65,
        browRaise: 0.9,
        eyeWideLeft: 0.85,
        eyeWideRight: 0.85,
        eyeBlinkLeft: 0,
        eyeBlinkRight: 0,
        blendshapes: {
          ...baseBlendshapes,
          jawOpen: 0.65,
          browInnerUp: 0.9,
          browOuterUpLeft: 0.7,
          browOuterUpRight: 0.7,
          eyeWideLeft: 0.85,
          eyeWideRight: 0.85,
          eyeBlinkLeft: 0,
          eyeBlinkRight: 0,
        },
      };

    case 'wink':
      return {
        ...features,
        eyeBlinkLeft: 1.0,
        mouthSmileLeft: 0.7,
        mouthSmile: 0.5,
        blendshapes: {
          ...baseBlendshapes,
          eyeBlinkLeft: 1.0,
          mouthSmileLeft: 0.7,
          browDownLeft: 0.3,
        },
      };

    case 'furrow':
      return {
        ...features,
        browFurrow: 0.95,
        browRaise: 0,
        mouthSmile: -0.3,
        mouthSmileLeft: -0.3,
        mouthSmileRight: -0.3,
        blendshapes: {
          ...baseBlendshapes,
          browDownLeft: 0.95,
          browDownRight: 0.95,
          eyeSquintLeft: 0.5,
          eyeSquintRight: 0.5,
          mouthFrownLeft: 0.3,
          mouthFrownRight: 0.3,
        },
      };

    case 'pucker':
      return {
        ...features,
        mouthPucker: 1.0,
        blendshapes: {
          ...baseBlendshapes,
          mouthPucker: 1.0,
          mouthFunnel: 0.6,
        },
      };

    default:
      return features;
  }
}

/**
 * Aplica el modo dinámico seleccionado a las características faciales (features),
 * ajusta desplazamientos de calibración (offsets) y sensibilidad, y opcionalmente
 * superpone un gesto facial manual activado desde la interfaz.
 */
export function applyDynamicMode(
  rawFeatures: FaceFeatures,
  rawMode: DynamicTrackingMode = 'parafernalia',
  sensitivity: number = 1.0,
  cameraOffsetX: number = 0,
  cameraOffsetY: number = 0,
  gesture?: QuickGestureType | null
): FaceFeatures {
  const mode = normalizeTrackingMode(rawMode);
  const scaledYaw = (rawFeatures.yaw + cameraOffsetX) * sensitivity;
  const scaledPitch = (rawFeatures.pitch + cameraOffsetY) * sensitivity;

  let modeFeatures: FaceFeatures;

  switch (mode) {
    case 'gestures':
      // Modo 2: Reconocimiento de Gestos
      // Única y exclusivamente reconoce gestos con la cámara y los iguala en el avatar.
      // El audio NO afecta la máscara (audioVolume forzado estrictamente a 0).
      modeFeatures = {
        ...rawFeatures,
        trackingMode: 'gestures',
        yaw: scaledYaw,
        pitch: scaledPitch,
        audioVolume: 0,
      };
      break;

    case 'lipsync':
      // Modo 3: Lip Sync
      // Deja la máscara estática (cabeza fija/centrada, sin rotación ni cejas/ojos).
      // El audio anima únicamente la sección de los labios y la boca sin requerir video.
      // Inicia y mantiene la boca cerrada por defecto; solo sonido vocal relevante la articula.
      modeFeatures = {
        ...rawFeatures,
        trackingMode: 'lipsync',
        isFaceDetected: false,
        yaw: 0,
        pitch: 0,
        roll: 0,
        gazeX: 0,
        gazeY: 0,
        eyeBlinkLeft: 0,
        eyeBlinkRight: 0,
        browRaise: 0,
        browFurrow: 0,
        jawOpen: 0,
        mouthSmile: 0,
        mouthSmileLeft: 0,
        mouthSmileRight: 0,
        mouthPucker: 0,
        audioVolume: rawFeatures.audioVolume,
      };
      break;

    case 'parafernalia':
    default:
      // Modo 1: Parafernalia (Modo divertido)
      // Mueve la máscara al ritmo de la voz con gestos faciales y zoom dinámico reactivo
      modeFeatures = {
        ...rawFeatures,
        trackingMode: 'parafernalia',
        yaw: scaledYaw,
        pitch: scaledPitch,
        audioVolume: rawFeatures.audioVolume,
      };
      break;
  }

  return applyQuickGesture(modeFeatures, gesture);
}
