import * as THREE from 'three';
import { Point3D } from './faceMeshGenerator';

export interface EyeCustomizationOptions {
  enabled: boolean;
  scale: number;        // 0.6 to 1.6 (default 1.0)
  spacingX: number;     // -0.15 to 0.15 (default 0)
  offsetY: number;      // -0.15 to 0.15 (default 0)
  offsetZ: number;      // -0.15 to 0.15 (default 0)
  irisColor: string;    // Hex color string (e.g. '#00e5ff')
  pupilColor: string;   // Hex color string (default '#000000')
  pupilSize: number;    // 0.2 to 0.5 (default 0.35)
  gazeTracking: boolean;// whether to track webcam gaze
  manualGazeX: number;  // -1 to 1 (default 0)
  manualGazeY: number;  // -1 to 1 (default 0)
}

export const DEFAULT_EYE_OPTIONS: EyeCustomizationOptions = {
  enabled: true,
  scale: 1.0,
  spacingX: 0,
  offsetY: 0,
  offsetZ: 0,
  irisColor: '#00e5ff',
  pupilColor: '#000000',
  pupilSize: 0.35,
  gazeTracking: true,
  manualGazeX: 0,
  manualGazeY: 0,
};

export const IRIS_COLOR_PRESETS = [
  { name: 'Cyber Cyan', color: '#00e5ff' },
  { name: 'Azul Océano', color: '#2563eb' },
  { name: 'Verde Esmeralda', color: '#059669' },
  { name: 'Miel / Avellana', color: '#d97706' },
  { name: 'Marrón Café', color: '#451a03' },
  { name: 'Gris Platino', color: '#94a3b8' },
  { name: 'Violeta Neón', color: '#8b5cf6' },
  { name: 'Rojo Carmesí', color: '#dc2626' },
];

export const PUPIL_COLOR_PRESETS = [
  { name: 'Negro Obsidiana', color: '#000000' },
  { name: 'Rojo Carmesí', color: '#dc2626' },
  { name: 'Púrpura Místico', color: '#8b5cf6' },
  { name: 'Azul Abisal', color: '#1d4ed8' },
  { name: 'Ámbar Felino', color: '#d97706' },
  { name: 'Verde Esmeralda', color: '#059669' },
  { name: 'Gris Grafito', color: '#64748b' },
  { name: 'Blanco Fantasma', color: '#f8fafc' },
];

export interface EyePairResult {
  group: THREE.Group;
  eyeLeft: THREE.Group;
  eyeRight: THREE.Group;
  baseLeftPos: THREE.Vector3;
  baseRightPos: THREE.Vector3;
  updateGaze: (gazeX: number, gazeY: number) => void;
  updateOptions: (options: Partial<EyeCustomizationOptions>) => void;
  setIrisColor: (hexColor: string) => void;
  setPupilColor: (hexColor: string) => void;
  setPupilSize: (pupilRatio: number) => void;
}

/**
 * Procedural generator for 3D Eyeballs with realistic sclera, iris striations, pupil,
 * corneal clearcoat reflection, and real-time webcam gaze tracking kinematics.
 */
export class EyeGenerator {
  private static irisTextureCache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Generates a high-resolution procedural iris texture canvas
   * with limbal ring, radiating fiber stroma, collarette, pupil, and specular gloss.
   */
  public static createIrisTexture(
    irisHexColor: string,
    pupilRatio: number = 0.35,
    pupilHexColor: string = '#000000'
  ): THREE.CanvasTexture {
    const cacheKey = `${irisHexColor}_${pupilHexColor}_${pupilRatio.toFixed(2)}`;
    if (this.irisTextureCache.has(cacheKey)) {
      return this.irisTextureCache.get(cacheKey)!;
    }

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.48;

      // 1. Transparent background
      ctx.clearRect(0, 0, size, size);

      // 2. Outer limbal ring (dark transition at the border of iris)
      const limbalGrad = ctx.createRadialGradient(cx, cy, radius * 0.65, cx, cy, radius);
      limbalGrad.addColorStop(0, irisHexColor);
      limbalGrad.addColorStop(0.85, irisHexColor);
      limbalGrad.addColorStop(1, '#05070a');

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = limbalGrad;
      ctx.fill();

      // 3. Organic radiating iris stroma fibers
      const numFibers = 160;
      const baseColor = new THREE.Color(irisHexColor);
      const lightColor = baseColor.clone().offsetHSL(0, -0.1, 0.25).getHexString();
      const darkColor = baseColor.clone().offsetHSL(0, 0.15, -0.3).getHexString();

      ctx.save();
      ctx.translate(cx, cy);
      for (let i = 0; i < numFibers; i++) {
        const angle = (i / numFibers) * Math.PI * 2;
        const fiberLen = radius * (0.68 + (Math.sin(i * 12.3) * 0.15));
        const startRad = radius * (pupilRatio + 0.04);

        ctx.strokeStyle = i % 2 === 0 ? `#${lightColor}` : `#${darkColor}`;
        ctx.globalAlpha = 0.28 + (Math.sin(i * 7.7) * 0.18);
        ctx.lineWidth = 1.2 + (Math.cos(i * 4.1) * 0.8);

        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * startRad, Math.sin(angle) * startRad);
        ctx.lineTo(Math.cos(angle) * fiberLen, Math.sin(angle) * fiberLen);
        ctx.stroke();
      }
      ctx.restore();

