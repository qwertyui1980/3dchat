/**
 * Landmark Calibration Service for XStreamX 3D Masks Studio
 * Origin: Originally created and developed by XStreamX
 * 
 * Provides:
 * - Landmark density presets (16 Key Points, 32 Expressive Points, 68 Standard Points, 478 Full Mesh)
 * - Draggable key anatomical pins
 * - Elastic Gaussian Radial Basis Function (RBF) landmark deformation
 * - Micro-calibration sliders (Eye distance, Eye height, Mouth width, Mouth height, Eyebrow height, Chin)
 * - Custom Avatar Tracking Profile generator for Lobby & Room HUD
 */

import { AvatarTrackingProfile } from '../../types';

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type LandmarkDensity = 16 | 32 | 68;

export interface KeyPinDefinition {
  id: string;
  index: number;
  label: string;
  group: 'eyes' | 'mouth' | 'brows' | 'nose' | 'jaw';
  color: string;
  radius: number; // Influence radius in normalized coords (0 to 1)
}

// Key anatomical pin definitions that the user can drag interactively
export const KEY_CALIBRATION_PINS: KeyPinDefinition[] = [
  // Mouth
  { id: 'mouth_left', index: 61, label: 'Comisura Izq', group: 'mouth', color: '#f43f5e', radius: 0.08 },
  { id: 'mouth_right', index: 291, label: 'Comisura Der', group: 'mouth', color: '#f43f5e', radius: 0.08 },
  { id: 'mouth_upper', index: 13, label: 'Labio Sup', group: 'mouth', color: '#fb7185', radius: 0.07 },
  { id: 'mouth_lower', index: 14, label: 'Labio Inf', group: 'mouth', color: '#fb7185', radius: 0.07 },

  // Eyes & Iris (5 points per eye: Pupil, Upper, Lower, Outer, Inner)
  { id: 'eye_left_center', index: 468, label: 'Pupila Izq (Centro)', group: 'eyes', color: '#38bdf8', radius: 0.09 },
  { id: 'eye_left_upper', index: 159, label: 'Párpado Sup Izq', group: 'eyes', color: '#0ea5e9', radius: 0.07 },
  { id: 'eye_left_lower', index: 145, label: 'Párpado Inf Izq', group: 'eyes', color: '#0ea5e9', radius: 0.07 },
  { id: 'eye_left_outer', index: 33, label: 'Ojo Izq Ext (Lat)', group: 'eyes', color: '#0284c7', radius: 0.07 },
  { id: 'eye_left_inner', index: 133, label: 'Ojo Izq Int (Lat)', group: 'eyes', color: '#0284c7', radius: 0.06 },

  { id: 'eye_right_center', index: 473, label: 'Pupila Der (Centro)', group: 'eyes', color: '#38bdf8', radius: 0.09 },
  { id: 'eye_right_upper', index: 386, label: 'Párpado Sup Der', group: 'eyes', color: '#0ea5e9', radius: 0.07 },
  { id: 'eye_right_lower', index: 374, label: 'Párpado Inf Der', group: 'eyes', color: '#0ea5e9', radius: 0.07 },
  { id: 'eye_right_inner', index: 362, label: 'Ojo Der Int (Lat)', group: 'eyes', color: '#0284c7', radius: 0.06 },
  { id: 'eye_right_outer', index: 263, label: 'Ojo Der Ext (Lat)', group: 'eyes', color: '#0284c7', radius: 0.07 },

  // Eyebrows
  { id: 'brow_left_peak', index: 105, label: 'Arco Ceja Izq', group: 'brows', color: '#06b6d4', radius: 0.08 },
  { id: 'brow_right_peak', index: 334, label: 'Arco Ceja Der', group: 'brows', color: '#06b6d4', radius: 0.08 },
  { id: 'brow_left_inner', index: 70, label: 'Ceja Izq Int', group: 'brows', color: '#06b6d4', radius: 0.06 },
  { id: 'brow_right_inner', index: 300, label: 'Ceja Der Int', group: 'brows', color: '#06b6d4', radius: 0.06 },

  // Nose
  { id: 'nose_tip', index: 1, label: 'Punta Nariz', group: 'nose', color: '#f59e0b', radius: 0.07 },
  { id: 'nose_bridge', index: 168, label: 'Entrecejo', group: 'nose', color: '#f59e0b', radius: 0.07 },

  // Jaw & Silhouette
  { id: 'chin_bottom', index: 152, label: 'Mentón / Barbilla', group: 'jaw', color: '#a855f7', radius: 0.12 },
  { id: 'cheek_left', index: 234, label: 'Pómulo Izq', group: 'jaw', color: '#9333ea', radius: 0.10 },
  { id: 'cheek_right', index: 454, label: 'Pómulo Der', group: 'jaw', color: '#9333ea', radius: 0.10 },
  { id: 'forehead_top', index: 10, label: 'Frente', group: 'jaw', color: '#8b5cf6', radius: 0.12 },
];

