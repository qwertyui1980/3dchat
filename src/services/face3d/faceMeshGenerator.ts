import * as THREE from 'three';
import { FACEMESH_TESSELATION } from './face-mesh-triangulation';
import { ARKIT_BLENDSHAPE_NAMES } from './arkitMapper';

export const MORPH_TARGET_NAMES = ARKIT_BLENDSHAPE_NAMES;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface GestureCalibrationParams {
  browRaiseScale: number;     // Multiplies eyebrow raise (browInnerUp, browOuterUp) (0.5 to 2.5, default 1.0)
  browFurrowScale: number;    // Multiplies eyebrow furrow / down (0.5 to 2.5, default 1.0)
  browOffsetY: number;        // Eyebrow vertical anchor offset (-0.15 to 0.15, default 0.0)
  eyeBlinkScale: number;      // Multiplies eyelid blink closure (0.5 to 2.0, default 1.0)
  eyeWideScale: number;       // Multiplies eyelid wide opening (0.5 to 2.0, default 1.0)
  eyeSquintScale: number;     // Multiplies squint cheek/lid squeeze (0.5 to 2.0, default 1.0)
  smileScale: number;         // Multiplies smile elevation & lateral pull (0.5 to 2.5, default 1.0)
  frownScale: number;         // Multiplies frown depressor pull (0.5 to 2.5, default 1.0)
  cheekPuffScale: number;     // Multiplies cheek inflation volume (0.5 to 2.5, default 1.0)
  puckerScale: number;        // Multiplies mouth pucker forward projection (0.5 to 2.5, default 1.0)
  jawOpenScale: number;       // Multiplies jawOpen morph target (0.5 to 2.0, default 1.0)
  lipSeparationRatio: number; // Ratio of lower lip downward separation when opening jaw (0.5 to 2.0, default 1.0)
}

export const DEFAULT_GESTURE_PARAMS: GestureCalibrationParams = {
  browRaiseScale: 1.0,
  browFurrowScale: 1.0,
  browOffsetY: 0.0,
  eyeBlinkScale: 1.0,
  eyeWideScale: 1.0,
  eyeSquintScale: 1.0,
  smileScale: 1.0,
  frownScale: 1.0,
  cheekPuffScale: 1.0,
  puckerScale: 1.0,
  jawOpenScale: 1.0,
  lipSeparationRatio: 1.0,
};

export interface MouthCustomizationParams extends GestureCalibrationParams {
  mouthDepthPush: number;     // pushes inner lips into cavity in -Z (0 to 0.35, default 0.12)
  lipThickness: number;       // scales lip volume in Z and Y (0.5 to 2.0, default 1.0)
  mouthOffsetY: number;       // vertical shift of mouth (-0.2 to 0.2, default 0.0)
  smileOffset: number;        // corner elevation offset (-0.15 to 0.2, default 0.02)
  oralCavityEnabled: boolean; // whether to attach an oral cavity backing mesh (default false)
}

export const DEFAULT_MOUTH_PARAMS: MouthCustomizationParams = {
  ...DEFAULT_GESTURE_PARAMS,
  mouthDepthPush: 0.0,
  lipThickness: 1.0,
  mouthOffsetY: 0.0,
  smileOffset: 0.0,
  jawOpenScale: 1.0,
  oralCavityEnabled: false,
};

// --- Multi-Point Landmark Tracking Groups (MediaPipe 478) ---
export const EYEBROW_LEFT_INDICES = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
export const EYEBROW_RIGHT_INDICES = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
export const GLABELLA_FOREHEAD_INDICES = [10, 151, 9, 8, 168, 6, 197, 195, 5, 4];

export const EYE_LEFT_UPPER_LID = [160, 159, 158, 157, 173];
export const EYE_LEFT_LOWER_LID = [144, 145, 153, 154, 155];
export const EYE_LEFT_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];

export const EYE_RIGHT_UPPER_LID = [385, 386, 387, 388, 398];
export const EYE_RIGHT_LOWER_LID = [373, 374, 380, 381, 382];
export const EYE_RIGHT_INDICES = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];

export const CHEEK_LEFT_INDICES = [205, 50, 187, 123, 116, 147, 213, 192];
export const CHEEK_RIGHT_INDICES = [425, 280, 411, 352, 345, 376, 433, 416];
export const NOSE_INDICES = [1, 2, 98, 327, 198, 420, 195, 5, 4, 19, 94, 97, 326, 242, 462];
export const JAW_MANDIBLE_INDICES = [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 58, 132];

export const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];

export const OUTER_LIP_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
];

// Upper lip: strictly upper lip contours and upper philtrum (no lower lip landmarks)
export const UPPER_LIP_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
  164, 167, 165, 92, 186, 393, 391, 322, 410, 287,
  11, 12, 38, 41, 42, 72, 73, 74, 76, 183, 184, 268, 271, 272, 302, 303, 304, 306,
];

// Lower lip: strictly lower lip contours and vermilion (divides downward when speaking)
export const LOWER_LIP_INDICES = [
  95, 88, 178, 87, 14, 317, 402, 318, 324,
  146, 91, 181, 84, 17, 314, 405, 321, 375,
  18, 83, 182, 106, 43, 313, 406, 335, 273, 85, 86, 89, 90, 179, 180, 315, 316, 319, 320,
];

export const MOUTH_CORNER_INDICES = [61, 78, 291, 308];

