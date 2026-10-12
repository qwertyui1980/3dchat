import * as THREE from 'three';
import { FACEMESH_TESSELATION } from './face-mesh-triangulation';
import { ARKIT_BLENDSHAPE_NAMES } from './arkitMapper';

export const MORPH_TARGET_NAMES = ARKIT_BLENDSHAPE_NAMES;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface MouthCustomizationParams {
  mouthDepthPush: number;     // pushes inner lips into cavity in -Z (0 to 0.35, default 0.12)
  lipThickness: number;       // scales lip volume in Z and Y (0.5 to 2.0, default 1.0)
  mouthOffsetY: number;       // vertical shift of mouth (-0.2 to 0.2, default 0.0)
  smileOffset: number;        // corner elevation offset (-0.15 to 0.2, default 0.02)
  jawOpenScale: number;       // multiplies jawOpen morph target (0.5 to 1.8, default 1.0)
  oralCavityEnabled: boolean; // whether to attach an oral cavity backing mesh (default true)
}

export const DEFAULT_MOUTH_PARAMS: MouthCustomizationParams = {
  mouthDepthPush: 0.12,
  lipThickness: 1.0,
  mouthOffsetY: 0.0,
  smileOffset: 0.02,
  jawOpenScale: 1.0,
  oralCavityEnabled: true,
};

export const INNER_LIP_INDICES = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];

export const OUTER_LIP_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
];

export const UPPER_LIP_INDICES = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291,
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
  164, 167, 165, 92, 186, 57, 43, 106, 182, 83,
];

export const LOWER_LIP_INDICES = [
  95, 88, 178, 87, 14, 317, 402, 318, 324,
  146, 91, 181, 84, 17, 314, 405, 321, 375,
];