// Presets of Active Indices for each Density Level
export const DENSITY_INDICES: Record<LandmarkDensity, number[]> = {
  16: [
    // 4 Mouth
    61, 291, 13, 14,
    // 10 Eyes (5 points per eye: center/pupil, upper, lower, outer, inner)
    468, 159, 145, 33, 133,
    473, 386, 374, 263, 362,
    // 2 Brows
    105, 334,
    // 2 Nose
    1, 168,
    // 4 Contour
    10, 152, 234, 454,
  ],
  32: [
    // 10 Mouth
    61, 291, 13, 14, 0, 17, 78, 308, 82, 312,
    // 10 Eyes (5 points per eye: center/pupil, upper, lower, outer, inner)
    468, 159, 145, 33, 133,
    473, 386, 374, 263, 362,
    // 6 Brows
    70, 105, 107, 300, 334, 336,
    // 4 Nose
    1, 168, 98, 327,
    // 6 Jaw / Face
    10, 152, 234, 454, 127, 356,
  ],
  68: [
    // Classical 68-point Dlib / FACS benchmark + 5 eye points
    // Jaw (0-16): 17 points
    234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 454,
    // Eyebrows (17-26): 10 points
    70, 63, 105, 66, 107, 336, 296, 334, 293, 300,
    // Nose (27-35): 9 points
    168, 6, 197, 195, 5, 4, 1, 98, 327,
    // Eyes (36-47): 14 points (including irises + top/bottom)
    33, 160, 159, 158, 133, 153, 145, 144, 468,
    362, 385, 386, 387, 263, 373, 374, 380, 473,
    // Mouth Outer & Inner (48-67): 20 points
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
    78, 82, 13, 312, 308, 317, 14, 87,
  ],
};

export interface LandmarkMicroAdjustments {
  eyeSpacing: number;     // -0.05 to +0.05 (interpupillary distance)
  eyeOffsetY: number;     // -0.05 to +0.05 (vertical position)
  eyeOpening: number;     // -0.04 to +0.06 (palpebral vertical aperture / eye opening)
  browOffsetY: number;    // -0.05 to +0.05 (brow height)
  mouthOffsetY: number;   // -0.05 to +0.05 (mouth height)
  mouthWidthScale: number;// 0.80 to 1.25 (mouth width factor)
  chinOffsetY: number;    // -0.05 to +0.05 (chin length)
}

export const DEFAULT_MICRO_ADJUSTMENTS: LandmarkMicroAdjustments = {
  eyeSpacing: 0,
  eyeOffsetY: 0,
  eyeOpening: 0,
  browOffsetY: 0,
  mouthOffsetY: 0,
  mouthWidthScale: 1.0,
  chinOffsetY: 0,
};

/**
 * Applies smooth Radial Basis Function (RBF) deformation to all 478 landmarks
 * based on user pin movements and micro-adjustments.
 */