export const UPPER_LIP_SET = new Set(UPPER_LIP_INDICES);
export const LOWER_LIP_SET = new Set(LOWER_LIP_INDICES);
export const MOUTH_CORNER_SET = new Set(MOUTH_CORNER_INDICES);
export const EYEBROW_SET = new Set([...EYEBROW_LEFT_INDICES, ...EYEBROW_RIGHT_INDICES, ...GLABELLA_FOREHEAD_INDICES]);
export const EYE_SET = new Set([...EYE_LEFT_INDICES, ...EYE_RIGHT_INDICES]);
export const EYE_UPPER_LID_ALL = new Set([...EYE_LEFT_UPPER_LID, ...EYE_RIGHT_UPPER_LID]);
export const EYE_LOWER_LID_ALL = new Set([...EYE_LEFT_LOWER_LID, ...EYE_RIGHT_LOWER_LID]);
export const NOSE_SET = new Set(NOSE_INDICES);
export const LIP_SET = new Set([...UPPER_LIP_INDICES, ...LOWER_LIP_INDICES, ...INNER_LIP_INDICES, ...OUTER_LIP_INDICES]);
export const JAW_SET = new Set(JAW_MANDIBLE_INDICES);

/**
 * Creates a dark anatomical oral cavity backing mesh with dental arches
 * positioned directly behind the mouth opening. Prevents see-through gaps
 * and flat stretching when the avatar speaks or opens their jaw.
 */
export function generateOralCavityMesh(
  pMouthCenter: Point3D,
  depth: number = 0.28
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'oralCavity';

  // 1. Dark interior oral chamber (closed curved cylinder with dark back plate)
  const cavityGeo = new THREE.CylinderGeometry(0.28, 0.24, depth, 24, 1, false, -Math.PI / 2, Math.PI);
  const cavityMat = new THREE.MeshStandardMaterial({
    color: 0x080204, // Deep dark oral chamber
    roughness: 0.90,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const cavityMesh = new THREE.Mesh(cavityGeo, cavityMat);
  cavityMesh.name = 'cavityChamber';
  cavityMesh.rotation.x = Math.PI / 2;
  cavityMesh.position.set(pMouthCenter.x, pMouthCenter.y, pMouthCenter.z - depth * 0.52);
  group.add(cavityMesh);

  // Solid dark backing plate to prevent head base model from ever showing through
  const backPlateGeo = new THREE.PlaneGeometry(0.55, 0.40);
  const backPlateMat = new THREE.MeshBasicMaterial({
    color: 0x050102,
    side: THREE.DoubleSide,
  });
  const backPlate = new THREE.Mesh(backPlateGeo, backPlateMat);
  backPlate.name = 'cavityBackPlate';
  backPlate.position.set(pMouthCenter.x, pMouthCenter.y, pMouthCenter.z - depth * 0.92);
  group.add(backPlate);

  // 2. Upper Dental Arch (ivory curved band)
  const teethMat = new THREE.MeshStandardMaterial({
    color: 0xf5f6f8,
    roughness: 0.25,
    metalness: 0.05,
  });
  const upperTeethGeo = new THREE.TorusGeometry(0.14, 0.024, 10, 24, Math.PI * 0.85);
  const upperTeeth = new THREE.Mesh(upperTeethGeo, teethMat);
  upperTeeth.name = 'upperTeeth';
  upperTeeth.rotation.x = Math.PI * 0.45;
  upperTeeth.rotation.z = Math.PI * 0.075;
  upperTeeth.position.set(pMouthCenter.x, pMouthCenter.y + 0.018, pMouthCenter.z - 0.038);
  group.add(upperTeeth);

  // 3. Lower Dental Arch (animates downward with jawOpen)
  const lowerTeeth = new THREE.Mesh(upperTeethGeo.clone(), teethMat);
  lowerTeeth.name = 'lowerTeeth';
  lowerTeeth.rotation.x = -Math.PI * 0.45;
  lowerTeeth.rotation.z = Math.PI * 0.075;
  lowerTeeth.position.set(pMouthCenter.x, pMouthCenter.y - 0.022, pMouthCenter.z - 0.038);
  lowerTeeth.userData.basePos = lowerTeeth.position.clone();
  group.add(lowerTeeth);

  return group;
}

/**
 * Smooth Hermite / radial falloff function:
 * Returns 1 at dist = 0, decaying smoothly to 0 at dist = radius with 0 tangent at the boundary.
 */
function smoothRadialFalloff(dist: number, radius: number): number {
  if (dist >= radius) return 0;
  const t = 1 - (dist / radius) * (dist / radius);
  return t * t;
}

/**
 * Creates a high-precision 478-point landmark tracking cloud overlay.
 * Points are color-coded by facial functional zone to visually diagnose
 * MediaPipe landmark alignment and blendshape deformation.
 */
export function createTrackingPointsMesh(basePoints: Point3D[]): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];

  basePoints.forEach((p, idx) => {
    positions.push(p.x, p.y, p.z + 0.008); // Slight forward bias to prevent z-fighting with the face mesh

    if (EYEBROW_SET.has(idx)) {
      // Eyebrows & Glabella: Cyan
      colors.push(0.06, 0.71, 0.83);
    } else if (EYE_SET.has(idx)) {
      // Eyes & Lids: Emerald Green
      colors.push(0.06, 0.73, 0.51);
    } else if (NOSE_SET.has(idx)) {
      // Nose: Amber
      colors.push(0.96, 0.62, 0.04);
    } else if (LIP_SET.has(idx)) {
      // Lips: Rose
      colors.push(0.96, 0.25, 0.37);
    } else if (JAW_SET.has(idx)) {
      // Mandible & Chin: Purple
      colors.push(0.66, 0.33, 0.97);
    } else {
      // Perimeter / Cheeks: Sky / Slate
      colors.push(0.58, 0.64, 0.72);
    }
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.035,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    sizeAttenuation: true,
  });

  const pointsMesh = new THREE.Points(geometry, material);
  pointsMesh.name = 'trackingPointsMesh';
  pointsMesh.renderOrder = 999;
  return pointsMesh;
}

export class FaceMeshGenerator {
  public baseVertices: Float32Array | null = null;
  public geometry: THREE.BufferGeometry | null = null;
  public material: THREE.MeshStandardMaterial | null = null;
  public mesh: THREE.Mesh | null = null;
  public skinColor: { r: number; g: number; b: number } = { r: 0.85, g: 0.75, b: 0.65 };
  public mouthParams: MouthCustomizationParams = { ...DEFAULT_MOUTH_PARAMS };