      // 4. Collarette ring (middle luminous halo)
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = `#${lightColor}`;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = radius * 0.08;
      ctx.stroke();

      // 5. Central Pupil (custom pupil color with antialiased edge)
      const pupilRadius = radius * Math.max(0.18, Math.min(0.55, pupilRatio));
      const pupilGrad = ctx.createRadialGradient(cx, cy, pupilRadius * 0.82, cx, cy, pupilRadius);
      pupilGrad.addColorStop(0, pupilHexColor);
      pupilGrad.addColorStop(0.95, pupilHexColor);
      pupilGrad.addColorStop(1, pupilHexColor);

      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.arc(cx, cy, pupilRadius, 0, Math.PI * 2);
      ctx.fillStyle = pupilGrad;
      ctx.fill();

      // Subtle limbal reflection only at the edge of the iris (away from pupil)
      ctx.beginPath();
      ctx.arc(cx - radius * 0.55, cy - radius * 0.55, radius * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    this.irisTextureCache.set(cacheKey, texture);
    return texture;
  }

  /**
   * Builds an individual 3D eyeball group consisting of:
   * - Sclera sphere (white of the eye with realistic gloss)
   * - Iris concave disc oriented along +Z
   * - Physical pupil disc with customizable pupil color
   * - Ultra-clear non-occluding cornea dome
   */
  public static buildSingleEyeball(
    name: string,
    radius: number,
    irisColor: string,
    pupilRatio: number = 0.35,
    pupilColor: string = '#000000'
  ): { eyeGroup: THREE.Group; irisMesh: THREE.Mesh; pupilMesh: THREE.Mesh; corneaMesh: THREE.Mesh; baseIrisRadius: number } {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = name;

    // 1. Sclera (White sphere with slight warmth and front corneal opening)
    // Front opening from theta = 0 to 0.48 so the white sclera never occludes the iris or pupil
    const scleraGeo = new THREE.SphereGeometry(radius, 32, 24, 0, Math.PI * 2, 0.48, Math.PI - 0.48);
    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xfcfbfa,
      roughness: 0.18,
      metalness: 0.02,
      emissive: new THREE.Color(0x18181b),
      emissiveIntensity: 0.08,
      side: THREE.FrontSide,
    });
    const scleraMesh = new THREE.Mesh(scleraGeo, scleraMat);
    scleraMesh.name = `${name}_sclera`;
    scleraMesh.rotation.x = Math.PI / 2; // Point opening forward in +Z
    scleraMesh.castShadow = true;
    scleraMesh.receiveShadow = true;
    scleraMesh.renderOrder = 1;
    eyeGroup.add(scleraMesh);

    // 2. Iris disc positioned at the front (+Z) of the eyeball inside the corneal opening
    const irisRadius = radius * 0.54;
    const irisGeo = new THREE.CircleGeometry(irisRadius, 32);
    const irisTexture = this.createIrisTexture(irisColor, pupilRatio, pupilColor);
    const irisMat = new THREE.MeshStandardMaterial({
      map: irisTexture,
      roughness: 0.25,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
    });
    const irisMesh = new THREE.Mesh(irisGeo, irisMat);
    irisMesh.name = `${name}_iris`;
    irisMesh.position.z = radius * 0.88;
    irisMesh.renderOrder = 2;
    eyeGroup.add(irisMesh);

    // 3. Physical Central Pupil disc (customizable color, guaranteed visible under any lighting)
    const pRadius = irisRadius * DEFAULT_EYE_OPTIONS.pupilSize;
    const pupilGeo = new THREE.CircleGeometry(pRadius, 32);
    const pupilMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(pupilColor),
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const pupilMesh = new THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.name = `${name}_pupil`;
    pupilMesh.position.z = radius * 0.888; // Positioned cleanly in front of iris disc
    pupilMesh.renderOrder = 3;
    const initialPupilScale = Math.max(0.18, Math.min(0.55, pupilRatio)) / DEFAULT_EYE_OPTIONS.pupilSize;
    pupilMesh.scale.set(initialPupilScale, initialPupilScale, 1.0);
    eyeGroup.add(pupilMesh);

    // 4. Ultra-clear non-occluding Cornea Dome (depthWrite: false ensures pupil/iris are never hidden)
    const corneaGeo = new THREE.SphereGeometry(irisRadius * 1.08, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.35);
    const corneaMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0.05,
      transparent: true,
      opacity: 0.12,
      depthWrite: false, // Never occlude pupil or iris
    });
    const corneaMesh = new THREE.Mesh(corneaGeo, corneaMat);
    corneaMesh.name = `${name}_cornea`;
    corneaMesh.rotation.x = Math.PI / 2; // Point dome forward in +Z
    corneaMesh.position.z = radius * 0.85;
    corneaMesh.renderOrder = 4;
    eyeGroup.add(corneaMesh);

    return { eyeGroup, irisMesh, pupilMesh, corneaMesh, baseIrisRadius: irisRadius };
  }

  /**
   * Generates a pair of calibrated 3D eyeballs attached to facial landmark anchors.
   */
  public static generateEyePair(
    canonicalPoints: Point3D[],
    options: Partial<EyeCustomizationOptions> = {}
  ): EyePairResult {
    const opts: EyeCustomizationOptions = { ...DEFAULT_EYE_OPTIONS, ...options };

    // 1. Compute anchor points from canonical face landmarks
    // Left eye landmarks: 33 (outer), 133 (inner), 159 (top), 145 (bottom), 468 (iris)
    // Right eye landmarks: 263 (outer), 362 (inner), 386 (top), 374 (bottom), 473 (iris)
    const pLeftOuter = canonicalPoints[33] || { x: -0.42, y: 0.16, z: -0.05 };
    const pLeftInner = canonicalPoints[133] || { x: -0.16, y: 0.16, z: -0.05 };
    const pLeftTop = canonicalPoints[159] || { x: -0.29, y: 0.22, z: -0.04 };
    const pLeftBottom = canonicalPoints[145] || { x: -0.29, y: 0.10, z: -0.06 };

    const pRightOuter = canonicalPoints[263] || { x: 0.42, y: 0.16, z: -0.05 };
    const pRightInner = canonicalPoints[362] || { x: 0.16, y: 0.16, z: -0.05 };
    const pRightTop = canonicalPoints[386] || { x: 0.29, y: 0.22, z: -0.04 };
    const pRightBottom = canonicalPoints[374] || { x: 0.29, y: 0.10, z: -0.06 };

    // Compute centers in normalized coordinates
    const leftCenterX = (pLeftOuter.x + pLeftInner.x) / 2;
    const leftCenterY = (pLeftTop.y + pLeftBottom.y) / 2;
    const leftCenterZ = (pLeftOuter.z + pLeftInner.z) / 2;

    const rightCenterX = (pRightOuter.x + pRightInner.x) / 2;
    const rightCenterY = (pRightTop.y + pRightBottom.y) / 2;
    const rightCenterZ = (pRightOuter.z + pRightInner.z) / 2;

    const eyeSocketWidth = Math.hypot(pLeftInner.x - pLeftOuter.x, pLeftInner.y - pLeftOuter.y) || 0.26;
    // Base eyeball radius scaled to match eye aperture anatomically
    const baseRadius = Math.max(0.08, eyeSocketWidth * 0.52);

    const baseLeftPos = new THREE.Vector3(
      leftCenterX,
      leftCenterY,
      leftCenterZ - baseRadius * 0.38
    );
    const baseRightPos = new THREE.Vector3(
      rightCenterX,
      rightCenterY,
      rightCenterZ - baseRadius * 0.38
    );

    const rootGroup = new THREE.Group();
    rootGroup.name = 'eyesGroup';

    // Build left and right eyeball objects
    // IMPORTANT: Names 'eyeLeft' and 'eyeRight' match threeCharacterBuilder.ts detection!
    const leftEyeData = this.buildSingleEyeball('eyeLeft', baseRadius, opts.irisColor, opts.pupilSize, opts.pupilColor);
    const rightEyeData = this.buildSingleEyeball('eyeRight', baseRadius, opts.irisColor, opts.pupilSize, opts.pupilColor);

    const eyeLeft = leftEyeData.eyeGroup;
    const eyeRight = rightEyeData.eyeGroup;

    rootGroup.add(eyeLeft);
    rootGroup.add(eyeRight);

    // Apply initial transforms & options
    const applyCurrentOptions = (currentOpts: EyeCustomizationOptions) => {
      rootGroup.visible = currentOpts.enabled;

      const scale = currentOpts.scale;
      eyeLeft.scale.set(scale, scale, scale);
      eyeRight.scale.set(scale, scale, scale);

      // Positioning with custom tuning offsets
      eyeLeft.position.set(
        baseLeftPos.x - currentOpts.spacingX,
        baseLeftPos.y + currentOpts.offsetY,
        baseLeftPos.z + currentOpts.offsetZ
      );

      eyeRight.position.set(
        baseRightPos.x + currentOpts.spacingX,
        baseRightPos.y + currentOpts.offsetY,
        baseRightPos.z + currentOpts.offsetZ
      );
    };

    applyCurrentOptions(opts);

    // Gaze tracking updater (yaw & pitch)
    // Max gaze rotation: ±28 deg yaw, ±20 deg pitch
    const updateGaze = (gazeX: number, gazeY: number) => {
      if (!opts.enabled) return;

      const clampedX = Math.max(-1, Math.min(1, gazeX));
      const clampedY = Math.max(-1, Math.min(1, gazeY));

      const maxYaw = THREE.MathUtils.degToRad(26);
      const maxPitch = THREE.MathUtils.degToRad(20);

      const targetYaw = clampedX * maxYaw;
      const targetPitch = -clampedY * maxPitch;

      // Organic lerp rotation
      eyeLeft.rotation.y = THREE.MathUtils.lerp(eyeLeft.rotation.y, targetYaw, 0.4);
      eyeLeft.rotation.x = THREE.MathUtils.lerp(eyeLeft.rotation.x, targetPitch, 0.4);

      eyeRight.rotation.y = THREE.MathUtils.lerp(eyeRight.rotation.y, targetYaw, 0.4);
      eyeRight.rotation.x = THREE.MathUtils.lerp(eyeRight.rotation.x, targetPitch, 0.4);
    };

    const setIrisColor = (hexColor: string) => {
      opts.irisColor = hexColor;
      const newTexture = EyeGenerator.createIrisTexture(hexColor, opts.pupilSize, opts.pupilColor);
      newTexture.needsUpdate = true;
      if (leftEyeData.irisMesh.material instanceof THREE.MeshStandardMaterial) {
        leftEyeData.irisMesh.material.map = newTexture;
        leftEyeData.irisMesh.material.needsUpdate = true;
      }
      if (rightEyeData.irisMesh.material instanceof THREE.MeshStandardMaterial) {
        rightEyeData.irisMesh.material.map = newTexture;
        rightEyeData.irisMesh.material.needsUpdate = true;
      }
    };

    const setPupilColor = (hexColor: string) => {
      opts.pupilColor = hexColor;
      const col = new THREE.Color(hexColor);
      if (leftEyeData.pupilMesh.material instanceof THREE.MeshBasicMaterial) {
        leftEyeData.pupilMesh.material.color.copy(col);
        leftEyeData.pupilMesh.material.needsUpdate = true;
      }
      if (rightEyeData.pupilMesh.material instanceof THREE.MeshBasicMaterial) {
        rightEyeData.pupilMesh.material.color.copy(col);
        rightEyeData.pupilMesh.material.needsUpdate = true;
      }
      setIrisColor(opts.irisColor);
    };

    const setPupilSize = (pupilRatio: number) => {
      const clamped = Math.max(0.18, Math.min(0.55, pupilRatio));
      opts.pupilSize = clamped;
      // Rescale physical pupil mesh
      const baseRatio = DEFAULT_EYE_OPTIONS.pupilSize;
      const scaleMultiplier = clamped / baseRatio;
      leftEyeData.pupilMesh.scale.set(scaleMultiplier, scaleMultiplier, 1.0);
      rightEyeData.pupilMesh.scale.set(scaleMultiplier, scaleMultiplier, 1.0);

      // Refresh iris texture with new pupil proportion
      setIrisColor(opts.irisColor);
    };

    const updateOptions = (newOpts: Partial<EyeCustomizationOptions>) => {
      Object.assign(opts, newOpts);
      if (newOpts.pupilColor) {
        setPupilColor(newOpts.pupilColor);
      }
      if (newOpts.irisColor) {
        setIrisColor(newOpts.irisColor);
      }
      if (newOpts.pupilSize !== undefined) {
        setPupilSize(newOpts.pupilSize);
      }
      applyCurrentOptions(opts);
    };

    return {
      group: rootGroup,
      eyeLeft,
      eyeRight,
      baseLeftPos,
      baseRightPos,
      updateGaze,
      updateOptions,
      setIrisColor,
      setPupilColor,
      setPupilSize,
    };
  }
}