export function applyLandmarkCalibration(
  baseLandmarks: Point3D[],
  pinDeltas: Record<number, { dx: number; dy: number }>,
  adjustments: LandmarkMicroAdjustments
): Point3D[] {
  if (!baseLandmarks || baseLandmarks.length === 0) return [];

  // Deep clone to avoid mutating original
  const result: Point3D[] = baseLandmarks.map((pt) => ({ ...pt }));

  // Find anatomical reference centers
  const mouthCenter = {
    x: (baseLandmarks[61].x + baseLandmarks[291].x) * 0.5,
    y: (baseLandmarks[13].y + baseLandmarks[14].y) * 0.5,
  };
  const eyeCenterL = { x: baseLandmarks[468]?.x ?? baseLandmarks[33].x, y: baseLandmarks[468]?.y ?? baseLandmarks[33].y };
  const eyeCenterR = { x: baseLandmarks[473]?.x ?? baseLandmarks[263].x, y: baseLandmarks[473]?.y ?? baseLandmarks[263].y };

  // 1. Apply Pin Deltas with Gaussian RBF Falloff
  const pinEntries = Object.entries(pinDeltas);
  if (pinEntries.length > 0) {
    pinEntries.forEach(([idxStr, delta]) => {
      if (Math.abs(delta.dx) < 0.0001 && Math.abs(delta.dy) < 0.0001) return;
      const pinIndex = Number(idxStr);
      const pinDef = KEY_CALIBRATION_PINS.find((p) => p.index === pinIndex);
      const radius = pinDef?.radius || 0.08;
      const twoSigmaSq = 2 * (radius * radius);

      const pinBase = baseLandmarks[pinIndex];
      if (!pinBase) return;

      for (let i = 0; i < result.length; i++) {
        const pt = baseLandmarks[i];
        const distSq = (pt.x - pinBase.x) ** 2 + (pt.y - pinBase.y) ** 2;
        if (distSq < radius * radius * 4) {
          const weight = Math.exp(-distSq / twoSigmaSq);
          result[i].x += delta.dx * weight;
          result[i].y += delta.dy * weight;
        }
      }
    });
  }

  // 2. Apply Micro-Adjustments (Eye Spacing, Eye Y, Eye Opening, Brow Y, Mouth Width, Mouth Y, Chin Y)
  const { eyeSpacing, eyeOffsetY, eyeOpening = 0, browOffsetY, mouthOffsetY, mouthWidthScale, chinOffsetY } = adjustments;

  for (let i = 0; i < result.length; i++) {
    const pt = baseLandmarks[i];

    // Left Eye Zone
    const distToEyeL = Math.hypot(pt.x - eyeCenterL.x, pt.y - eyeCenterL.y);
    if (distToEyeL < 0.14) {
      const w = Math.max(0, 1 - distToEyeL / 0.14) ** 2;
      result[i].x -= eyeSpacing * 0.5 * w;
      result[i].y += eyeOffsetY * w;

      // Eye Opening (Palpebral aperture): upper lids move up (-y), lower lids move down (+y)
      if (Math.abs(eyeOpening) > 0.0001) {
        const dyFromCenter = pt.y - eyeCenterL.y;
        if (dyFromCenter < -0.005) {
          // Upper eyelid region
          const openW = Math.max(0, 1 - Math.abs(pt.x - eyeCenterL.x) / 0.09) * Math.min(1, Math.abs(dyFromCenter) / 0.03);
          result[i].y -= eyeOpening * 0.5 * openW;
        } else if (dyFromCenter > 0.005) {
          // Lower eyelid region
          const openW = Math.max(0, 1 - Math.abs(pt.x - eyeCenterL.x) / 0.09) * Math.min(1, Math.abs(dyFromCenter) / 0.03);
          result[i].y += eyeOpening * 0.5 * openW;
        }
      }
    }

    // Right Eye Zone
    const distToEyeR = Math.hypot(pt.x - eyeCenterR.x, pt.y - eyeCenterR.y);
    if (distToEyeR < 0.14) {
      const w = Math.max(0, 1 - distToEyeR / 0.14) ** 2;
      result[i].x += eyeSpacing * 0.5 * w;
      result[i].y += eyeOffsetY * w;

      // Eye Opening (Palpebral aperture): upper lids move up (-y), lower lids move down (+y)
      if (Math.abs(eyeOpening) > 0.0001) {
        const dyFromCenter = pt.y - eyeCenterR.y;
        if (dyFromCenter < -0.005) {
          // Upper eyelid region
          const openW = Math.max(0, 1 - Math.abs(pt.x - eyeCenterR.x) / 0.09) * Math.min(1, Math.abs(dyFromCenter) / 0.03);
          result[i].y -= eyeOpening * 0.5 * openW;
        } else if (dyFromCenter > 0.005) {
          // Lower eyelid region
          const openW = Math.max(0, 1 - Math.abs(pt.x - eyeCenterR.x) / 0.09) * Math.min(1, Math.abs(dyFromCenter) / 0.03);
          result[i].y += eyeOpening * 0.5 * openW;
        }
      }
    }

    // Eyebrows Zone
    if ((pt.y < eyeCenterL.y || pt.y < eyeCenterR.y) && (distToEyeL < 0.18 || distToEyeR < 0.18)) {
      const w = Math.max(0, 1 - Math.min(distToEyeL, distToEyeR) / 0.18) ** 2;
      result[i].y += browOffsetY * w;
    }

    // Mouth Zone
    const distToMouth = Math.hypot(pt.x - mouthCenter.x, pt.y - mouthCenter.y);
    if (distToMouth < 0.18) {
      const w = Math.max(0, 1 - distToMouth / 0.18) ** 2;
      result[i].y += mouthOffsetY * w;
      if (mouthWidthScale !== 1.0) {
        result[i].x = mouthCenter.x + (result[i].x - mouthCenter.x) * (1 + (mouthWidthScale - 1) * w);
      }
    }

    // Chin / Mandible Zone
    const distToChin = Math.hypot(pt.x - baseLandmarks[152].x, pt.y - baseLandmarks[152].y);
    if (distToChin < 0.16) {
      const w = Math.max(0, 1 - distToChin / 0.16) ** 2;
      result[i].y += chinOffsetY * w;
    }
  }

  return result;
}