  /**
   * Aligns 3D landmarks into a canonical frontal facial frame.
   * Completely eliminates any camera tilt, roll, or pitch from the photo.
   */
  canonicalizeLandmarks(landmarks: Array<{ x: number; y: number; z: number }>): Point3D[] {
    // 1. Convert MediaPipe raw coordinates to 3D points
    // (+X is right, +Y is up, +Z is forward towards viewer)
    const points: Point3D[] = landmarks.map((lm) => ({
      x: lm.x,
      y: -lm.y,
      z: -lm.z,
    }));

    // 2. Facial Center anchor: glabella / nose bridge (landmark 168)
    const center = points[168] ? { ...points[168] } : { x: 0.5, y: -0.5, z: 0 };

    // 3. Horizontal facial axis: between outer eye corners (33, 263) and temples (234, 454)
    const pEyeLeft = points[33] || { x: 0.3, y: -0.4, z: 0 };
    const pEyeRight = points[263] || { x: 0.7, y: -0.4, z: 0 };
    const pTempleLeft = points[234] || pEyeLeft;
    const pTempleRight = points[454] || pEyeRight;

    const eyeVec = {
      x: pEyeRight.x - pEyeLeft.x,
      y: pEyeRight.y - pEyeLeft.y,
      z: pEyeRight.z - pEyeLeft.z,
    };
    const templeVec = {
      x: pTempleRight.x - pTempleLeft.x,
      y: pTempleRight.y - pTempleLeft.y,
      z: pTempleRight.z - pTempleLeft.z,
    };

    const rawUx = {
      x: eyeVec.x * 0.65 + templeVec.x * 0.35,
      y: eyeVec.y * 0.65 + templeVec.y * 0.35,
      z: eyeVec.z * 0.65 + templeVec.z * 0.35,
    };
    const lenUx = Math.hypot(rawUx.x, rawUx.y, rawUx.z) || 1;
    const ux = { x: rawUx.x / lenUx, y: rawUx.y / lenUx, z: rawUx.z / lenUx };

    // 4. Vertical facial axis: from chin (landmark 152) to forehead (landmark 10)
    const pChin = points[152] || { x: 0.5, y: -0.8, z: 0 };
    const pForehead = points[10] || { x: 0.5, y: -0.2, z: 0 };
    const rawUy = {
      x: pForehead.x - pChin.x,
      y: pForehead.y - pChin.y,
      z: pForehead.z - pChin.z,
    };

    // Gram-Schmidt orthogonalization: ensure uy is strictly perpendicular to ux
    const dotUyUx = rawUy.x * ux.x + rawUy.y * ux.y + rawUy.z * ux.z;
    const perpUy = {
      x: rawUy.x - dotUyUx * ux.x,
      y: rawUy.y - dotUyUx * ux.y,
      z: rawUy.z - dotUyUx * ux.z,
    };
    const lenUy = Math.hypot(perpUy.x, perpUy.y, perpUy.z) || 1;
    const uy = { x: perpUy.x / lenUy, y: perpUy.y / lenUy, z: perpUy.z / lenUy };

    // 5. Normal axis: cross product ux x uy -> points straight forward out of face (+Z)
    const uz = {
      x: ux.y * uy.z - ux.z * uy.y,
      y: ux.z * uy.x - ux.x * uy.z,
      z: ux.x * uy.y - ux.y * uy.x,
    };

    // Ensure uz points outward (nose tip landmark 1 is in front of glabella)
    const pNoseTip = points[1] || { x: center.x, y: center.y, z: center.z + 0.1 };
    const noseVec = {
      x: pNoseTip.x - center.x,
      y: pNoseTip.y - center.y,
      z: pNoseTip.z - center.z,
    };
    const noseDotUz = noseVec.x * uz.x + noseVec.y * uz.y + noseVec.z * uz.z;
    if (noseDotUz < 0) {
      uz.x = -uz.x;
      uz.y = -uz.y;
      uz.z = -uz.z;
    }

    // 6. Project all landmarks onto the canonical orthonormal basis
    return points.map((p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const dz = p.z - center.z;
      return {
        x: dx * ux.x + dy * ux.y + dz * ux.z,
        y: dx * uy.x + dy * uy.y + dz * uy.z,
        z: dx * uz.x + dy * uz.y + dz * uz.z,
      };
    });
  }