export const UPPER_LIP_SET = new Set(UPPER_LIP_INDICES);
export const LOWER_LIP_SET = new Set(LOWER_LIP_INDICES);

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

    canonicalPoints.forEach((p, index) => {
      let x = (p.x - centerX) / scaleX;
      let y = (p.y - centerY) / scaleY;
      let z = (p.z - centerZ) / scaleZ;

      // Apply mouth calibration parameters
      const distToMouth = Math.hypot(x - normMouthCenter.x, y - normMouthCenter.y);

      // A. Mouth Depth Push: curve inner lips inward in -Z into oral cavity
      if (distToMouth < 0.28) {
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
      transparent: true,
      alphaTest: 0.1,
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

    this.geometry.morphTargetsRelative = false;
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
          const jawScale = this.mouthParams.jawOpenScale ?? 1.0;
          const isUpper = UPPER_LIP_SET.has(index) || base.y > pMouthCenter.y + 0.02;
          const isLower = LOWER_LIP_SET.has(index);

          if (isUpper) {
            // Upper lip stays anchored to skull, slight natural upward lift (+Y)
            const upDist = distTo(index, 13);
            if (upDist < 0.18) {
              const upFalloff = smoothRadialFalloff(upDist, 0.18);
              y += 0.02 * jawScale * upFalloff;
              z -= 0.01 * jawScale * upFalloff;
            }
          } else {
            // Lower lip & jaw
            if (isLower) {
              // Direct, pronounced lower lip downward drop (-Y) and inward oral recession (-Z)
              const lipDist = distTo(index, 14);
              const lipFalloff = Math.max(0.65, smoothRadialFalloff(lipDist, 0.28));
              y -= 0.38 * jawScale * lipFalloff;
              z -= 0.16 * jawScale * lipFalloff;
            } else if (base.y < pMouthCenter.y) {
              // Chin and mandible bone rotation
              const jawRange = Math.abs(pMouthCenter.y - pChin.y) || 0.6;
              const t = THREE.MathUtils.clamp((pMouthCenter.y - base.y) / jawRange, 0, 1);
              const w = t * t;
              y -= 0.26 * jawScale * w;
              z -= 0.08 * jawScale * w;

              // Smooth transition near the lower lip
              const lipDist = distTo(index, 14);
              if (lipDist < 0.25) {
                const fall = smoothRadialFalloff(lipDist, 0.25);
                y -= 0.18 * jawScale * fall;
                z -= 0.10 * jawScale * fall;
              }
            }
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
          const wCorner = smoothRadialFalloff(distTo(index, 61), 0.38);
          y += 0.22 * wCorner;
          x -= 0.14 * wCorner;
          z += 0.06 * wCorner;

          // Upper lip follow-through
          const wUpper = smoothRadialFalloff(distTo(index, 37), 0.25);
          y += 0.08 * wUpper;
          break;
        }

        case 'mouthSmileRight': {
          const wCorner = smoothRadialFalloff(distTo(index, 291), 0.38);
          y += 0.22 * wCorner;
          x += 0.14 * wCorner;
          z += 0.06 * wCorner;

          const wUpper = smoothRadialFalloff(distTo(index, 267), 0.25);
          y += 0.08 * wUpper;
          break;
        }

        case 'mouthFrownLeft': {
          const w = smoothRadialFalloff(distTo(index, 61), 0.32);
          y -= 0.18 * w;
          x += 0.04 * w;
          break;
        }

        case 'mouthFrownRight': {
          const w = smoothRadialFalloff(distTo(index, 291), 0.32);
          y -= 0.18 * w;
          x -= 0.04 * w;
          break;
        }

        case 'mouthPucker': {
          const w = smoothRadialFalloff(distToPoint(index, pMouthCenter), 0.42);
          const dx = base.x - pMouthCenter.x;
          x -= dx * 0.45 * w;
          z += 0.18 * w;
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
          x -= 0.08 * w;
          z -= 0.12 * w;
          break;
        }

        case 'mouthDimpleRight': {
          const w = smoothRadialFalloff(distTo(index, 291), 0.28);
          x += 0.08 * w;
          z -= 0.12 * w;
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
            y -= 0.20 * w;
            z -= 0.06 * w;
          }
          break;
        }

        case 'mouthLowerDownRight': {
          if (!UPPER_LIP_SET.has(index) && base.y <= pMouthCenter.y + 0.01) {
            const w = smoothRadialFalloff(distTo(index, 317), 0.25);
            y -= 0.20 * w;
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
          if (UPPER_LIP_SET.has(index) || base.y > pMouthCenter.y) {
            const wUpper = smoothRadialFalloff(distTo(index, 13), 0.22);
            y -= 0.08 * wUpper;
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
          // Upper lid drops down smoothly to meet lower lid
          const wUpper = smoothRadialFalloff(distTo(index, 159), 0.16);
          const pLower = basePoints[145] || basePoints[159];
          const dy = pLower.y - (basePoints[159]?.y || pLower.y);
          y += dy * 0.95 * wUpper;

          // Lower lid rises subtly
          const wLower = smoothRadialFalloff(distTo(index, 145), 0.12);
          y += 0.02 * wLower;
          break;
        }

        case 'eyeBlinkRight': {
          const wUpper = smoothRadialFalloff(distTo(index, 386), 0.16);
          const pLower = basePoints[374] || basePoints[386];
          const dy = pLower.y - (basePoints[386]?.y || pLower.y);
          y += dy * 0.95 * wUpper;

          const wLower = smoothRadialFalloff(distTo(index, 374), 0.12);
          y += 0.02 * wLower;
          break;
        }

        case 'eyeWideLeft': {
          const wUpper = smoothRadialFalloff(distTo(index, 159), 0.20);
          const wLower = smoothRadialFalloff(distTo(index, 145), 0.18);
          y += 0.10 * wUpper;
          y -= 0.05 * wLower;
          break;
        }

        case 'eyeWideRight': {
          const wUpper = smoothRadialFalloff(distTo(index, 386), 0.20);
          const wLower = smoothRadialFalloff(distTo(index, 374), 0.18);
          y += 0.10 * wUpper;
          y -= 0.05 * wLower;
          break;
        }

        case 'eyeSquintLeft': {
          const w = smoothRadialFalloff(distTo(index, 145), 0.20);
          const wCheek = smoothRadialFalloff(distTo(index, 116), 0.25);
          y += 0.08 * w + 0.04 * wCheek;
          break;
        }

        case 'eyeSquintRight': {
          const w = smoothRadialFalloff(distTo(index, 374), 0.20);
          const wCheek = smoothRadialFalloff(distTo(index, 345), 0.25);
          y += 0.08 * w + 0.04 * wCheek;
          break;
        }

        case 'eyeLookUpLeft':
        case 'eyeLookUpRight': {
          const anchor = blendshapeName === 'eyeLookUpLeft' ? 159 : 386;
          const w = smoothRadialFalloff(distTo(index, anchor), 0.18);
          y += 0.06 * w;
          break;
        }

        case 'eyeLookDownLeft':
        case 'eyeLookDownRight': {
          const anchor = blendshapeName === 'eyeLookDownLeft' ? 145 : 374;
          const w = smoothRadialFalloff(distTo(index, anchor), 0.18);
          y -= 0.06 * w;
          break;
        }

        case 'eyeLookInLeft': {
          const w = smoothRadialFalloff(distTo(index, 133), 0.18);
          x += 0.06 * w;
          break;
        }

        case 'eyeLookOutLeft': {
          const w = smoothRadialFalloff(distTo(index, 33), 0.18);
          x -= 0.06 * w;
          break;
        }

        case 'eyeLookInRight': {
          const w = smoothRadialFalloff(distTo(index, 362), 0.18);
          x -= 0.06 * w;
          break;
        }

        case 'eyeLookOutRight': {
          const w = smoothRadialFalloff(distTo(index, 263), 0.18);
          x += 0.06 * w;
          break;
        }

        // ==========================================
        // 4. EYEBROWS BLENDSHAPES
        // ==========================================
        case 'browInnerUp': {
          const w = smoothRadialFalloff(distTo(index, 168), 0.35);
          y += 0.20 * w;
          break;
        }

        case 'browDownLeft': {
          const w = smoothRadialFalloff(distTo(index, 105), 0.30);
          y -= 0.18 * w;
          x += 0.05 * w;
          break;
        }

        case 'browDownRight': {
          const w = smoothRadialFalloff(distTo(index, 334), 0.30);
          y -= 0.18 * w;
          x -= 0.05 * w;
          break;
        }

        case 'browOuterUpLeft': {
          const w = smoothRadialFalloff(distTo(index, 70), 0.28);
          y += 0.18 * w;
          break;
        }

        case 'browOuterUpRight': {
          const w = smoothRadialFalloff(distTo(index, 300), 0.28);
          y += 0.18 * w;
          break;
        }

        // ==========================================
        // 5. CHEEKS & NOSE BLENDSHAPES
        // ==========================================
        case 'cheekPuff': {
          const wLeft = smoothRadialFalloff(distTo(index, 205), 0.38);
          const wRight = smoothRadialFalloff(distTo(index, 425), 0.38);
          z += 0.18 * (wLeft + wRight);
          x -= 0.14 * wLeft;
          x += 0.14 * wRight;
          break;
        }

        case 'cheekSquintLeft': {
          const w = smoothRadialFalloff(distTo(index, 205), 0.32);
          y += 0.14 * w;
          break;
        }

        case 'cheekSquintRight': {
          const w = smoothRadialFalloff(distTo(index, 425), 0.32);
          y += 0.14 * w;
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

      vertices.push(x, y, z);
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
