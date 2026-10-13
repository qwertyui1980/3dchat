import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { ARKitBlendshapeMapper } from './arkitMapper';
import { TextureMapper } from './textureMapper';
import {
  FaceMeshGenerator,
  MouthCustomizationParams,
  DEFAULT_MOUTH_PARAMS,
  GestureCalibrationParams,
  DEFAULT_GESTURE_PARAMS,
  generateOralCavityMesh,
  createTrackingPointsMesh,
} from './faceMeshGenerator';
import { BustGenerator, BustOptions, ClothingStyle } from './bustGenerator';
import {
  EyeGenerator,
  EyePairResult,
  EyeCustomizationOptions,
  DEFAULT_EYE_OPTIONS,
} from './eyeGenerator';

export type {
  GestureCalibrationParams,
  MouthCustomizationParams,
};
export {
  DEFAULT_GESTURE_PARAMS,
  DEFAULT_MOUTH_PARAMS,
  createTrackingPointsMesh,
};

export interface Face3DGenerationResult {
  faceMesh: THREE.Mesh;
  headModel: THREE.Group | null;
  bustModel: THREE.Group | null;
  eyesGroup: THREE.Group | null;
  eyePairResult: EyePairResult | null;
  oralCavity: THREE.Group | null;
  blendshapes: Record<string, number>;
  textureCanvas: HTMLCanvasElement;
  landmarks: Array<{ x: number; y: number; z: number }>;
  skinColor: { r: number; g: number; b: number };
}

export interface TransformDebugParams {
  head: {
    scaleMultiplierX: number;
    scaleMultiplierY: number;
    scaleMultiplierZ: number;
    posOffsetX: number;
    posOffsetY: number;
    posOffsetZ: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    pushBackFactor: number;
  };
  face: {
    scaleUniform: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    posOffsetX: number;
    posOffsetY: number;
    posOffsetZ: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
  };
  mouth: MouthCustomizationParams;
  eyes: EyeCustomizationOptions;
}

export const DEFAULT_DEBUG_PARAMS: TransformDebugParams = {
  head: {
    scaleMultiplierX: 1.15,
    scaleMultiplierY: 1.45,
    scaleMultiplierZ: 1.45,
    posOffsetX: 0,
    posOffsetY: 0,
    posOffsetZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    pushBackFactor: 0.4,
  },
  face: {
    scaleUniform: 1.0,
    scaleX: 1.0,
    scaleY: 1.0,
    scaleZ: 1.0,
    posOffsetX: 0,
    posOffsetY: 0,
    posOffsetZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  },
  mouth: { ...DEFAULT_MOUTH_PARAMS },
  eyes: { ...DEFAULT_EYE_OPTIONS },
};

export class FaceToBlendshapeService {
  private static instance: FaceToBlendshapeService | null = null;
  private faceLandmarker: FaceLandmarker | null = null;
  private isInitializing = false;
  private headBaseModelCache: THREE.Group | null = null;

  public static getInstance(): FaceToBlendshapeService {
    if (!FaceToBlendshapeService.instance) {
      FaceToBlendshapeService.instance = new FaceToBlendshapeService();
    }
    return FaceToBlendshapeService.instance;
  }