  generateWithMorphTargets(
    landmarks: Array<{ x: number; y: number; z: number }>,
    _blendshapes: Record<string, number>,
    _transformMatrix: any,
    textureCanvas: HTMLCanvasElement,
    mouthParams?: Partial<MouthCustomizationParams>
  ): THREE.Mesh {
    if (mouthParams) {
      this.mouthParams = { ...DEFAULT_MOUTH_PARAMS, ...mouthParams };
    }
    this.geometry = new THREE.BufferGeometry();

    // Sample skin color for head base model
    this.skinColor = this.sampleSkinColorFromTexture(textureCanvas);

    // 1. CANONICALIZE LANDMARKS: 100% upright, level, and front-facing
    const canonicalPoints = this.canonicalizeLandmarks(landmarks);

    // 2. Compute canonical bounds for geometry
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    canonicalPoints.forEach((p) => {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const faceWidth = maxX - minX || 1;
    const faceHeight = maxY - minY || 1;

    // Normalization scales: puts face inside ~[-1, 1] bounds while preserving depth
    const scaleX = faceWidth * 0.52;
    const scaleY = faceHeight * 0.5;
    const scaleZ = faceHeight * 0.55;

    // Mouth Center in normalized coordinates
    const rawUpperLip = canonicalPoints[13] || { x: 0, y: -0.3, z: 0 };
    const rawLowerLip = canonicalPoints[14] || { x: 0, y: -0.35, z: 0 };
    const normMouthCenter: Point3D = {
      x: ((rawUpperLip.x + rawLowerLip.x) / 2 - centerX) / scaleX,
      y: ((rawUpperLip.y + rawLowerLip.y) / 2 - centerY) / scaleY,
      z: ((rawUpperLip.z + rawLowerLip.z) / 2 - centerZ) / scaleZ,
    };

    // 3. Compute 2D texture bounds for UV mapping from original photo coordinates
    let minX2D = Infinity, maxX2D = -Infinity;
    let minY2D = Infinity, maxY2D = -Infinity;
    landmarks.forEach((lm) => {
      minX2D = Math.min(minX2D, lm.x);
      maxX2D = Math.max(maxX2D, lm.x);
      minY2D = Math.min(minY2D, lm.y);
      maxY2D = Math.max(maxY2D, lm.y);
    });

    const padding = 0.2;
    const faceWidth2D = maxX2D - minX2D;
    const faceHeight2D = maxY2D - minY2D;
    const cropSize = Math.max(faceWidth2D, faceHeight2D) * (1 + padding);
    const textureCenterX = (minX2D + maxX2D) / 2;
    const textureCenterY = (minY2D + maxY2D) / 2;
    const textureMinX = textureCenterX - cropSize / 2;
    const textureMinY = textureCenterY - cropSize / 2;

    // 4. Generate base vertices, UVs, and vertex colors
    const vertices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const basePoints: Point3D[] = [];

    // Pre-calculate initial gap between raw upper (13) and lower (14) lips to seal in resting pose
    const rawGapY = Math.max(0, (canonicalPoints[13]?.y ?? 0) - (canonicalPoints[14]?.y ?? 0));

    canonicalPoints.forEach((p, index) => {
      let x = (p.x - centerX) / scaleX;
      let y = (p.y - centerY) / scaleY;
      let z = (p.z - centerZ) / scaleZ;

      // 1. Initial Eye Opening & Eyebrow Clearance
      // En reposo, eleva los párpados superiores y cejas, y desciende suavemente los párpados inferiores
      // para que los ojos 3D y pupilas queden completamente abiertos, nítidos y visibles.
      if (EYE_UPPER_LID_ALL.has(index)) {
        y += 0.082;
        z += 0.022;
      } else if (EYE_LOWER_LID_ALL.has(index)) {
        y -= 0.038;
      }

      if (EYEBROW_SET.has(index)) {
        y += 0.045;
      }

      // 2. Initial Mouth Rest Pose Sealing (Labios cerrados en reposo sin hendiduras abiertas)
      if (rawGapY > 0.005) {
        const isInnerLip = INNER_LIP_INDICES.includes(index);
        const isLowerLip = LOWER_LIP_SET.has(index);
        const isUpperLip = UPPER_LIP_SET.has(index);

        if (isLowerLip || isInnerLip) {
          if (y < normMouthCenter.y) {
            const dM = Math.hypot(x - normMouthCenter.x, y - normMouthCenter.y);
            const sealW = smoothRadialFalloff(dM, 0.18);
            y += Math.min(normMouthCenter.y - y, rawGapY * 0.85) * sealW;
          }
        } else if (isUpperLip && isInnerLip) {
          if (y > normMouthCenter.y) {
            const dM = Math.hypot(x - normMouthCenter.x, y - normMouthCenter.y);
            const sealW = smoothRadialFalloff(dM, 0.18);
            y -= Math.min(y - normMouthCenter.y, rawGapY * 0.15) * sealW;
          }
        }
      }

      // Apply mouth calibration parameters
      const distToMouth = Math.hypot(x - normMouthCenter.x, y - normMouthCenter.y);

      // A. Mouth Depth Push: curve inner lips inward in -Z into oral cavity (default 0.0)
      if (distToMouth < 0.28 && this.mouthParams.mouthDepthPush !== 0) {
        const depthW = smoothRadialFalloff(distToMouth, 0.28);
        const isInner = INNER_LIP_INDICES.includes(index);
        const pushAmt = isInner ? this.mouthParams.mouthDepthPush : this.mouthParams.mouthDepthPush * 0.45;
        z -= pushAmt * depthW;
      }

      // B. Lip Thickness: volume scaling for outer/inner lip rim
      if (distToMouth < 0.32 && this.mouthParams.lipThickness !== 1.0) {
        const thickW = smoothRadialFalloff(distToMouth, 0.32);
        z += (this.mouthParams.lipThickness - 1.0) * 0.08 * thickW;
        y += (this.mouthParams.lipThickness - 1.0) * (y - normMouthCenter.y) * 0.25 * thickW;
      }

      // C. Mouth Offset Y: vertical placement tuning
      if (distToMouth < 0.35 && this.mouthParams.mouthOffsetY !== 0) {
        const yW = smoothRadialFalloff(distToMouth, 0.35);
        y += this.mouthParams.mouthOffsetY * yW;
      }

      // D. Smile Offset: uplift mouth corners
      if (this.mouthParams.smileOffset !== 0) {
        const distCorner = Math.min(
          Math.hypot(x - (-0.28), y - normMouthCenter.y),
          Math.hypot(x - 0.28, y - normMouthCenter.y)
        );
        if (distCorner < 0.22) {
          const cornerW = smoothRadialFalloff(distCorner, 0.22);
          y += this.mouthParams.smileOffset * cornerW;
          z += this.mouthParams.smileOffset * 0.12 * cornerW;
        }
      }

      // E. Eyebrow Vertical Offset Tuning
      if (this.mouthParams.browOffsetY !== 0 && EYEBROW_SET.has(index)) {
        y += this.mouthParams.browOffsetY;
      }

      vertices.push(x, y, z);
      basePoints.push({ x, y, z });

      colors.push(1, 1, 1);

      const rawLandmark = landmarks[index];
      const u = (rawLandmark.x - textureMinX) / cropSize;
      const v = 1.0 - (rawLandmark.y - textureMinY) / cropSize;
      uvs.push(u, v);
    });

    this.baseVertices = Float32Array.from(vertices);

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const indices: number[] = [];
    for (let i = 0; i < FACEMESH_TESSELATION.length; i += 3) {
      indices.push(
        FACEMESH_TESSELATION[i],
        FACEMESH_TESSELATION[i + 1],
        FACEMESH_TESSELATION[i + 2]
      );
    }

    this.geometry.setIndex(indices);
    this.geometry.computeVertexNormals();

    // 5. Create 52 ARKit Morph Targets with smooth continuous Hermite falloffs
    this.createMorphTargets(basePoints);

    // 6. Texture
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // 7. Material
    this.material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.0,
      emissive: new THREE.Color(0x222222),
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
      transparent: false,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Force Three.js to construct morphTargetDictionary and morphTargetInfluences
    this.mesh.updateMorphTargets();

    this.mesh.userData.faceWidth = 2.0;
    this.mesh.userData.faceHeight = 2.0;
    this.mesh.userData.aspectRatio = faceWidth / faceHeight;
    this.mesh.userData.skinColor = this.skinColor;
    this.mesh.userData.canonicalPoints = basePoints;
    this.mesh.userData.mouthCenter = normMouthCenter;

    // 8. REST POSE: Initialize ALL morph target influences to 0
    if (this.mesh.morphTargetDictionary && this.mesh.morphTargetInfluences) {
      this.mesh.morphTargetInfluences.fill(0);
    }

    return this.mesh;
  }

  sampleSkinColorFromTexture(textureCanvas: HTMLCanvasElement): { r: number; g: number; b: number } {
    const ctx = textureCanvas.getContext('2d');
    if (!ctx) return { r: 0.85, g: 0.75, b: 0.65 };

    const width = textureCanvas.width;
    const height = textureCanvas.height;

    const points = [
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.25) },
      { x: Math.floor(width * 0.3), y: Math.floor(height * 0.55) },
      { x: Math.floor(width * 0.7), y: Math.floor(height * 0.55) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.85) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.45) },
    ];

    const sampleSize = 8;
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      validSamples = 0;

    points.forEach((p) => {
      try {
        const imageData = ctx.getImageData(p.x, p.y, sampleSize, sampleSize);
        const data = imageData.data;

        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 60 && brightness < 240) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }

        if (count > 0) {
          totalR += r / count;
          totalG += g / count;
          totalB += b / count;
          validSamples++;
        }
      } catch (_) {}
    });

    if (validSamples === 0) return { r: 0.85, g: 0.75, b: 0.65 };

    return {
      r: totalR / validSamples / 255,
      g: totalG / validSamples / 255,
      b: totalB / validSamples / 255,
    };
  }

  createMorphTargets(basePoints: Point3D[]): void {
    if (!this.geometry) return;

    this.geometry.morphAttributes.position = [];
    const morphTargetNames: string[] = [];

    ARKIT_BLENDSHAPE_NAMES.forEach((blendshapeName, index) => {
      const morphPositions = this.calculateMorphTarget(basePoints, blendshapeName);
      const attr = new THREE.Float32BufferAttribute(morphPositions, 3);
      attr.name = blendshapeName;
      if (this.geometry && this.geometry.morphAttributes.position) {
        this.geometry.morphAttributes.position[index] = attr;
      }
      morphTargetNames.push(blendshapeName);
    });

    // glTF 2.0 standard: morph targets MUST be stored as relative deltas (dx, dy, dz)
    // ThreeAvatarCanvas hot-upgrade also respects morphTargetsRelative=true
    this.geometry.morphTargetsRelative = true;
    this.geometry.userData.targetNames = morphTargetNames;
  }

  /**
   * Calculates smooth, continuous morph target positions using cubic Hermite radial falloffs.
   * Completely avoids spiky tearing or jagged boundary artifacts.
   */
  calculateMorphTarget(basePoints: Point3D[], blendshapeName: string): Float32Array {
    const vertices: number[] = [];

    // Helper: 3D distance between vertex and anchor landmark
    const distTo = (index: number, anchorIdx: number): number => {
      const p = basePoints[index];
      const a = basePoints[anchorIdx];
      if (!p || !a) return 999;
      return Math.hypot(p.x - a.x, p.y - a.y, p.z - a.z);
    };

    // Helper: 3D distance between vertex and a custom 3D point
    const distToPoint = (index: number, pt: Point3D): number => {
      const p = basePoints[index];
      if (!p) return 999;
      return Math.hypot(p.x - pt.x, p.y - pt.y, p.z - pt.z);
    };

    // Helper: minimum 3D distance between vertex and an array of landmark indices
    const distToAny = (index: number, indices: number[]): number => {
      let minDist = 999;
      for (let i = 0; i < indices.length; i++) {
        const d = distTo(index, indices[i]);
        if (d < minDist) minDist = d;
      }
      return minDist;
    };

    // Gesture & Mouth calibration multipliers
    const jawScale = this.mouthParams.jawOpenScale ?? 1.0;
    const lipSepRatio = this.mouthParams.lipSeparationRatio ?? 1.0;
    const browRaise = this.mouthParams.browRaiseScale ?? 1.0;
    const browFurrow = this.mouthParams.browFurrowScale ?? 1.0;
    const blinkScale = this.mouthParams.eyeBlinkScale ?? 1.0;
    const wideScale = this.mouthParams.eyeWideScale ?? 1.0;
    const squintScale = this.mouthParams.eyeSquintScale ?? 1.0;
    const smileScale = this.mouthParams.smileScale ?? 1.0;
    const frownScale = this.mouthParams.frownScale ?? 1.0;
    const cheekPuffScale = this.mouthParams.cheekPuffScale ?? 1.0;
    const puckerScale = this.mouthParams.puckerScale ?? 1.0;

    // Key Anchor Points (Canonical Normalized Space):
    const pChin = basePoints[152] || { x: 0, y: -0.9, z: 0 };
    const pUpperLip = basePoints[13] || { x: 0, y: -0.3, z: 0 };
    const pLowerLip = basePoints[14] || { x: 0, y: -0.35, z: 0 };
    const pMouthCenter = {
      x: (pUpperLip.x + pLowerLip.x) / 2,
      y: (pUpperLip.y + pLowerLip.y) / 2,
      z: (pUpperLip.z + pLowerLip.z) / 2,
    };
    const pMouthCornerLeft = basePoints[61] || { x: -0.3, y: -0.32, z: 0 };
    const pMouthCornerRight = basePoints[291] || { x: 0.3, y: -0.32, z: 0 };

    basePoints.forEach((base, index) => {
      let x = base.x;
      let y = base.y;
      let z = base.z;

      switch (blendshapeName) {
        // ==========================================
        // 1. JAW BLENDSHAPES
        // ==========================================
        case 'jawOpen': {
          // 1. Las comisuras y el labio superior permanecen 100% inmóviles
          if (MOUTH_CORNER_SET.has(index) || UPPER_LIP_SET.has(index) || base.y >= pMouthCenter.y) {
            break;
          }

          // 2. Se anima exclusivamente la parte de los labios inferiores (sin comisuras, sin mandíbula/barbilla)
          const isLowerLip = LOWER_LIP_SET.has(index) || INNER_LIP_INDICES.includes(index);
          const d14 = distTo(index, 14);

          if (isLowerLip || d14 < 0.20) {
            // Factor comisuras: 0 en las comisuras y sus inmediaciones para dejarlas intactas, 1 en el centro del labio
            const dCornerL = distTo(index, 61);
            const dCornerR = distTo(index, 291);
            const minCornerDist = Math.min(dCornerL, dCornerR);
            const cornerMask = THREE.MathUtils.clamp((minCornerDist - 0.04) / 0.10, 0, 1);

            // Descenso centrado suave en el labio inferior (landmark 14)
            const lipW = smoothRadialFalloff(d14, 0.22) * cornerMask;

            // Apertura de habla anatómica calibrada (0.16 máx, movimiento exclusivamente labial)
            y -= 0.16 * jawScale * lipSepRatio * lipW;
            z -= 0.03 * jawScale * lipW;
          }
          break;
        }

        case 'jawForward': {
          if (base.y < pUpperLip.y) {
            const jawRange = Math.abs(pUpperLip.y - pChin.y) || 0.6;
            const t = THREE.MathUtils.clamp((pUpperLip.y - base.y) / jawRange, 0, 1);
            z += 0.14 * (t * t);
          }
          break;
        }

        case 'jawLeft': {
          if (base.y < pUpperLip.y) {
            const jawRange = Math.abs(pUpperLip.y - pChin.y) || 0.6;
            const t = THREE.MathUtils.clamp((pUpperLip.y - base.y) / jawRange, 0, 1);
            x -= 0.14 * (t * t);
          }
          break;
        }

        case 'jawRight': {
          if (base.y < pUpperLip.y) {
            const jawRange = Math.abs(pUpperLip.y - pChin.y) || 0.6;
            const t = THREE.MathUtils.clamp((pUpperLip.y - base.y) / jawRange, 0, 1);
            x += 0.14 * (t * t);
          }
          break;
        }

        // ==========================================
        // 2. MOUTH & SMILE BLENDSHAPES
        // ==========================================
        case 'mouthSmileLeft': {
          const dCorner = distToAny(index, [61, 78, 185, 40]);
          const wCorner = smoothRadialFalloff(dCorner, 0.40);
          y += 0.30 * smileScale * wCorner;
          x -= 0.18 * smileScale * wCorner;
          z += 0.08 * smileScale * wCorner;

          // Upper lip follow-through & zygomatic cheek pull
          const wCheek = smoothRadialFalloff(distToAny(index, CHEEK_LEFT_INDICES), 0.35);
          y += 0.12 * smileScale * wCheek;
          z += 0.06 * smileScale * wCheek;
          break;
        }

        case 'mouthSmileRight': {
          const dCorner = distToAny(index, [291, 308, 409, 270]);
          const wCorner = smoothRadialFalloff(dCorner, 0.40);
          y += 0.30 * smileScale * wCorner;
          x += 0.18 * smileScale * wCorner;
          z += 0.08 * smileScale * wCorner;

          const wCheek = smoothRadialFalloff(distToAny(index, CHEEK_RIGHT_INDICES), 0.35);
          y += 0.12 * smileScale * wCheek;
          z += 0.06 * smileScale * wCheek;
          break;
        }

        case 'mouthFrownLeft': {
          const w = smoothRadialFalloff(distToAny(index, [61, 78, 146]), 0.36);
          y -= 0.24 * frownScale * w;
          x += 0.06 * frownScale * w;
          break;
        }

        case 'mouthFrownRight': {
          const w = smoothRadialFalloff(distToAny(index, [291, 308, 375]), 0.36);
          y -= 0.24 * frownScale * w;
          x -= 0.06 * frownScale * w;
          break;
        }

        case 'mouthPucker': {
          const dLip = distToAny(index, [...INNER_LIP_INDICES, ...OUTER_LIP_INDICES]);
          const w = smoothRadialFalloff(Math.min(distToPoint(index, pMouthCenter), dLip + 0.04), 0.45);
          const dx = base.x - pMouthCenter.x;
          x -= dx * 0.55 * puckerScale * w;
          z += 0.24 * puckerScale * w;
          break;
        }

        case 'mouthFunnel': {
          const w = smoothRadialFalloff(distToPoint(index, pMouthCenter), 0.45);
          const dy = base.y - pMouthCenter.y;
          y += Math.sign(dy) * 0.12 * w;
          z += 0.14 * w;
          break;
        }

        case 'mouthDimpleLeft': {
          const w = smoothRadialFalloff(distTo(index, 61), 0.28);
          x -= 0.08 * smileScale * w;
          z -= 0.12 * smileScale * w;
          break;
        }

        case 'mouthDimpleRight': {
          const w = smoothRadialFalloff(distTo(index, 291), 0.28);
          x += 0.08 * smileScale * w;
          z -= 0.12 * smileScale * w;
          break;
        }

        case 'mouthStretchLeft': {
          const w = smoothRadialFalloff(distTo(index, 61), 0.35);
          x -= 0.18 * w;
          break;
        }

        case 'mouthStretchRight': {
          const w = smoothRadialFalloff(distTo(index, 291), 0.35);
          x += 0.18 * w;
          break;
        }

        case 'mouthRollUpper': {
          if (!LOWER_LIP_SET.has(index) && base.y >= pMouthCenter.y - 0.01) {
            const w = smoothRadialFalloff(distTo(index, 0), 0.22);
            z -= 0.14 * w;
            y -= 0.06 * w;
          }
          break;
        }

        case 'mouthRollLower': {
          if (!UPPER_LIP_SET.has(index) && base.y <= pMouthCenter.y + 0.01) {
            const w = smoothRadialFalloff(distTo(index, 17), 0.22);
            z -= 0.14 * w;
            y += 0.06 * w;
          }
          break;
        }

        case 'mouthShrugUpper': {
          if (!LOWER_LIP_SET.has(index)) {
            const w = smoothRadialFalloff(distTo(index, 0), 0.25);
            y += 0.14 * w;
          }
          break;
        }

        case 'mouthShrugLower': {
          if (!UPPER_LIP_SET.has(index)) {
            const w = smoothRadialFalloff(distTo(index, 17), 0.25);
            y += 0.16 * w;
            z += 0.08 * w;
          }
          break;
        }

        case 'mouthPressLeft': {
          const w = smoothRadialFalloff(distTo(index, 61), 0.28);
          z -= 0.08 * w;
          break;
        }

        case 'mouthPressRight': {
          const w = smoothRadialFalloff(distTo(index, 291), 0.28);
          z -= 0.08 * w;
          break;
        }

        case 'mouthLowerDownLeft': {
          if (!UPPER_LIP_SET.has(index) && base.y <= pMouthCenter.y + 0.01) {
            const w = smoothRadialFalloff(distTo(index, 87), 0.25);
            y -= 0.22 * w;
            z -= 0.06 * w;
          }
          break;
        }

        case 'mouthLowerDownRight': {
          if (!UPPER_LIP_SET.has(index) && base.y <= pMouthCenter.y + 0.01) {
            const w = smoothRadialFalloff(distTo(index, 317), 0.25);
            y -= 0.22 * w;
            z -= 0.06 * w;
          }
          break;
        }

        case 'mouthUpperUpLeft': {
          if (!LOWER_LIP_SET.has(index) && base.y >= pMouthCenter.y - 0.01) {
            const w = smoothRadialFalloff(distTo(index, 37), 0.25);
            y += 0.20 * w;
          }
          break;
        }

        case 'mouthUpperUpRight': {
          if (!LOWER_LIP_SET.has(index) && base.y >= pMouthCenter.y - 0.01) {
            const w = smoothRadialFalloff(distTo(index, 267), 0.25);
            y += 0.20 * w;
          }
          break;
        }

        case 'mouthClose': {
          // Upper lip presses subtly downward, lower lip moves upward to cleanly seal the mouth opening
          if (UPPER_LIP_SET.has(index) || base.y > pMouthCenter.y) {
            const wUpper = smoothRadialFalloff(distTo(index, 13), 0.22);
            y -= 0.04 * wUpper;
          } else if (LOWER_LIP_SET.has(index) || base.y < pMouthCenter.y) {
            const wLower = smoothRadialFalloff(distTo(index, 14), 0.22);
            y += 0.08 * wLower;
          }
          break;
        }

        case 'mouthLeft': {
          const w = smoothRadialFalloff(distToPoint(index, pMouthCenter), 0.45);
          x -= 0.14 * w;
          break;
        }

        case 'mouthRight': {
          const w = smoothRadialFalloff(distToPoint(index, pMouthCenter), 0.45);
          x += 0.14 * w;
          break;
        }

        // ==========================================
        // 3. EYES BLENDSHAPES
        // ==========================================
        case 'eyeBlinkLeft': {
          // Multi-point upper lid drops down smoothly to meet lower lid
          const wUpper = smoothRadialFalloff(distToAny(index, EYE_LEFT_UPPER_LID), 0.22);
          const pLower = basePoints[145] || basePoints[159];
          const rawDy = pLower.y - (basePoints[159]?.y || pLower.y);
          const strokeDy = Math.min(rawDy * 1.15, -0.32);
          y += strokeDy * blinkScale * wUpper;
          z += 0.05 * blinkScale * wUpper; // covers forward surface of eyeball

          // Lower lid rises subtly
          const wLower = smoothRadialFalloff(distToAny(index, EYE_LEFT_LOWER_LID), 0.15);
          y += 0.05 * blinkScale * wLower;
          break;
        }

        case 'eyeBlinkRight': {
          const wUpper = smoothRadialFalloff(distToAny(index, EYE_RIGHT_UPPER_LID), 0.22);
          const pLower = basePoints[374] || basePoints[386];
          const rawDy = pLower.y - (basePoints[386]?.y || pLower.y);
          const strokeDy = Math.min(rawDy * 1.15, -0.32);
          y += strokeDy * blinkScale * wUpper;
          z += 0.05 * blinkScale * wUpper;

          const wLower = smoothRadialFalloff(distToAny(index, EYE_RIGHT_LOWER_LID), 0.15);
          y += 0.05 * blinkScale * wLower;
          break;
        }

        case 'eyeWideLeft': {
          const wUpper = smoothRadialFalloff(distToAny(index, EYE_LEFT_UPPER_LID), 0.20);
          const wLower = smoothRadialFalloff(distToAny(index, EYE_LEFT_LOWER_LID), 0.18);
          y += 0.14 * wideScale * wUpper;
          y -= 0.08 * wideScale * wLower;
          break;
        }

        case 'eyeWideRight': {
          const wUpper = smoothRadialFalloff(distToAny(index, EYE_RIGHT_UPPER_LID), 0.20);
          const wLower = smoothRadialFalloff(distToAny(index, EYE_RIGHT_LOWER_LID), 0.18);
          y += 0.14 * wideScale * wUpper;
          y -= 0.08 * wideScale * wLower;
          break;
        }

        case 'eyeSquintLeft': {
          const w = smoothRadialFalloff(distToAny(index, EYE_LEFT_LOWER_LID), 0.20);
          const wCheek = smoothRadialFalloff(distToAny(index, CHEEK_LEFT_INDICES), 0.25);
          y += (0.12 * w + 0.06 * wCheek) * squintScale;
          break;
        }

        case 'eyeSquintRight': {
          const w = smoothRadialFalloff(distToAny(index, EYE_RIGHT_LOWER_LID), 0.20);
          const wCheek = smoothRadialFalloff(distToAny(index, CHEEK_RIGHT_INDICES), 0.25);
          y += (0.12 * w + 0.06 * wCheek) * squintScale;
          break;
        }

        // eyeLook* targets: ZERO delta on the face mesh.
        // Gaze animation is handled exclusively by the 3D eyeball spheres (eyeLeft/eyeRight nodes)
        // via gazeX / gazeY in ThreeAvatarCanvas. Applying mesh deformation here would cause
        // double-animation artifacts where eyelid verts move while the spheres also rotate.
        case 'eyeLookUpLeft':
        case 'eyeLookUpRight':
        case 'eyeLookDownLeft':
        case 'eyeLookDownRight':
        case 'eyeLookInLeft':
        case 'eyeLookInRight':
        case 'eyeLookOutLeft':
        case 'eyeLookOutRight':
          // Intentionally no-op: x, y, z remain == base → delta will be 0,0,0
          break;

        // ==========================================
        // 4. EYEBROWS BLENDSHAPES
        // ==========================================
        case 'browInnerUp': {
          // Multi-point inner brows arch
          const w = smoothRadialFalloff(distToAny(index, [168, 107, 66, 336, 296, 9, 8]), 0.38);
          y += 0.30 * browRaise * w;
          z += 0.04 * browRaise * w;
          break;
        }

        case 'browDownLeft': {
          // Multi-point left brow furrow
          const w = smoothRadialFalloff(distToAny(index, [107, 66, 105, 63, 70]), 0.34);
          y -= 0.25 * browFurrow * w;
          x += 0.08 * browFurrow * w;
          z -= 0.05 * browFurrow * w;
          break;
        }

        case 'browDownRight': {
          // Multi-point right brow furrow
          const w = smoothRadialFalloff(distToAny(index, [336, 296, 334, 293, 300]), 0.34);
          y -= 0.25 * browFurrow * w;
          x -= 0.08 * browFurrow * w;
          z -= 0.05 * browFurrow * w;
          break;
        }

        case 'browOuterUpLeft': {
          // Multi-point outer brow elevation
          const w = smoothRadialFalloff(distToAny(index, [70, 63, 46, 53, 52]), 0.32);
          y += 0.26 * browRaise * w;
          break;
        }

        case 'browOuterUpRight': {
          const w = smoothRadialFalloff(distToAny(index, [300, 293, 276, 283, 282]), 0.32);
          y += 0.26 * browRaise * w;
          break;
        }

        // ==========================================
        // 5. CHEEKS & NOSE BLENDSHAPES
        // ==========================================
        case 'cheekPuff': {
          const wLeft = smoothRadialFalloff(distToAny(index, CHEEK_LEFT_INDICES), 0.38);
          const wRight = smoothRadialFalloff(distToAny(index, CHEEK_RIGHT_INDICES), 0.38);
          z += 0.18 * cheekPuffScale * (wLeft + wRight);
          x -= 0.14 * cheekPuffScale * wLeft;
          x += 0.14 * cheekPuffScale * wRight;
          break;
        }

        case 'cheekSquintLeft': {
          const w = smoothRadialFalloff(distToAny(index, CHEEK_LEFT_INDICES), 0.32);
          y += 0.14 * squintScale * w;
          break;
        }

        case 'cheekSquintRight': {
          const w = smoothRadialFalloff(distToAny(index, CHEEK_RIGHT_INDICES), 0.32);
          y += 0.14 * squintScale * w;
          break;
        }

        case 'noseSneerLeft': {
          const w = smoothRadialFalloff(distTo(index, 198), 0.22);
          y += 0.14 * w;
          z += 0.06 * w;
          break;
        }

        case 'noseSneerRight': {
          const w = smoothRadialFalloff(distTo(index, 420), 0.22);
          y += 0.14 * w;
          z += 0.06 * w;
          break;
        }

        // ==========================================
        // 6. TONGUE BLENDSHAPE
        // ==========================================
        case 'tongueOut': {
          const w = smoothRadialFalloff(distTo(index, 14), 0.18);
          z += 0.32 * w;
          y -= 0.08 * w;
          break;
        }
      }

      // Store RELATIVE delta (displacement from rest pose) — required by glTF 2.0 morphTargetsRelative=true
      vertices.push(x - base.x, y - base.y, z - base.z);
    });

    return Float32Array.from(vertices);
  }

  dispose(): void {
    if (this.geometry) this.geometry.dispose();
    if (this.material) {
      if (this.material.map) this.material.map.dispose();
      this.material.dispose();
    }
  }
}
