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
    color: '#06b6d4',
    badge: 'Parafernalia',
    icon: 'sparkles',
  },
  gestures: {
    id: 'gestures',
    canonicalId: 'gestures',
    label: 'Reconocimiento de Gestos',
    sublabel: 'Visión 100% Cámara',
    description: 'Reconoce única y exclusivamente gestos faciales por cámara y los iguala en el avatar',
    color: '#10b981',
    badge: 'Gestos',
    icon: 'scanFace',
  },
  lipsync: {
    id: 'lipsync',
    canonicalId: 'lipsync',
    label: 'Lip Sync',
    sublabel: 'Solo Labios y Boca',
    description: 'Máscara estática: el audio anima únicamente la sección de los labios y la boca, sin requerir video',
    color: '#f59e0b',
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

/**
 * Aplica el modo dinámico seleccionado a las características faciales (features)
 * y ajusta los desplazamientos de calibración (offsets) y sensibilidad.
 */
export function applyDynamicMode(
  rawFeatures: FaceFeatures,
  rawMode: DynamicTrackingMode = 'parafernalia',
  sensitivity: number = 1.0,
  cameraOffsetX: number = 0,
  cameraOffsetY: number = 0
): FaceFeatures {
  const mode = normalizeTrackingMode(rawMode);
  const scaledYaw = (rawFeatures.yaw + cameraOffsetX) * sensitivity;
  const scaledPitch = (rawFeatures.pitch + cameraOffsetY) * sensitivity;

  switch (mode) {
    case 'gestures':
      // Modo 2: Reconocimiento de Gestos
      // Única y exclusivamente reconoce gestos con la cámara y los iguala en el avatar.
      // El audio NO afecta la máscara (audioVolume forzado estrictamente a 0).
      return {
        ...rawFeatures,
        trackingMode: 'gestures',
        yaw: scaledYaw,
        pitch: scaledPitch,
        audioVolume: 0,
      };

    case 'lipsync':
      // Modo 3: Lip Sync
      // Deja la máscara estática (cabeza fija/centrada, sin rotación ni cejas/ojos).
      // El audio anima únicamente la sección de los labios y la boca sin requerir video.
      return {
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
        audioVolume: rawFeatures.audioVolume,
      };

    case 'parafernalia':
    default:
      // Modo 1: Parafernalia (Modo divertido)
      // Mueve la máscara al ritmo de la voz con gestos faciales y zoom dinámico reactivo
      return {
        ...rawFeatures,
        trackingMode: 'parafernalia',
        yaw: scaledYaw,
        pitch: scaledPitch,
        audioVolume: rawFeatures.audioVolume,
      };
  }
}
