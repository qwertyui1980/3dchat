import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { ARKitBlendshapeMapper } from './arkitMapper';
import { TextureMapper } from './textureMapper';
import { FaceMeshGenerator } from './faceMeshGenerator';

export interface Face3DGenerationResult {
  faceMesh: THREE.Mesh;
  headModel: THREE.Group | null;
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
    imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
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

    // Face mesh generation
    const meshGenerator = new FaceMeshGenerator();
    const faceMesh = meshGenerator.generateWithMorphTargets(
      landmarks,
      blendshapes,
      transformMatrix,
      textureCanvas
    );
    faceMesh.name = 'faceMesh';

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

    return {
      faceMesh,
      headModel,
      blendshapes,
      textureCanvas,
      landmarks,
      skinColor: faceMesh.userData.skinColor || { r: 0.85, g: 0.75, b: 0.65 },
    };
  }

  applyTransforms(
    faceMesh: THREE.Mesh,
    headModel: THREE.Group | null,
    params: TransformDebugParams
  ): void {
    if (!faceMesh) return;

    faceMesh.scale.set(params.face.scaleX, params.face.scaleY, params.face.scaleZ);
    faceMesh.rotation.set(
      THREE.MathUtils.degToRad(params.face.rotationX),
      THREE.MathUtils.degToRad(params.face.rotationY),
      THREE.MathUtils.degToRad(params.face.rotationZ)
    );
    faceMesh.position.set(
      params.face.posOffsetX,
      params.face.posOffsetY,
      params.face.posOffsetZ
    );

    if (headModel) {
      faceMesh.geometry.computeBoundingBox();
      const faceBox = new THREE.Box3().setFromObject(faceMesh);
      const faceWidth = faceBox.max.x - faceBox.min.x;
      const faceHeight = faceBox.max.y - faceBox.min.y;
      const faceCenter = faceBox.getCenter(new THREE.Vector3());

      headModel.scale.set(1, 1, 1);
      headModel.rotation.set(0, 0, 0);
      headModel.position.set(0, 0, 0);
      headModel.updateMatrixWorld(true);

      const resetHeadBox = new THREE.Box3().setFromObject(headModel);
      const headWidth = resetHeadBox.max.x - resetHeadBox.min.x || 1;
      const headHeight = resetHeadBox.max.y - resetHeadBox.min.y || 1;

      const targetHeadWidth = faceWidth * params.head.scaleMultiplierX;
      const targetHeadHeight = faceHeight * params.head.scaleMultiplierY;

      const scaleX = targetHeadWidth / headWidth;
      const scaleY = targetHeadHeight / headHeight;
      const scaleZ =
        Math.max(scaleX, scaleY) *
        (params.head.scaleMultiplierZ / params.head.scaleMultiplierY);

      headModel.scale.set(scaleX, scaleY, scaleZ);
      headModel.rotation.set(
        THREE.MathUtils.degToRad(params.head.rotationX),
        THREE.MathUtils.degToRad(params.head.rotationY),
        THREE.MathUtils.degToRad(params.head.rotationZ)
      );
      headModel.updateMatrixWorld(true);

      const scaledHeadBox = new THREE.Box3().setFromObject(headModel);
      const scaledHeadCenter = scaledHeadBox.getCenter(new THREE.Vector3());
      const scaledHeadDepth = scaledHeadBox.max.z - scaledHeadBox.min.z;

      const offsetX = faceCenter.x - scaledHeadCenter.x + params.head.posOffsetX;
      const offsetY = faceCenter.y - scaledHeadCenter.y + params.head.posOffsetY;
      const targetZ = faceCenter.z - scaledHeadCenter.z;
      const pushBack = scaledHeadDepth * params.head.pushBackFactor;
      const offsetZ = targetZ - pushBack + params.head.posOffsetZ;

      headModel.position.set(offsetX, offsetY, offsetZ);
    }
  }

  async exportGLB(
    faceMesh: THREE.Mesh,
    headModel: THREE.Group | null,
    includeHead: boolean = true
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const exporter = new GLTFExporter();
      const exportGroup = new THREE.Group();
      exportGroup.name = 'FaceToBlendshapeModel';

      exportGroup.add(faceMesh.clone());
      if (headModel && includeHead) {
        exportGroup.add(headModel.clone());
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