  async initLandmarker(): Promise<FaceLandmarker> {
    if (this.faceLandmarker) return this.faceLandmarker;
    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.faceLandmarker) return this.faceLandmarker;
    }

    this.isInitializing = true;
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'IMAGE',
        numFaces: 1,
      });
      return this.faceLandmarker;
    } finally {
      this.isInitializing = false;
    }
  }

  async loadHeadBaseModel(): Promise<THREE.Group | null> {
    if (this.headBaseModelCache) {
      return this.headBaseModelCache.clone();
    }

    return new Promise((resolve) => {
      const loader = new GLTFLoader();
      const headUrls = ['/head.glb', '/models/head.glb'];

      const tryLoad = (idx: number) => {
        if (idx >= headUrls.length) {
          resolve(null);
          return;
        }
        loader.load(
          headUrls[idx],
          (gltf) => {
            const model = gltf.scene;
            model.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.material = new THREE.MeshStandardMaterial({
                  color: new THREE.Color(0.8, 0.6, 0.5),
                  roughness: 0.6,
                  metalness: 0.0,
                  emissive: new THREE.Color(0.3, 0.2, 0.15),
                  emissiveIntensity: 0.4,
                  side: THREE.FrontSide,
                });
                mesh.castShadow = false;
                mesh.receiveShadow = false;
              }
            });
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center);
            this.headBaseModelCache = model;
            resolve(model.clone());
          },
          undefined,
          () => tryLoad(idx + 1)
        );
      };

      tryLoad(0);
    });
  }

  async processFaceImage(
    imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    options?: {
      bustOptions?: Partial<BustOptions>;
      mouthParams?: Partial<MouthCustomizationParams>;
      eyeOptions?: Partial<EyeCustomizationOptions>;
    }
  ): Promise<Face3DGenerationResult> {
    const landmarker = await this.initLandmarker();
    const results = landmarker.detect(imageElement);

    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      throw new Error('No se detectó ningún rostro en la imagen. Intenta con una foto frontal clara y bien iluminada.');
    }

    const rawLandmarks = results.faceLandmarks[0];
    const landmarks = rawLandmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }));
    const rawBlendshapes = results.faceBlendshapes?.[0]?.categories || [];
    const transformMatrix = results.facialTransformationMatrixes?.[0];

    // ARKit blendshapes mapping
    const mapper = new ARKitBlendshapeMapper();
    const blendshapes = mapper.mapMediaPipeToARKit(rawBlendshapes, landmarks);

    // Texture generation
    const textureMapper = new TextureMapper(1024);
    const textureCanvas = textureMapper.createFaceTexture(imageElement, landmarks);

    // Face mesh generation with mouth parameters
    const meshGenerator = new FaceMeshGenerator();
    const faceMesh = meshGenerator.generateWithMorphTargets(
      landmarks,
      blendshapes,
      transformMatrix,
      textureCanvas,
      options?.mouthParams
    );
    faceMesh.name = 'faceMesh';

    // 3D Eyeballs generation (sclera + procedural iris + pupil + cornea + gaze tracking)
    let eyesGroup: THREE.Group | null = null;
    let eyePairResult: EyePairResult | null = null;
    const canonicalPoints = faceMesh.userData.canonicalPoints;
    if (canonicalPoints && Array.isArray(canonicalPoints)) {
      eyePairResult = EyeGenerator.generateEyePair(canonicalPoints, options?.eyeOptions);
      eyesGroup = eyePairResult.group;
    }

    // Oral cavity generation (inner chamber + dental arches)
    const mouthCenter = faceMesh.userData.mouthCenter || { x: 0, y: -0.32, z: -0.15 };
    const oralCavity = generateOralCavityMesh(mouthCenter, 0.28);

    // Load head base model
    const headModel = await this.loadHeadBaseModel();
    if (headModel) {
      headModel.name = 'headModel';
      const skinColor = faceMesh.userData.skinColor || { r: 0.85, g: 0.75, b: 0.65 };
      headModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat && mat.color) {
            const r = Math.max(skinColor.r * 1.2, 0.5);
            const g = Math.max(skinColor.g * 1.2, 0.4);
            const b = Math.max(skinColor.b * 1.2, 0.3);
            mat.color.setRGB(r, g, b);
            if (mat.emissive) {
              mat.emissive.setRGB(r * 0.3, g * 0.3, b * 0.3);
            }
            mat.needsUpdate = true;
          }
        }
      });
    }

    // Generate Torso & Shoulders Bust
    const bustGenerator = new BustGenerator();
    const skinColor = faceMesh.userData.skinColor || { r: 0.85, g: 0.75, b: 0.65 };
    const bustModel = bustGenerator.generateBust({
      style: options?.bustOptions?.style || 'suit',
      suitColor: options?.bustOptions?.suitColor || '#172554',
      shirtColor: options?.bustOptions?.shirtColor || '#f8fafc',
      tieColor: options?.bustOptions?.tieColor || '#991b1b',
      skinColor,
    });
    bustModel.name = 'bustModel';

    return {
      faceMesh,
      headModel,
      bustModel,
      eyesGroup,
      eyePairResult,
      oralCavity,
      blendshapes,
      textureCanvas,
      landmarks,
      skinColor,
    };
  }

  applyTransforms(
    faceMesh: THREE.Mesh,
    headModel: THREE.Group | null,
    bustModel: THREE.Group | null = null,
    params: TransformDebugParams = DEFAULT_DEBUG_PARAMS,
    eyesGroup: THREE.Group | null = null,
    oralCavity: THREE.Group | null = null,
    eyePairResult: EyePairResult | null = null,
    trackingPointsMesh: THREE.Points | null = null
  ): void {
    if (!faceMesh) return;

    // 1. Calculate intrinsic (geometry-level) base dimensions of the canonical face
    if (!faceMesh.geometry.boundingBox) {
      faceMesh.geometry.computeBoundingBox();
    }
    const geoBox = faceMesh.geometry.boundingBox!;
    const baseFaceWidth = Math.max(0.001, geoBox.max.x - geoBox.min.x);
    const baseFaceHeight = Math.max(0.001, geoBox.max.y - geoBox.min.y);
    const baseFaceCenter = geoBox.getCenter(new THREE.Vector3());

    // 2. Apply EXCLUSIVE transforms to faceMesh
    const uniScale = params.face.scaleUniform ?? 1.0;
    const effScaleX = (params.face.scaleX ?? 1.0) * uniScale;
    const effScaleY = (params.face.scaleY ?? 1.0) * uniScale;
    const effScaleZ = (params.face.scaleZ ?? 1.0) * uniScale;

    faceMesh.scale.set(effScaleX, effScaleY, effScaleZ);
    faceMesh.rotation.set(
      THREE.MathUtils.degToRad(params.face.rotationX || 0),
      THREE.MathUtils.degToRad(params.face.rotationY || 0),
      THREE.MathUtils.degToRad(params.face.rotationZ || 0)
    );
    faceMesh.position.set(
      params.face.posOffsetX || 0,
      params.face.posOffsetY || 0,
      params.face.posOffsetZ || 0
    );

    // 3. Align 3D Eyeballs group directly locked to faceMesh coordinate space
    if (eyePairResult && params.eyes) {
      eyePairResult.updateOptions(params.eyes);
    }
    if (eyesGroup) {
      eyesGroup.scale.copy(faceMesh.scale);
      eyesGroup.rotation.copy(faceMesh.rotation);
      eyesGroup.position.copy(faceMesh.position);
      eyesGroup.visible = params.eyes?.enabled ?? true;
    }

    // 4. Align Oral Cavity backing mesh directly locked to faceMesh coordinate space
    if (oralCavity) {
      oralCavity.scale.copy(faceMesh.scale);
      oralCavity.rotation.copy(faceMesh.rotation);
      oralCavity.position.copy(faceMesh.position);
      oralCavity.visible = params.mouth?.oralCavityEnabled ?? true;
    }

    // 5. Align 478 Landmark Tracking Points mesh
    if (trackingPointsMesh) {
      trackingPointsMesh.scale.copy(faceMesh.scale);
      trackingPointsMesh.rotation.copy(faceMesh.rotation);
      trackingPointsMesh.position.copy(faceMesh.position);
    }

    // 5. Align Head Base Model independently based on stable base face dimensions
    if (headModel) {
      headModel.scale.set(1, 1, 1);
      headModel.rotation.set(0, 0, 0);
      headModel.position.set(0, 0, 0);
      headModel.updateMatrixWorld(true);

      const resetHeadBox = new THREE.Box3().setFromObject(headModel);
      const headWidth = Math.max(0.001, resetHeadBox.max.x - resetHeadBox.min.x);
      const headHeight = Math.max(0.001, resetHeadBox.max.y - resetHeadBox.min.y);

      const targetHeadWidth = baseFaceWidth * params.head.scaleMultiplierX;
      const targetHeadHeight = baseFaceHeight * params.head.scaleMultiplierY;

      const scaleX = targetHeadWidth / headWidth;
      const scaleY = targetHeadHeight / headHeight;
      const scaleZ =
        Math.max(scaleX, scaleY) *
        (params.head.scaleMultiplierZ / params.head.scaleMultiplierY);

      headModel.scale.set(scaleX, scaleY, scaleZ);
      headModel.rotation.set(
        THREE.MathUtils.degToRad(params.head.rotationX || 0),
        THREE.MathUtils.degToRad(params.head.rotationY || 0),
        THREE.MathUtils.degToRad(params.head.rotationZ || 0)
      );
      headModel.updateMatrixWorld(true);

      const scaledHeadBox = new THREE.Box3().setFromObject(headModel);
      const scaledHeadCenter = scaledHeadBox.getCenter(new THREE.Vector3());
      const scaledHeadDepth = scaledHeadBox.max.z - scaledHeadBox.min.z;

      const offsetX = baseFaceCenter.x - scaledHeadCenter.x + (params.head.posOffsetX || 0);
      const offsetY = baseFaceCenter.y - scaledHeadCenter.y + (params.head.posOffsetY || 0);
      const targetZ = baseFaceCenter.z - scaledHeadCenter.z;
      const pushBack = scaledHeadDepth * (params.head.pushBackFactor ?? 0.4);
      const offsetZ = targetZ - pushBack + (params.head.posOffsetZ || 0);

      headModel.position.set(offsetX, offsetY, offsetZ);
    }

    // 6. Align Torso & Bust Model seamlessly below the neck
    if (bustModel) {
      const headBaseY = headModel ? headModel.position.y : baseFaceCenter.y;
      const bustY = headBaseY - baseFaceHeight * 0.48;
      const bustZ = baseFaceCenter.z - 0.08 + (params.head?.posOffsetZ || 0) * 0.5;
      bustModel.position.set(
        baseFaceCenter.x + (params.head?.posOffsetX || 0) * 0.5,
        bustY,
        bustZ
      );
    }
  }

  async exportGLB(
    faceMesh: THREE.Mesh,
    headModel: THREE.Group | null,
    bustModel: THREE.Group | null = null,
    eyesGroup: THREE.Group | null = null,
    oralCavity: THREE.Group | null = null,
    includeHead: boolean = true,
    includeBust: boolean = true,
    includeEyes: boolean = true,
    includeOralCavity: boolean = true,
    calibrationMeta?: {
      mouthParams?: MouthCustomizationParams;
      gestureParams?: GestureCalibrationParams;
      canonicalLandmarks?: Array<{ x: number; y: number; z: number }>;
    }
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter();
      const exportGroup = new THREE.Group();
      exportGroup.name = 'FaceToBlendshapeModel';

      const clonedFace = faceMesh.clone();
      clonedFace.name = 'faceMesh';
      if (clonedFace.morphTargetInfluences) {
        clonedFace.morphTargetInfluences = new Array(clonedFace.morphTargetInfluences.length).fill(0);
      }
      if (faceMesh.morphTargetDictionary) {
        clonedFace.morphTargetDictionary = { ...faceMesh.morphTargetDictionary };
      }
      exportGroup.add(clonedFace);

      // ── neckPivot anchor ──────────────────────────────────────────────────
      // A named Object3D at chin/neck level lets ThreeAvatarCanvas distribute
      // head rotation between neck (35%) and face (75%) for organic movement.
      // Position is derived from the chin landmark (152) stored in faceMesh userData.
      const neckPivot = new THREE.Object3D();
      neckPivot.name = 'neckPivot';
      const mouthCenter = (faceMesh.userData.mouthCenter as { x: number; y: number; z: number } | undefined);
      // Neck sits ~0.22 units below the mouth center in canonical space (scaled by faceMesh)
      const neckOffsetY = (mouthCenter?.y ?? 0) - 0.22;
      neckPivot.position.set(
        faceMesh.position.x,
        faceMesh.position.y + neckOffsetY * (faceMesh.scale.y || 1),
        faceMesh.position.z
      );
      exportGroup.add(neckPivot);

      // ── Calibration metadata node ─────────────────────────────────────────
      // Embeds all studio parameters so avatars can be re-edited with the exact
      // same calibration point they were created with.
      if (calibrationMeta) {
        const metaNode = new THREE.Object3D();
        metaNode.name = 'xstreamx_meta';
        metaNode.userData.version = 2;
        if (calibrationMeta.mouthParams) {
          metaNode.userData.mouthParams = JSON.parse(JSON.stringify(calibrationMeta.mouthParams));
        }
        if (calibrationMeta.gestureParams) {
          metaNode.userData.gestureParams = JSON.parse(JSON.stringify(calibrationMeta.gestureParams));
        }
        if (calibrationMeta.canonicalLandmarks) {
          // Store every 4th landmark (every 4 = 120 points, ~1.4 KB) to save GLB space.
          // Full 478-point array can be reconstructed by the studio via interpolation.
          const compressed = calibrationMeta.canonicalLandmarks
            .filter((_: unknown, i: number) => i % 4 === 0)
            .map((p: { x: number; y: number; z: number }) => [+p.x.toFixed(5), +p.y.toFixed(5), +p.z.toFixed(5)]);
          metaNode.userData.landmarksSampled = compressed;
        }
        exportGroup.add(metaNode);
      }

      // Include 3D Eyeballs with left and right eye objects
      if (eyesGroup && includeEyes) {
        const clonedEyes = eyesGroup.clone(true);
        clonedEyes.name = 'eyesGroup';
        exportGroup.add(clonedEyes);
      }

      // Include Oral Cavity backing mesh
      if (oralCavity && includeOralCavity) {
        const clonedCavity = oralCavity.clone(true);
        clonedCavity.name = 'oralCavity';
        exportGroup.add(clonedCavity);
      }

      if (headModel && includeHead) {
        const clonedHead = headModel.clone();
        clonedHead.name = 'headBaseMesh';
        exportGroup.add(clonedHead);
      }

      if (bustModel && includeBust) {
        const clonedBust = bustModel.clone();
        clonedBust.name = 'torsoBustMesh';
        exportGroup.add(clonedBust);
      }

      exporter.parse(
        exportGroup,
        (result) => {
          if (result instanceof ArrayBuffer) {
            resolve(result);
          } else {
            const blob = new Blob([JSON.stringify(result, null, 2)], {
              type: 'application/json',
            });
            blob.arrayBuffer().then(resolve).catch(reject);
          }
        },
        (err) => {
          reject(err);
        },
        {
          binary: true,
          embedImages: true,
          maxTextureSize: 2048,
          truncateDrawRange: false,
        }
      );
    });
  }
}

export const faceToBlendshapeServiceSingleton = FaceToBlendshapeService.getInstance();