/**
 * Creates an anatomical, high-contrast tracking profile for custom 3D Masks models
 * using the chosen point density, active indices, and theme colors.
 */
export function buildCustomAvatarTrackingProfile(params: {
  avatarId: string;
  name: string;
  density: LandmarkDensity;
  themeColor?: string;
  activeIndices?: number[];
}): AvatarTrackingProfile {
  const { avatarId, name, density, themeColor = '#06b6d4' } = params;
  const indices = params.activeIndices || DENSITY_INDICES[density] || DENSITY_INDICES[32];

  // Distinct contours based on selected density
  const contours: AvatarTrackingProfile['contours'] = [];

  // Always include lips contour if indices are available
  contours.push({
    name: 'calibrated_lips',
    indices: [61, 13, 291, 14, 61],
    isClosed: true,
    color: '#22d3ee',
    width: 2.0,
  });

  // Eyes contour
  contours.push({
    name: 'calibrated_eyes',
    indices: [33, 133, 168, 362, 263],
    color: themeColor,
    width: 1.8,
  });

  if (density >= 32) {
    // Eyebrows contours
    contours.push({
      name: 'calibrated_brow_l',
      indices: [70, 105, 107],
      color: themeColor,
      width: 1.5,
    });
    contours.push({
      name: 'calibrated_brow_r',
      indices: [300, 334, 336],
      color: themeColor,
      width: 1.5,
    });
    // Jawline
    contours.push({
      name: 'calibrated_jaw',
      indices: [234, 152, 454],
      color: '#a855f7',
      width: 1.5,
    });
  }

  return {
    avatarId,
    name: name || '3D Mask Avatar',
    pointsCount: indices.length,
    badge: `${indices.length} Pts Calibrados`,
    description: `Perfil de tracking facial con calibración manual (${indices.length} puntos)`,
    color: themeColor,
    dotColor: '#22d3ee',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    activeIndices: indices,
    contours,
  };
}
