import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AvatarId, FaceFeatures, AvatarDefinition, DynamicTrackingMode } from '../../types';
import { normalizeTrackingMode } from '../../services/face3d/dynamicModeHelper';
import { getAvatarTrackingProfile, registerAvatarTrackingProfile } from './avatarTrackingProfiles';
import { AVATAR_LIST } from './avatarConfigs';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';
import { networkServiceSingleton } from '../../services/networkService';
import {
  Character3DController,
  buildCatCharacter,
  buildDogCharacter,
  buildFemaleCharacter,
  buildHorseCharacter,
  buildFoxCharacter,
  buildProceduralRobotCharacter,
  buildMeshOutlineCharacter,
  buildNeonHoloCharacter,
  buildFaceCapCharacter,
  buildLincolnCharacter,
  buildBidenCharacter,
  buildObamaCharacter,
  buildTrumpCharacter,
  buildMipipiCharacter,
} from './threeCharacterBuilder';
import { getAssetUrl } from '../../utils/assetUrl';
import { UPPER_LIP_SET, LOWER_LIP_SET, MOUTH_CORNER_SET } from '../../services/face3d/faceMeshGenerator';

const ROBOT_GLB_URL =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb';

// Cache for loaded GLTF data
let cachedGLTF: GLTF | null = null;
let loadingPromise: Promise<GLTF> | null = null;

function loadRobotGLTF(): Promise<GLTF> {
  if (cachedGLTF) return Promise.resolve(cachedGLTF);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      ROBOT_GLB_URL,
      (gltf) => {
        cachedGLTF = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('[ThreeAvatarCanvas] Error loading RobotExpressive.glb:', err);
        loadingPromise = null;
        reject(err);
      }
    );
  });

  return loadingPromise;
}

// Cache for loaded FaceCap GLTF
let cachedFaceCapGLTF: GLTF | null = null;
let faceCapLoadingPromise: Promise<GLTF> | null = null;

function loadFaceCapGLTF(renderer: THREE.WebGLRenderer): Promise<GLTF> {
  if (cachedFaceCapGLTF) return Promise.resolve(cachedFaceCapGLTF);
  if (faceCapLoadingPromise) return faceCapLoadingPromise;

  faceCapLoadingPromise = new Promise((resolve, reject) => {
    const basisPath = getAssetUrl('basis/');
    const localModelPath = getAssetUrl('models/gltf/facecap.glb');
    const cdnBasisPath = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/jsm/libs/basis/';
    const cdnModelPath = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@master/examples/models/gltf/facecap.glb';

    const ktx2Loader = new KTX2Loader()
      .setTranscoderPath(basisPath)
      .detectSupport(renderer);

    const loader = new GLTFLoader();
    loader.setKTX2Loader(ktx2Loader);
    loader.setMeshoptDecoder(MeshoptDecoder);

    const attemptLoad = (url: string, isFallback: boolean) => {
      loader.load(
        url,
        (gltf) => {
          cachedFaceCapGLTF = gltf;
          resolve(gltf);
        },
        undefined,
        (err) => {
          if (!isFallback) {
            console.warn('[ThreeAvatarCanvas] Local facecap.glb or transcoder failed, falling back to CDN...', err);
            ktx2Loader.setTranscoderPath(cdnBasisPath);
            attemptLoad(cdnModelPath, true);
          } else {
            console.error('[ThreeAvatarCanvas] Error loading facecap.glb:', err);
            faceCapLoadingPromise = null;
            reject(err);
          }
        }
      );
    };

    attemptLoad(localModelPath, false);
  });

  return faceCapLoadingPromise;
}

// Cache for loaded Lincoln GLTF
let cachedLincolnGLTF: GLTF | null = null;
let lincolnLoadingPromise: Promise<GLTF> | null = null;

function loadLincolnGLTF(): Promise<GLTF> {
  if (cachedLincolnGLTF) return Promise.resolve(cachedLincolnGLTF);
  if (lincolnLoadingPromise) return lincolnLoadingPromise;

  lincolnLoadingPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const url = getAssetUrl('models/stylized_lincoln.glb');
    loader.load(
      url,
      (gltf) => {
        cachedLincolnGLTF = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('[ThreeAvatarCanvas] Error loading stylized_lincoln.glb:', err);
        lincolnLoadingPromise = null;
        reject(err);
      }
    );
  });

  return lincolnLoadingPromise;
}

// Cache for loaded Biden GLTF
let cachedBidenGLTF: GLTF | null = null;
let bidenLoadingPromise: Promise<GLTF> | null = null;

function loadBidenGLTF(): Promise<GLTF> {
  if (cachedBidenGLTF) return Promise.resolve(cachedBidenGLTF);
  if (bidenLoadingPromise) return bidenLoadingPromise;

  bidenLoadingPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const url = getAssetUrl('models/joe_b.glb');
    loader.load(
      url,
      (gltf) => {
        cachedBidenGLTF = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('[ThreeAvatarCanvas] Error loading joe_b.glb:', err);
        bidenLoadingPromise = null;
        reject(err);
      }
    );
  });

  return bidenLoadingPromise;
}

// Cache for loaded Obama GLTF
let cachedObamaGLTF: GLTF | null = null;
let obamaLoadingPromise: Promise<GLTF> | null = null;

function loadObamaGLTF(): Promise<GLTF> {
  if (cachedObamaGLTF) return Promise.resolve(cachedObamaGLTF);
  if (obamaLoadingPromise) return obamaLoadingPromise;

  obamaLoadingPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const url = getAssetUrl('models/president_obama.glb');
    loader.load(
      url,
      (gltf) => {
        cachedObamaGLTF = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('[ThreeAvatarCanvas] Error loading president_obama.glb:', err);
        obamaLoadingPromise = null;
        reject(err);
      }
    );
  });

  return obamaLoadingPromise;
}

// Cache for loaded Trump GLTF
let cachedTrumpGLTF: GLTF | null = null;
let trumpLoadingPromise: Promise<GLTF> | null = null;

function loadTrumpGLTF(): Promise<GLTF> {
  if (cachedTrumpGLTF) return Promise.resolve(cachedTrumpGLTF);
  if (trumpLoadingPromise) return trumpLoadingPromise;

  trumpLoadingPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const url = getAssetUrl('models/president_trump.glb');
    loader.load(
      url,
      (gltf) => {
        cachedTrumpGLTF = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('[ThreeAvatarCanvas] Error loading president_trump.glb:', err);
        trumpLoadingPromise = null;
        reject(err);
      }
    );
  });

  return trumpLoadingPromise;
}

// Cache for loaded Mipipi GLTF
let cachedMipipiGLTF: GLTF | null = null;
let mipipiLoadingPromise: Promise<GLTF> | null = null;

function loadMipipiGLTF(): Promise<GLTF> {
  if (cachedMipipiGLTF) return Promise.resolve(cachedMipipiGLTF);
  if (mipipiLoadingPromise) return mipipiLoadingPromise;

  mipipiLoadingPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const url = getAssetUrl('models/mipipi.glb');
    loader.load(
      url,
      (gltf) => {
        cachedMipipiGLTF = gltf;
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.error('[ThreeAvatarCanvas] Error loading mipipi.glb:', err);
        mipipiLoadingPromise = null;
        reject(err);
      }
    );
  });

  return mipipiLoadingPromise;
}

function checkIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouch = navigator.maxTouchPoints != null && navigator.maxTouchPoints > 1;
  const isSmallScreen = window.innerWidth <= 768;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return isMobileUA || (isTouch && isSmallScreen);
}

interface ThreeAvatarCanvasProps {
  avatarId?: AvatarId;
  features: FaceFeatures;
  userName?: string;
  isSpeaking?: boolean;
  className?: string;
  cameraOffsetX?: number;
  cameraOffsetY?: number;
  trackingMode?: DynamicTrackingMode;
}

export const ThreeAvatarCanvas: React.FC<ThreeAvatarCanvasProps> = ({
  avatarId = 'three_robot',
  features,
  userName,
  isSpeaking = false,
  className = '',
  cameraOffsetX = 0,
  cameraOffsetY = 0,
  trackingMode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isGLBRobot = avatarId === 'three_robot';
  const isFaceCapAvatar = avatarId === 'face_cap';
  const isLincolnAvatar = avatarId === 'lincoln_3d';
  const isBidenAvatar = avatarId === 'biden_3d';
  const isObamaAvatar = avatarId === 'obama_3d';
  const isTrumpAvatar = avatarId === 'trump_3d';
  const [isLoading, setIsLoading] = useState(
    (isGLBRobot && !cachedGLTF) ||
    (isFaceCapAvatar && !cachedFaceCapGLTF) ||
    (isLincolnAvatar && !cachedLincolnGLTF) ||
    (isBidenAvatar && !cachedBidenGLTF) ||
    (isObamaAvatar && !cachedObamaGLTF) ||
    (isTrumpAvatar && !cachedTrumpGLTF)
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isWebglAvailable, setIsWebglAvailable] = useState(true);
  const [isContextLost, setIsContextLost] = useState(false);
  const [restoreCount, setRestoreCount] = useState(0);
  const [avatarRevision, setAvatarRevision] = useState(0);
  const [currentEmote, setCurrentEmote] = useState<string | null>(null);
  const [show3DMesh, setShow3DMesh] = useState(false);
  const show3DMeshRef = useRef(false);
  show3DMeshRef.current = show3DMesh;
  const trackingGroup3DRef = useRef<THREE.Group | null>(null);

  // Subscribe to live avatar updates so 3D Mask edits immediately update in-memory definitions
  useEffect(() => {
    const unsub = avatarModelServiceSingleton.subscribe(() => {
      setAvatarRevision((r) => r + 1);
    });
    return unsub;
  }, []);

  const avatarDef = useMemo<AvatarDefinition>(() => {
    const custom = avatarModelServiceSingleton.getAvatarById(avatarId);
    if (custom) return custom;
    const std = AVATAR_LIST.find((a) => a.id === avatarId);
    if (std) return std as unknown as AvatarDefinition;
    return {
      id: avatarId,
      name: 'Avatar 3D',
      emoji: '👤',
      themeColor: '#06b6d4',
      accentColor: '#38bdf8',
      badge: '3D',
      tagline: 'Avatar 3D',
      category: 'Sci-Fi',
    };
  }, [avatarId, avatarRevision]);

  // Auto-request missing custom model from room peers via P2P / WebSocket mesh
  useEffect(() => {
    const isStd = AVATAR_LIST.some((a) => a.id === avatarId);
    if (!isStd && !avatarDef.modelUrl && !avatarDef.fileData) {
      networkServiceSingleton.requestAvatarModel('', avatarId);
    }
  }, [avatarId, avatarDef.modelUrl, avatarDef.fileData]);

  const trackingProfile = useMemo(() => {
    if (avatarDef?.trackingProfile) {
      registerAvatarTrackingProfile(avatarId, avatarDef.trackingProfile);
      return avatarDef.trackingProfile;
    }
    return getAvatarTrackingProfile(avatarId);
  }, [avatarId, avatarDef]);

  // References across render loop
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);
  const headBoneRef = useRef<THREE.Bone | null>(null);
  const neckBoneRef = useRef<THREE.Bone | null>(null);
  const initialHeadRotationRef = useRef<THREE.Euler | null>(null);
  const initialNeckRotationRef = useRef<THREE.Euler | null>(null);
  const faceMeshesRef = useRef<THREE.Mesh[]>([]);
  const robotMouthBarsRef = useRef<THREE.Mesh[]>([]);
  const characterControllerRef = useRef<Character3DController | null>(null);

  const featuresRef = useRef(features);
  featuresRef.current = features;

  const isSpeakingRef = useRef(isSpeaking);
  isSpeakingRef.current = isSpeaking;

  const cameraOffsetXRef = useRef(cameraOffsetX);
  cameraOffsetXRef.current = cameraOffsetX;
  const cameraOffsetYRef = useRef(cameraOffsetY);
  cameraOffsetYRef.current = cameraOffsetY;

  const trackingModeRef = useRef(trackingMode);
  trackingModeRef.current = trackingMode;

  const currentZoomPunchRef = useRef(0);

  // Internal continuous smoothed tracking state to eliminate all jitter/sobresaltos
  const smoothPoseRef = useRef({
    yaw: 0,
    pitch: 0,
    roll: 0,
    jawOpen: 0,
    mouthSmile: 0,
    mouthPucker: 0,
    browRaise: 0,
    browFurrow: 0,
    eyeBlinkLeft: 0,
    eyeBlinkRight: 0,
    eyeWideLeft: 0,
    eyeWideRight: 0,
    gazeX: 0,
    gazeY: 0,
    lastValidTime: performance.now(),
  });

  const emoteTriggerRef = useRef<{ name: string; start: number } | null>(null);

  // Crossfade from current state to new emote/state
  const playEmote = useCallback(
    (emoteName: string, duration = 0.25) => {
      setCurrentEmote(emoteName);
      emoteTriggerRef.current = { name: emoteName, start: performance.now() };

      // If GLTF robot
      const actions = actionsRef.current;
      const mixer = mixerRef.current;
      if (actions[emoteName] && mixer) {
        const prevAction = activeActionRef.current;
        const newAction = actions[emoteName];

        if (prevAction && prevAction !== newAction) {
          prevAction.fadeOut(duration);
        }

        newAction
          .reset()
          .setEffectiveTimeScale(1)
          .setEffectiveWeight(1)
          .fadeIn(duration)
          .play();

        activeActionRef.current = newAction;

        const onFinished = (e: any) => {
          if (e.action === newAction) {
            mixer.removeEventListener('finished', onFinished);
            setCurrentEmote(null);
            emoteTriggerRef.current = null;
            const idleAction = actions['Idle'] || actions['Standing'];
            if (idleAction) {
              newAction.fadeOut(duration);
              idleAction.reset().fadeIn(duration).play();
              activeActionRef.current = idleAction;
            }
          }
        };

        mixer.addEventListener('finished', onFinished);
      } else {
        // Procedural Emote Auto-reset after 2.5s
        setTimeout(() => {
          setCurrentEmote(null);
          emoteTriggerRef.current = null;
        }, 2500);
      }
    },
    []
  );

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let isDisposed = false;
    let animationFrameId: number;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const isMobile = checkIsMobile();
    const FIXED_WIDTH = isMobile ? 256 : 320;
    const FIXED_HEIGHT = isMobile ? 256 : 320;
    const aspect = 1.0;
    const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    camera.position.set(0, 4.4, 4.8);
    camera.lookAt(0, 3.8, 0);
    cameraRef.current = camera;

    // 3. Renderer Setup (Mobile-optimized with fail-safe WebGL allocation)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobile,
        powerPreference: isMobile ? 'default' : 'high-performance',
        precision: isMobile ? 'mediump' : 'highp',
      });
    } catch (e) {
      console.warn('[ThreeAvatarCanvas] WebGL context allocation failed:', e);
      setIsWebglAvailable(false);
      return;
    }

    setIsWebglAvailable(true);
    setIsContextLost(false);

    const pixelRatio = isMobile
      ? Math.min(window.devicePixelRatio || 1, 1.25)
      : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(FIXED_WIDTH, FIXED_HEIGHT);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.backgroundColor = 'transparent';

    if (!isMobile) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }

    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // WebGL Context Lost & Restored Protection (prevents blank/white card on mobile)
    const canvasDom = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault(); // CRITICAL: Tells browser not to permanently destroy the canvas
      console.warn('[ThreeAvatarCanvas] WebGL context lost on avatar:', avatarId);
      setIsContextLost(true);
      cancelAnimationFrame(animationFrameId);
    };

    const handleContextRestored = () => {
      console.log('[ThreeAvatarCanvas] WebGL context restored. Re-mounting avatar:', avatarId);
      setIsContextLost(false);
      setRestoreCount((c) => c + 1);
    };

    canvasDom.addEventListener('webglcontextlost', handleContextLost, false);
    canvasDom.addEventListener('webglcontextrestored', handleContextRestored, false);

    // 4. Studio 3D Lighting (Optimized for mobile GPU)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, isMobile ? 2.0 : 1.8);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, isMobile ? 2.6 : 2.4);
    dirLight.position.set(4, 10, 6);
    if (!isMobile) {
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.width = 512;
      dirLight.shadow.mapSize.height = 512;
      dirLight.shadow.camera.near = 0.5;
      dirLight.shadow.camera.far = 25;
    }
    scene.add(dirLight);

    // Dynamic Character Rim Light
    const themeRimColors: Record<string, number> = {
      three_robot: 0x06b6d4,
      cat_3d: 0xf472b6,
      dog_3d: 0x38bdf8,
      female_3d: 0xa855f7,
      horse_3d: 0xf97316,
      face_cap: 0x38bdf8,
      lincoln_3d: 0x3b82f6,
      biden_3d: 0x2563eb,
      obama_3d: 0x0ea5e9,
      trump_3d: 0xe11d48,
    };
    const rimColor = themeRimColors[avatarId] || 0x06b6d4;

    const rimLight = new THREE.PointLight(rimColor, 3.5, 12);
    rimLight.position.set(-3, 5, -2);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xa855f7, 1.8, 10);
    fillLight.position.set(3, 3, -1);
    scene.add(fillLight);

    // 5. Stylized Holographic Pedestal
    const groundGeo = new THREE.CircleGeometry(2.4, 48);
    const groundMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      transparent: true,
      opacity: 0.12,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.01;
    scene.add(ground);

    const ringGeo = new THREE.RingGeometry(2.1, 2.25, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    // 3D Tracking Mesh Group anchored on avatar anatomy
    const trackingGroup3D = new THREE.Group();
    trackingGroup3D.name = 'Avatar3DTrackingNodes';
    trackingGroup3D.visible = show3DMeshRef.current;
    trackingGroup3DRef.current = trackingGroup3D;

    // 6. Build the appropriate 3D Avatar
    if (isGLBRobot) {
      // Robot 3D from GLTF (RobotExpressive.glb)
      loadRobotGLTF()
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);

          const clonedScene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
          // Elevate robot so its head bone (y=2.97 in rest pose) aligns with camera center (y=3.8)
          clonedScene.position.set(0, 0.75, 0);
          clonedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          scene.add(clonedScene);

          // Locate Bones and store initial rest pose
          clonedScene.traverse((child) => {
            if (child.name === 'Head' && (child as THREE.Bone).isBone) {
              headBoneRef.current = child as THREE.Bone;
              initialHeadRotationRef.current = child.rotation.clone();
            }
            if (child.name === 'Neck' && (child as THREE.Bone).isBone) {
              neckBoneRef.current = child as THREE.Bone;
              initialNeckRotationRef.current = child.rotation.clone();
            }
          });

          // Locate All Face Meshes for Morph Target Blendshapes (Head_2, Head_3, Head_4)
          const targetMeshes: THREE.Mesh[] = [];
          ['Head_2', 'Head_3', 'Head_4'].forEach((name) => {
            const m = clonedScene.getObjectByName(name) as THREE.Mesh;
            if (m && m.morphTargetDictionary) {
              targetMeshes.push(m);
            }
          });
          faceMeshesRef.current = targetMeshes;

          // ========================================================
          // PERFECT ROBOT MOUTH MAPPING: 7-BAR CYBER LED MATRIX
          // Attached directly to Head_4 face plate, centered and aligned
          // ========================================================
          const head4Mesh = clonedScene.getObjectByName('Head_4') as THREE.Mesh;
          if (head4Mesh) {
            const mouthGroup = new THREE.Group();
            // Located on the lower face visor screen
            mouthGroup.position.set(0, -0.0098, 0.0050);

            const ledMat = new THREE.MeshBasicMaterial({
              color: 0x06b6d4, // Glowing Cyan Neon
              transparent: true,
              opacity: 0.95,
            });

            const bars: THREE.Mesh[] = [];
            for (let i = 0; i < 7; i++) {
              const bar = new THREE.Mesh(
                new THREE.BoxGeometry(0.00065, 0.0012, 0.00025),
                ledMat
              );
              bar.position.set((i - 3) * 0.0011, 0, 0);
              mouthGroup.add(bar);
              bars.push(bar);
            }
            head4Mesh.add(mouthGroup);
            robotMouthBarsRef.current = bars;

            // Anchor 3D anatomical tracking nodes on robot visor & mouth
            if (trackingProfile.mesh3DPoints && trackingProfile.mesh3DPoints.length > 0) {
              const nodeMat = new THREE.MeshBasicMaterial({ color: trackingProfile.dotColor });
              const nodeGeo = new THREE.SphereGeometry(0.00065, 8, 8);
              trackingProfile.mesh3DPoints.forEach((pt) => {
                const node = new THREE.Mesh(nodeGeo, nodeMat);
                node.position.set(...pt.localPos);
                trackingGroup3D.add(node);
              });
              head4Mesh.add(trackingGroup3D);
            }
          }

          // Setup Mixer & Actions
          // CRITICAL: Filter out any head, neck, or morph tracks from GLTF clips
          // so the animation mixer never conflicts with head tracking or facial expressions!
          const mixer = new THREE.AnimationMixer(clonedScene);
          mixerRef.current = mixer;
          const actions: Record<string, THREE.AnimationAction> = {};

          gltf.animations.forEach((clip) => {
            const cleanClip = clip.clone();
            cleanClip.tracks = cleanClip.tracks.filter((t) => {
              const lower = t.name.toLowerCase();
              return (
                !lower.startsWith('head') &&
                !lower.startsWith('neck') &&
                !lower.includes('morphtargetinfluences')
              );
            });

            const action = mixer.clipAction(cleanClip);
            actions[cleanClip.name] = action;

            if (
              ['Wave', 'ThumbsUp', 'Dance', 'Jump', 'Death', 'Punch', 'Yes', 'No'].includes(
                cleanClip.name
              )
            ) {
              action.loop = THREE.LoopOnce;
              action.clampWhenFinished = true;
            }
          });

          actionsRef.current = actions;

          const startAction = actions['Idle'] || actions['Standing'] || actions['Walking'];
          if (startAction) {
            startAction.play();
            activeActionRef.current = startAction;
          }
        })
        .catch((err) => {
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar robot 3D');
          }
        });
    } else if (avatarId === 'face_cap') {
      setIsLoading(!cachedFaceCapGLTF);
      loadFaceCapGLTF(renderer)
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);
          const controller = buildFaceCapCharacter(gltf);
          characterControllerRef.current = controller;
          scene.add(controller.group);
        })
        .catch((err) => {
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar Face Cap 3D');
          }
        });
    } else if (avatarId === 'lincoln_3d') {
      setIsLoading(!cachedLincolnGLTF);
      loadLincolnGLTF()
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);
          const controller = buildLincolnCharacter(gltf);
          characterControllerRef.current = controller;
          scene.add(controller.group);
        })
        .catch((err) => {
          console.error('[ThreeAvatarCanvas] Error loading Lincoln 3D:', err);
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar Lincoln 3D');
          }
        });
    } else if (avatarId === 'biden_3d') {
      setIsLoading(!cachedBidenGLTF);
      loadBidenGLTF()
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);
          const controller = buildBidenCharacter(gltf);
          characterControllerRef.current = controller;
          scene.add(controller.group);
        })
        .catch((err) => {
          console.error('[ThreeAvatarCanvas] Error loading Biden 3D:', err);
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar Biden 3D');
          }
        });
    } else if (avatarId === 'obama_3d') {
      setIsLoading(!cachedObamaGLTF);
      loadObamaGLTF()
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);
          const controller = buildObamaCharacter(gltf);
          characterControllerRef.current = controller;
          scene.add(controller.group);
        })
        .catch((err) => {
          console.error('[ThreeAvatarCanvas] Error loading Obama 3D:', err);
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar Obama 3D');
          }
        });
    } else if (avatarId === 'trump_3d') {
      setIsLoading(!cachedTrumpGLTF);
      loadTrumpGLTF()
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);
          const controller = buildTrumpCharacter(gltf);
          characterControllerRef.current = controller;
          scene.add(controller.group);
        })
        .catch((err) => {
          console.error('[ThreeAvatarCanvas] Error loading Trump 3D:', err);
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar Trump 3D');
          }
        });
    } else if (avatarId === 'mipipi') {
      setIsLoading(!cachedMipipiGLTF);
      loadMipipiGLTF()
        .then((gltf) => {
          if (isDisposed) return;
          setIsLoading(false);
          const controller = buildMipipiCharacter(gltf);
          characterControllerRef.current = controller;
          scene.add(controller.group);
        })
        .catch((err) => {
          console.error('[ThreeAvatarCanvas] Error loading Mipipi 3D:', err);
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError('Error al cargar Mipipi 3D');
          }
        });
    } else if (avatarDef && (avatarDef.modelUrl || avatarDef.fileData)) {
      // Custom Uploaded 3D Model (GLB / GLTF / VRM / OBJ / STL from 3ds Max / Blender / CAD)
      setIsLoading(true);
      const modelSource = avatarDef.fileData || avatarDef.modelUrl || '';
      const fmt = (avatarDef.format || '').toLowerCase();
      const nameLower = (avatarDef.name || '').toLowerCase();
      const isObj = fmt === 'obj' || nameLower.endsWith('.obj') || modelSource.startsWith('data:text/plain') || modelSource.includes('.obj');
      const isStl = fmt === 'stl' || nameLower.endsWith('.stl') || modelSource.includes('.stl');

      if (isObj) {
        const objLoader = new OBJLoader();
        objLoader.load(
          modelSource,
          (objGroup) => {
            if (isDisposed) return;
            setIsLoading(false);
            const rootGroup = new THREE.Group();
            const headPivot = new THREE.Group();
            rootGroup.add(headPivot);

            const box = new THREE.Box3().setFromObject(objGroup);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetScale = 2.4 / maxDim;

            objGroup.scale.setScalar(targetScale);
            objGroup.position.set(-center.x * targetScale, -center.y * targetScale, -center.z * targetScale);

            const themeColorNum = new THREE.Color(avatarDef.themeColor || '#38bdf8');
            objGroup.traverse((child) => {
              const mesh = child as THREE.Mesh;
              if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: themeColorNum,
                    roughness: 0.35,
                    metalness: 0.2,
                  });
                }
              }
            });

            headPivot.position.set(0, 3.8, 0);
            headPivot.add(objGroup);

            const controller: Character3DController = {
              group: rootGroup,
              headPivot,
              update: (features: FaceFeatures) => {
                const targetRotX = features.pitch * 0.45;
                const targetRotY = features.yaw * 0.55;
                const targetRotZ = -features.roll * 0.4;

                headPivot.rotation.x = THREE.MathUtils.lerp(headPivot.rotation.x, targetRotX, 0.4);
                headPivot.rotation.y = THREE.MathUtils.lerp(headPivot.rotation.y, targetRotY, 0.4);
                headPivot.rotation.z = THREE.MathUtils.lerp(headPivot.rotation.z, targetRotZ, 0.4);

                const speechReact = Math.max(features.audioVolume || 0, features.jawOpen || 0);
                if (speechReact > 0.05) {
                  const sY = targetScale * (1 + speechReact * 0.08);
                  objGroup.scale.y = THREE.MathUtils.lerp(objGroup.scale.y, sY, 0.4);
                } else {
                  objGroup.scale.y = THREE.MathUtils.lerp(objGroup.scale.y, targetScale, 0.2);
                }
              },
              dispose: () => {
                rootGroup.traverse((child) => {
                  const m = child as THREE.Mesh;
                  if (m.isMesh) {
                    m.geometry?.dispose();
                    if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
                    else m.material?.dispose();
                  }
                });
              },
            };

            characterControllerRef.current = controller;
            scene.add(controller.group);
          },
          undefined,
          (err) => {
            console.warn('[ThreeAvatarCanvas] Error cargando modelo OBJ de 3ds Max:', err);
            if (!isDisposed) {
              setIsLoading(false);
              const fallbackCtrl = buildProceduralRobotCharacter('mecha');
              characterControllerRef.current = fallbackCtrl;
              scene.add(fallbackCtrl.group);
            }
          }
        );
      } else if (isStl) {
        const stlLoader = new STLLoader();
        stlLoader.load(
          modelSource,
          (geometry) => {
            if (isDisposed) return;
            setIsLoading(false);
            const rootGroup = new THREE.Group();
            const headPivot = new THREE.Group();
            rootGroup.add(headPivot);

            geometry.computeVertexNormals();
            geometry.center();
            geometry.computeBoundingBox();
            const box = geometry.boundingBox || new THREE.Box3();
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetScale = 2.4 / maxDim;

            const themeColorNum = new THREE.Color(avatarDef.themeColor || '#38bdf8');
            const material = new THREE.MeshStandardMaterial({
              color: themeColorNum,
              roughness: 0.3,
              metalness: 0.25,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.setScalar(targetScale);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            headPivot.position.set(0, 3.8, 0);
            headPivot.add(mesh);

            const controller: Character3DController = {
              group: rootGroup,
              headPivot,
              update: (features: FaceFeatures) => {
                const targetRotX = features.pitch * 0.45;
                const targetRotY = features.yaw * 0.55;
                const targetRotZ = -features.roll * 0.4;

                headPivot.rotation.x = THREE.MathUtils.lerp(headPivot.rotation.x, targetRotX, 0.4);
                headPivot.rotation.y = THREE.MathUtils.lerp(headPivot.rotation.y, targetRotY, 0.4);
                headPivot.rotation.z = THREE.MathUtils.lerp(headPivot.rotation.z, targetRotZ, 0.4);

                const speechReact = Math.max(features.audioVolume || 0, features.jawOpen || 0);
                if (speechReact > 0.05) {
                  const sY = targetScale * (1 + speechReact * 0.08);
                  mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, sY, 0.4);
                } else {
                  mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, targetScale, 0.2);
                }
              },
              dispose: () => {
                geometry.dispose();
                material.dispose();
              },
            };

            characterControllerRef.current = controller;
            scene.add(controller.group);
          },
          undefined,
          (err) => {
            console.warn('[ThreeAvatarCanvas] Error cargando modelo STL de 3ds Max:', err);
            if (!isDisposed) {
              setIsLoading(false);
              const fallbackCtrl = buildProceduralRobotCharacter('mecha');
              characterControllerRef.current = fallbackCtrl;
              scene.add(fallbackCtrl.group);
            }
          }
        );
      } else {
        // GLTF / GLB / VRM
        const loader = new GLTFLoader();
        loader.load(
          modelSource,
          (gltf) => {
          if (isDisposed) return;
          setIsLoading(false);
          const rootGroup = new THREE.Group();
          const headPivot = new THREE.Group();
          rootGroup.add(headPivot);

          const clonedScene = SkeletonUtils.clone(gltf.scene) as THREE.Group;
          clonedScene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Check if this model is a full-body character with a skeleton rig or has a jaw bone
          let hasSkeletalBones = false;
          let customHeadBone: THREE.Bone | null = null;
          let customJawBone: THREE.Bone | null = null;
          let initialJawRot: THREE.Euler | null = null;
          clonedScene.traverse((child) => {
            if ((child as THREE.Bone).isBone) {
              hasSkeletalBones = true;
              const bName = child.name ? child.name.toLowerCase() : '';
              if (!customHeadBone && bName.includes('head')) {
                customHeadBone = child as THREE.Bone;
              }
              if (!customJawBone && (bName.includes('jaw') || bName.includes('chin') || bName.includes('mandible'))) {
                customJawBone = child as THREE.Bone;
                initialJawRot = (child as THREE.Bone).rotation.clone();
              }
            }
          });

          // Calculate bounding box and dimensions
          const box = new THREE.Box3().setFromObject(clonedScene);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const isFullBodyRig = hasSkeletalBones && (size.y > size.x * 1.8);

          if (isFullBodyRig) {
            // Full-body skeletal character standing on the ground
            const scaleFactor = 3.2 / maxDim;
            clonedScene.scale.setScalar(scaleFactor);
            clonedScene.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);
            rootGroup.add(clonedScene);
          } else {
            // Face mask / Head avatar (e.g. ARKit 3D Face or Face-to-Blendshape generated model)
            // Scale to fill avatar portrait viewport nicely (~2.35 units height)
            const headScaleFactor = 2.35 / maxDim;
            clonedScene.scale.setScalar(headScaleFactor);
            // Center the geometry precisely on the local origin of headPivot
            clonedScene.position.set(
              -center.x * headScaleFactor,
              -center.y * headScaleFactor,
              -center.z * headScaleFactor
            );
            // Position headPivot at (0, 3.8, 0) which is precisely where the camera looks (0, 3.8, 0)
            headPivot.position.set(0, 3.8, 0);
            headPivot.add(clonedScene);
          }

          // Index all morph target meshes for 60fps real-time tracking
          const morphMeshes: Array<{
            mesh: THREE.Mesh;
            dict: Record<string, number>;
            infl: number[];
            keys: string[];
          }> = [];

          clonedScene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
              morphMeshes.push({
                mesh,
                dict: mesh.morphTargetDictionary,
                infl: mesh.morphTargetInfluences,
                keys: Object.keys(mesh.morphTargetDictionary),
              });
            }
          });

          // \u2500\u2500 jawOpen auto-upgrade for legacy absolute-mode avatars in LocalStorage \u2500\u2500\u2500\u2500\u2500
          // New avatars (morphTargetsRelative=true) store proper deltas, so this only fires
          // for older models that have shallow aperture or incorrect upper-lip drop.
          const faceMeshObj = clonedScene.getObjectByName('faceMesh') as THREE.Mesh | undefined;
          if (faceMeshObj && faceMeshObj.isMesh && faceMeshObj.geometry) {
            const fGeo = faceMeshObj.geometry;
            const posAttr = fGeo.getAttribute('position');

            if (posAttr && fGeo.morphAttributes?.position && posAttr.count >= 468) {
              // 1. Detect and convert any legacy absolute-mode morph targets to relative deltas
              for (let tIdx = 0; tIdx < fGeo.morphAttributes.position.length; tIdx++) {
                const morphAttr = fGeo.morphAttributes.position[tIdx];
                const mY0 = morphAttr.getY(0);
                const bY0 = posAttr.getY(0);
                // If morphAttr at vertex 0 is near base vertex position rather than ~0, it's absolute
                if (Math.abs(bY0) > 0.25 && Math.abs(mY0 - bY0) < 0.20 && Math.abs(mY0) > 0.25) {
                  for (let i = 0; i < posAttr.count; i++) {
                    morphAttr.setXYZ(
                      i,
                      morphAttr.getX(i) - posAttr.getX(i),
                      morphAttr.getY(i) - posAttr.getY(i),
                      morphAttr.getZ(i) - posAttr.getZ(i)
                    );
                  }
                  morphAttr.needsUpdate = true;
                }
              }
              fGeo.morphTargetsRelative = true;

              // 2. jawOpen auto-upgrade if upper lip falls or lower lip drop is shallow
              const jawIdx = faceMeshObj.morphTargetDictionary ? faceMeshObj.morphTargetDictionary['jawOpen'] : undefined;
              if (jawIdx !== undefined && fGeo.morphAttributes?.position?.[jawIdx]) {
                const morphAttr = fGeo.morphAttributes.position[jawIdx];
                const delta13 = morphAttr.getY(13);
                const delta14 = morphAttr.getY(14);

                if (delta13 < -0.02 || delta14 > -0.22) {
                  console.info('[ThreeAvatarCanvas] jawOpen hot-upgrade triggered: delta13=', delta13.toFixed(3), 'delta14=', delta14.toFixed(3));
                  const pMouthCenter = {
                    x: (posAttr.getX(13) + posAttr.getX(14)) / 2,
                    y: (posAttr.getY(13) + posAttr.getY(14)) / 2,
                    z: (posAttr.getZ(13) + posAttr.getZ(14)) / 2,
                  };
                  const pChin = {
                    x: posAttr.getX(152),
                    y: posAttr.getY(152),
                    z: posAttr.getZ(152),
                  };
                  const pLowerLip = {
                    x: posAttr.getX(14),
                    y: posAttr.getY(14),
                    z: posAttr.getZ(14),
                  };
                  const pCornerL = {
                    x: posAttr.getX(61),
                    y: posAttr.getY(61),
                    z: posAttr.getZ(61),
                  };
                  const pCornerR = {
                    x: posAttr.getX(291),
                    y: posAttr.getY(291),
                    z: posAttr.getZ(291),
                  };
                  const mouthHalfWidth = Math.max(0.18, Math.abs(pCornerR.x - pCornerL.x) * 0.5);
                  const jawRange = Math.abs(pMouthCenter.y - pChin.y) || 0.6;

                  for (let i = 0; i < posAttr.count; i++) {
                    const bx = posAttr.getX(i);
                    const by = posAttr.getY(i);
                    const bz = posAttr.getZ(i);

                    const isCorner = MOUTH_CORNER_SET.has(i);
                    const isUpper = !isCorner && (UPPER_LIP_SET.has(i) || (by >= pMouthCenter.y && !LOWER_LIP_SET.has(i)));
                    const isLower = !isCorner && (LOWER_LIP_SET.has(i) || by < pMouthCenter.y);

                    let my = by;
                    let mz = bz;
                    let mx = bx;

                    if (isCorner) {
                      const d61 = Math.hypot(bx - pCornerL.x, by - pCornerL.y, bz - pCornerL.z);
                      const d291 = Math.hypot(bx - pCornerR.x, by - pCornerR.y, bz - pCornerR.z);
                      const dCorner = Math.min(d61, d291);
                      if (dCorner < 0.16) {
                        const t = 1 - (dCorner / 0.16) ** 2;
                        const w = t * t;
                        my -= 0.04 * w;
                        mx -= Math.sign(bx - pMouthCenter.x) * 0.02 * w;
                      }
                    } else if (isUpper) {
                      // Upper lip stays anchored (0 drop)
                    } else if (isLower) {
                      const dx = Math.abs(bx - pMouthCenter.x);
                      const latW = Math.max(0, 1 - Math.min(1, (dx / mouthHalfWidth) ** 1.8));

                      const d14 = Math.hypot(bx - pLowerLip.x, by - pLowerLip.y, bz - pLowerLip.z);
                      const isLipMargin = LOWER_LIP_SET.has(i) || d14 < 0.28;
                      if (isLipMargin) {
                        const t = d14 < 0.28 ? (1 - (d14 / 0.28) ** 2) : 0;
                        const lipDistW = Math.max(0.60, t * t);
                        my -= 0.38 * latW * lipDistW;
                        mz -= 0.12 * latW * lipDistW;
                      }

                      if (by < pMouthCenter.y) {
                        const t = Math.min(1, Math.max(0, (pMouthCenter.y - by) / jawRange));
                        const jawBoneW = Math.sin(t * Math.PI * 0.5);
                        my -= 0.24 * jawBoneW;
                        mz -= 0.07 * jawBoneW;
                      }
                    }

                    morphAttr.setXYZ(i, mx - bx, my - by, mz - bz);
                  }
                  morphAttr.needsUpdate = true;
                }
              }

              // 3. Eyelid blink stroke guarantee for legacy models (landmarks 159 & 386)
              const blinkLIdx = faceMeshObj.morphTargetDictionary ? faceMeshObj.morphTargetDictionary['eyeBlinkLeft'] : undefined;
              if (blinkLIdx !== undefined && fGeo.morphAttributes?.position?.[blinkLIdx]) {
                const bAttr = fGeo.morphAttributes.position[blinkLIdx];
                const dy = bAttr.getY(159);
                if (dy > -0.18) {
                  const scale = Math.min(4.0, 0.25 / Math.max(0.02, Math.abs(dy)));
                  for (let i = 0; i < posAttr.count; i++) {
                    bAttr.setY(i, bAttr.getY(i) * scale);
                    if (bAttr.getY(i) < -0.04) bAttr.setZ(i, bAttr.getZ(i) + 0.04);
                  }
                  bAttr.needsUpdate = true;
                }
              }
              const blinkRIdx = faceMeshObj.morphTargetDictionary ? faceMeshObj.morphTargetDictionary['eyeBlinkRight'] : undefined;
              if (blinkRIdx !== undefined && fGeo.morphAttributes?.position?.[blinkRIdx]) {
                const bAttr = fGeo.morphAttributes.position[blinkRIdx];
                const dy = bAttr.getY(386);
                if (dy > -0.18) {
                  const scale = Math.min(4.0, 0.25 / Math.max(0.02, Math.abs(dy)));
                  for (let i = 0; i < posAttr.count; i++) {
                    bAttr.setY(i, bAttr.getY(i) * scale);
                    if (bAttr.getY(i) < -0.04) bAttr.setZ(i, bAttr.getZ(i) + 0.04);
                  }
                  bAttr.needsUpdate = true;
                }
              }

              // 4. Eyebrow raise stroke guarantee (landmark 19)
              const browIdx = faceMeshObj.morphTargetDictionary ? faceMeshObj.morphTargetDictionary['browInnerUp'] : undefined;
              if (browIdx !== undefined && fGeo.morphAttributes?.position?.[browIdx]) {
                const brAttr = fGeo.morphAttributes.position[browIdx];
                const dy = brAttr.getY(19);
                if (dy > 0.005 && dy < 0.16) {
                  const scale = Math.min(3.5, 0.28 / dy);
                  for (let i = 0; i < posAttr.count; i++) {
                    brAttr.setY(i, brAttr.getY(i) * scale);
                  }
                  brAttr.needsUpdate = true;
                }
              }
            }
          }

          const torsoNode = clonedScene.getObjectByName('torsoGroup') || clonedScene.getObjectByName('torsoBustMesh');
          const neckNode = clonedScene.getObjectByName('neckPivot');
          const faceMeshNode = clonedScene.getObjectByName('faceMesh');
          const headBaseNode = clonedScene.getObjectByName('headBaseMesh');
          const lowerTeethNode = clonedScene.getObjectByName('lowerTeeth');
          const initialTeethPos = lowerTeethNode ? lowerTeethNode.position.clone() : new THREE.Vector3(0, -0.022, -0.038);
          const eyeLeftNode = clonedScene.getObjectByName('eyeLeft');
          const eyeRightNode = clonedScene.getObjectByName('eyeRight');
          const oralCavityNode = clonedScene.getObjectByName('oralCavity');
          const eyesGroupNode = clonedScene.getObjectByName('eyesGroup');

          // ── Read embedded calibration metadata & apply avatar customizations ────────
          const metaNode = clonedScene.getObjectByName('xstreamx_meta');
          const metaData = metaNode?.userData || {};
          const effectiveDebugParams = avatarDef?.debugParams || metaData.debugParams || {
            eyes: metaData.eyeOptions,
            mouth: metaData.mouthParams,
            face: metaData.faceParams,
            head: metaData.headParams,
          };

          if (metaNode?.userData?.version) {
            console.info(
              '[ThreeAvatarCanvas] xstreamx_meta v' + metaNode.userData.version +
              ' loaded. mouthParams:', metaNode.userData.mouthParams ?? '(none)',
              '| gestureParams:', metaNode.userData.gestureParams ?? '(none)'
            );
            // Store on scene userData for future studio re-edit access
            clonedScene.userData.calibrationMeta = {
              mouthParams: metaNode.userData.mouthParams ?? null,
              gestureParams: metaNode.userData.gestureParams ?? null,
              eyeOptions: metaNode.userData.eyeOptions ?? null,
              landmarksSampled: metaNode.userData.landmarksSampled ?? null,
              debugParams: effectiveDebugParams,
            };
          }

          // Apply Eye Customizations (Iris Color, Pupil Color, Pupil Size, Visibility)
          if (effectiveDebugParams?.eyes) {
            const eyeOpts = effectiveDebugParams.eyes;
            if (eyesGroupNode && eyeOpts.enabled !== undefined) {
              eyesGroupNode.visible = !!eyeOpts.enabled;
            }
            if (eyeOpts.irisColor) {
              const irisCol = new THREE.Color(eyeOpts.irisColor);
              clonedScene.traverse((child: any) => {
                if (child.isMesh && child.name && child.name.includes('_iris') && child.material) {
                  if (child.material.color) {
                    child.material.color.copy(irisCol);
                    child.material.needsUpdate = true;
                  }
                }
              });
            }
            if (eyeOpts.pupilColor) {
              const pupilCol = new THREE.Color(eyeOpts.pupilColor);
              clonedScene.traverse((child: any) => {
                if (child.isMesh && child.name && child.name.includes('_pupil') && child.material) {
                  if (child.material.color) {
                    child.material.color.copy(pupilCol);
                    child.material.needsUpdate = true;
                  }
                }
              });
            }
            if (eyeOpts.pupilSize !== undefined) {
              const baseRatio = 0.32;
              const scaleMult = Math.max(0.18, Math.min(0.55, eyeOpts.pupilSize)) / baseRatio;
              clonedScene.traverse((child: any) => {
                if (child.isMesh && child.name && child.name.includes('_pupil')) {
                  child.scale.set(scaleMult, scaleMult, 1.0);
                }
              });
            }
          }

          // Apply Mouth & Oral Cavity Customization Visibility
          if (oralCavityNode && effectiveDebugParams?.mouth) {
            oralCavityNode.visible = effectiveDebugParams.mouth.oralCavityEnabled ?? false;
          }

          // Apply Head Base Visibility
          if (headBaseNode && effectiveDebugParams?.head) {
            headBaseNode.visible = effectiveDebugParams.head.enabled ?? false;
          }

          // ── Lerp speed lookup tables (Fase 4) ────────────────────────────
          // Fast: immediate physiological responses (blinks, jaw, wide eyes)
          const FAST_MORPH_KEYS = new Set([
            'jawopen', 'eyeblinkleft', 'eyeblinkright', 'mouthclose', 'eyewideleft', 'eyewideright',
          ]);
          // Medium: visible expressions (brows, smiles, cheeks, nose)
          const MEDIUM_MORPH_KEYS = new Set([
            'browdownleft', 'browdownright', 'browinnerup',
            'browouterupleft', 'browouterupright',
            'mouthsmileleft', 'mouthsmileright',
            'mouthfrownleft', 'mouthfrownright',
            'mouthpucker', 'mouthfunnel',
            'cheekpuff', 'cheeksquintleft', 'cheeksquintright',
            'nosesneerleft', 'nosesneerright',
            'eyesquintleft', 'eyesquintright',
            'mouthlowerdownleft', 'mouthlowerdownright',
          ]);

          const controller: Character3DController = {
            group: rootGroup,
            headPivot: isFullBodyRig && customHeadBone ? (customHeadBone as unknown as THREE.Group) : headPivot,
            update: (features, _dt, _now) => {
              // 1:1 Head & Bust rotation tracking
              if (torsoNode && faceMeshNode) {
                torsoNode.rotation.y = THREE.MathUtils.lerp(torsoNode.rotation.y, features.yaw * 0.12, 0.2);
                torsoNode.rotation.z = THREE.MathUtils.lerp(torsoNode.rotation.z, -features.roll * 0.06, 0.2);
                torsoNode.position.x = THREE.MathUtils.lerp(torsoNode.position.x, features.yaw * 0.08, 0.18);
                if (neckNode) {
                  neckNode.rotation.y = THREE.MathUtils.lerp(neckNode.rotation.y, features.yaw * 0.35, 0.25);
                  neckNode.rotation.x = THREE.MathUtils.lerp(neckNode.rotation.x, features.pitch * 0.30, 0.25);
                  neckNode.rotation.z = THREE.MathUtils.lerp(neckNode.rotation.z, features.roll * 0.45, 0.25);
                }
                faceMeshNode.rotation.y = THREE.MathUtils.lerp(faceMeshNode.rotation.y, features.yaw * 0.75, 0.3);
                faceMeshNode.rotation.x = THREE.MathUtils.lerp(faceMeshNode.rotation.x, features.pitch * 0.75, 0.3);
                faceMeshNode.rotation.z = THREE.MathUtils.lerp(faceMeshNode.rotation.z, features.roll * 0.75, 0.3);
                if (headBaseNode) {
                  headBaseNode.rotation.copy(faceMeshNode.rotation);
                }
                if (oralCavityNode) {
                  oralCavityNode.rotation.copy(faceMeshNode.rotation);
                }
                if (eyesGroupNode) {
                  eyesGroupNode.rotation.copy(faceMeshNode.rotation);
                }
              } else if (isFullBodyRig && customHeadBone) {
                customHeadBone.rotation.x = features.pitch;
                customHeadBone.rotation.y = features.yaw;
                customHeadBone.rotation.z = features.roll;
              } else {
                headPivot.rotation.x = features.pitch;
                headPivot.rotation.y = features.yaw;
                headPivot.rotation.z = features.roll;
              }

              // Facial expressions & 52 ARKit blendshapes synchronization
              const bShapes = features.blendshapes;
              const effectiveVol = Math.max(0, features.audioVolume || 0);
              const isLipSync = trackingModeRef.current === 'lipsync';
              // Noise gate: ignore small ambient noises, breathing, and mouse clicks.
              // Only prominent vocal sound peaks (> 0.18 in lipsync) articulate the mouth.
              const audioGate = isLipSync ? 0.18 : 0.12;
              const speechJaw = effectiveVol > audioGate
                ? Math.min(0.65, Math.pow((effectiveVol - audioGate) / (1.0 - audioGate), 1.3) * 0.75)
                : 0;
              const rawJaw = isLipSync ? 0 : (features.jawOpen || 0);
              // Calibrated natural mouth articulation (animating lower lip smoothly without over-extending)
              const finalJaw = Math.min(0.70, Math.max(rawJaw * 0.85, speechJaw));

              // Animate Lower Dental Arch in Oral Cavity relative to baseline
              if (lowerTeethNode) {
                lowerTeethNode.position.y = initialTeethPos.y - finalJaw * 0.18;
                lowerTeethNode.position.z = initialTeethPos.z - finalJaw * 0.08;
              }

              // Animate Skeletal Jaw Bone if present in rigged characters
              if (customJawBone && initialJawRot) {
                customJawBone.rotation.x = initialJawRot.x + finalJaw * 0.42;
              }

              // Animate 3D Eyeballs with amplified user gaze tracking
              if (eyeLeftNode && eyeRightNode) {
                const targetEyeYaw = (features.gazeX || 0) * 0.70;
                const targetEyePitch = -(features.gazeY || 0) * 0.55;
                eyeLeftNode.rotation.y = THREE.MathUtils.lerp(eyeLeftNode.rotation.y, targetEyeYaw, 0.35);
                eyeLeftNode.rotation.x = THREE.MathUtils.lerp(eyeLeftNode.rotation.x, targetEyePitch, 0.35);
                eyeRightNode.rotation.y = THREE.MathUtils.lerp(eyeRightNode.rotation.y, targetEyeYaw, 0.35);
                eyeRightNode.rotation.x = THREE.MathUtils.lerp(eyeRightNode.rotation.x, targetEyePitch, 0.35);
              }

              // Procedural lower jaw animation fallback for static models without morph targets
              if (morphMeshes.length === 0 && !customJawBone) {
                clonedScene.traverse((child) => {
                  const mesh = child as THREE.Mesh;
                  if (mesh.isMesh && mesh.geometry) {
                    const geo = mesh.geometry;
                    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
                    if (posAttr && posAttr.count > 0) {
                      if (!mesh.userData.origPositions) {
                        mesh.userData.origPositions = new Float32Array(posAttr.array);
                      }
                      const orig = mesh.userData.origPositions as Float32Array;
                      if (!geo.boundingBox) geo.computeBoundingBox();
                      const box = geo.boundingBox!;
                      const jawThreshold = box.min.y + (box.max.y - box.min.y) * 0.42;

                      let modified = false;
                      for (let i = 0; i < posAttr.count; i++) {
                        const by = orig[i * 3 + 1];
                        if (by < jawThreshold) {
                          const t = (jawThreshold - by) / Math.max(0.001, jawThreshold - box.min.y);
                          const drop = finalJaw * 0.24 * (t * t);
                          posAttr.setY(i, by - drop);
                          posAttr.setZ(i, orig[i * 3 + 2] - drop * 0.35);
                          modified = true;
                        } else if (posAttr.getY(i) !== by) {
                          posAttr.setY(i, by);
                          posAttr.setZ(i, orig[i * 3 + 2]);
                          modified = true;
                        }
                      }
                      if (modified) posAttr.needsUpdate = true;
                    }
                  }
                });
              }

              // Build lower-case lookup map for bShapes once per frame if available
              let bsLookup: Record<string, number> | null = null;
              if (bShapes) {
                bsLookup = {};
                for (const k of Object.keys(bShapes)) {
                  bsLookup[k.toLowerCase()] = bShapes[k];
                }
              }

              // ── Comprehensive FaceFeatures fallback (Fase 4) ─────────────────────
              // When blendshapes are absent (lipsync/parafernalia mode or remote peer
              // running an older client), derive all 52 ARKit values from the simpler
              // FaceFeatures primitives so the face is never expressionless.
              const fbSmileL  = Math.max(0, features.mouthSmileLeft  ?? Math.max(0, features.mouthSmile || 0));
              const fbSmileR  = Math.max(0, features.mouthSmileRight ?? Math.max(0, features.mouthSmile || 0));
              const fbFrownL  = Math.max(0, -(features.mouthSmileLeft  ?? Math.min(0, features.mouthSmile || 0)));
              const fbFrownR  = Math.max(0, -(features.mouthSmileRight ?? Math.min(0, features.mouthSmile || 0)));
              const fbPucker  = features.mouthPucker ?? 0;
              const fbMouthX  = features.mouthX ?? 0;
              const fbBrowR   = features.browRaise ?? 0;
              const fbBrowF   = features.browFurrow ?? 0;

              // Master fallback map — used when bShapes[key] is not found
              const featureFallback: Record<string, number> = {
                // Jaw
                jawopen:    finalJaw,
                // Mouth
                mouthsmileleft:      fbSmileL,
                mouthsmileright:     fbSmileR,
                mouthfrownleft:      fbFrownL,
                mouthfrownright:     fbFrownR,
                mouthpucker:         fbPucker,
                mouthfunnel:         fbPucker * 0.6,
                mouthleft:           Math.max(0, -fbMouthX),
                mouthright:          Math.max(0,  fbMouthX),
                mouthlowerdownleft:  finalJaw * 0.45,
                mouthlowerdownright: finalJaw * 0.45,
                mouthshrugower:      0,
                mouthshrugupper:     0,
                mouthclose:          0,
                mouthdimpleleft:     fbSmileL * 0.4,
                mouthdimpleright:    fbSmileR * 0.4,
                mouthrollupper:      0,
                mouthrolllower:      0,
                mouthpressleft:      0,
                mouthpressright:     0,
                mouthstretchleft:    0,
                mouthstretchright:   0,
                mouthupperupright:   0,
                mouthupperupleft:    0,
                // Eyebrows
                browinnerup:    fbBrowR,
                browouterupleft:  fbBrowR * 0.8,
                browouterupright: fbBrowR * 0.8,
                browdownleft:   fbBrowF,
                browdownright:  fbBrowF,
                // Eyes
                eyeblinkleft:  features.eyeBlinkLeft  ?? 0,
                eyeblinkright: features.eyeBlinkRight ?? 0,
                eyewideleft:   features.eyeWideLeft   ?? 0,
                eyewideright:  features.eyeWideRight  ?? 0,
                eyesquintleft:  features.eyeWideLeft  ? 0 : (features.eyeBlinkLeft ?? 0) * 0.3,
                eyesquintright: features.eyeWideRight ? 0 : (features.eyeBlinkRight ?? 0) * 0.3,
                // Eye look — no mesh deformation; handled by 3D eyeballs
                eyelookupleft:   0,
                eyelookupright:  0,
                eyelookdownleft: 0,
                eyelookdownright:0,
                eyelookinleft:   0,
                eyelookinright:  0,
                eyelookoutleft:  0,
                eyelookoutright: 0,
                // Cheeks
                cheekpuff:       0,
                cheeksquintleft: fbSmileL * 0.5,
                cheeksquintright:fbSmileR * 0.5,
                // Nose
                nosesneerleft:  fbBrowF * 0.3,
                nosesneerright: fbBrowF * 0.3,
                // Jaw lateral
                jawforward: 0,
                jawleft:    Math.max(0, -fbMouthX) * 0.5,
                jawright:   Math.max(0,  fbMouthX) * 0.5,
                // Tongue
                tongueout: 0,
              };

              for (let m = 0; m < morphMeshes.length; m++) {
                const { dict, infl, keys } = morphMeshes[m];

                for (let k = 0; k < keys.length; k++) {
                  const key = keys[k];
                  const lk = key.toLowerCase();
                  // Strip common prefixes (e.g. "Wolf3D_Avatar.jawOpen" -> "jawopen")
                  const cleanKey = lk.replace(/^.*[.:_/]/, '');
                  const idx = dict[key];

                  let targetVal: number | undefined = undefined;

                  // 1. Direct match from bShapes or lowercase lookup
                  if (bShapes && bShapes[key] !== undefined) {
                    targetVal = bShapes[key];
                  } else if (bsLookup) {
                    if (bsLookup[lk] !== undefined) {
                      targetVal = bsLookup[lk];
                    } else if (bsLookup[cleanKey] !== undefined) {
                      targetVal = bsLookup[cleanKey];
                    }
                  }

                  // 1b. Feature fallback when bShapes not available
                  if (targetVal === undefined) {
                    targetVal = featureFallback[cleanKey] ?? featureFallback[lk];
                  }

                  // 2. Comprehensive Mouth & Jaw Opening Synchronization
                  // Handles ARKit (jawOpen), VRM (mouthOpen), standard DCCs (mouth_open, jaw, open, visemes)
                  const isJawOpen = (
                    cleanKey === 'jawopen' ||
                    cleanKey === 'mouthopen' ||
                    cleanKey === 'jaw' ||
                    cleanKey === 'open' ||
                    cleanKey === 'mouth_open' ||
                    cleanKey === 'jaw_open' ||
                    cleanKey === 'mouth' ||
                    cleanKey.includes('jawopen') ||
                    cleanKey.includes('mouthopen') ||
                    cleanKey.includes('viseme_aa') ||
                    cleanKey.includes('viseme_a') ||
                    cleanKey.includes('v_aa') ||
                    cleanKey.includes('v_a') ||
                    cleanKey === 'aa' ||
                    cleanKey === 'ah' ||
                    cleanKey === 'fcl_mth_o' ||
                    cleanKey === 'fcl_mth_a'
                  );

                  if (isJawOpen) {
                    targetVal = Math.max(targetVal ?? 0, finalJaw);
                  }

                  // 3. Suppress mouthClose when jaw is open (eliminates lip-pinching conflict)
                  if (cleanKey.includes('mouthclose') || cleanKey.includes('mouth_close')) {
                    const closeAttenuation = Math.max(0, 1 - finalJaw * 2.2);
                    targetVal = (targetVal ?? (bShapes?.['mouthClose'] ?? 0)) * closeAttenuation;
                  }

                  // 4. Lower Lip drop synchronization
                  if (cleanKey.includes('mouthlowerdown') || cleanKey.includes('mouth_lower_down')) {
                    targetVal = Math.max(targetVal ?? 0, finalJaw * 0.45);
                  }

                  // 5. Upper Lip stays stable during speech to maintain anatomical ceiling
                  if (cleanKey.includes('mouthupperup') || cleanKey.includes('mouth_upper_up')) {
                    targetVal = bShapes?.[key] ?? bsLookup?.[cleanKey] ?? 0;
                  }

                  // 6. Smile & Frown synchronization
                  if (cleanKey.includes('smile') || cleanKey.includes('mouthsmile')) {
                    const isLeft = cleanKey.includes('left') || cleanKey.includes('_l');
                    const isRight = cleanKey.includes('right') || cleanKey.includes('_r');
                    if (isLeft) {
                      targetVal = Math.max(targetVal ?? 0, (bShapes?.['mouthSmileLeft'] ?? 0) * 1.85, features.mouthSmileLeft ?? 0, Math.max(0, features.mouthSmile || 0));
                    } else if (isRight) {
                      targetVal = Math.max(targetVal ?? 0, (bShapes?.['mouthSmileRight'] ?? 0) * 1.85, features.mouthSmileRight ?? 0, Math.max(0, features.mouthSmile || 0));
                    } else {
                      targetVal = Math.max(targetVal ?? 0, Math.max(0, features.mouthSmile || 0));
                    }
                  } else if (cleanKey.includes('frown') || cleanKey.includes('mouthfrown')) {
                    const isLeft = cleanKey.includes('left') || cleanKey.includes('_l');
                    const isRight = cleanKey.includes('right') || cleanKey.includes('_r');
                    const frownVal = features.mouthSmile < 0 ? -features.mouthSmile : 0;
                    if (isLeft) {
                      targetVal = Math.max(targetVal ?? 0, (bShapes?.['mouthFrownLeft'] ?? 0) * 1.6, frownVal);
                    } else if (isRight) {
                      targetVal = Math.max(targetVal ?? 0, (bShapes?.['mouthFrownRight'] ?? 0) * 1.6, frownVal);
                    } else {
                      targetVal = Math.max(targetVal ?? 0, frownVal);
                    }
                  }

                  // 7. Pucker & Funnel
                  if (cleanKey.includes('pucker') || cleanKey.includes('mouthpucker')) {
                    targetVal = Math.max(targetVal ?? 0, (bShapes?.['mouthPucker'] ?? 0) * 1.7, features.mouthPucker ?? 0);
                  }
                  if (cleanKey.includes('funnel') || cleanKey.includes('mouthfunnel')) {
                    targetVal = Math.max(targetVal ?? 0, (bShapes?.['mouthFunnel'] ?? 0) * 1.5);
                  }

                  // 8. Eyes Blinking & Eyelid Openness
                  if (cleanKey.includes('blink') || cleanKey.includes('eyeblink')) {
                    const isLeft = cleanKey.includes('left') || cleanKey.includes('_l');
                    const isRight = cleanKey.includes('right') || cleanKey.includes('_r');
                    if (isLeft) {
                      targetVal = Math.max(targetVal ?? 0, bShapes?.['eyeBlinkLeft'] ?? 0, features.eyeBlinkLeft ?? 0);
                    } else if (isRight) {
                      targetVal = Math.max(targetVal ?? 0, bShapes?.['eyeBlinkRight'] ?? 0, features.eyeBlinkRight ?? 0);
                    } else {
                      targetVal = Math.max(targetVal ?? 0, ((features.eyeBlinkLeft || 0) + (features.eyeBlinkRight || 0)) / 2);
                    }
                  } else if (cleanKey.includes('eyewide') || cleanKey.includes('wide')) {
                    const isLeft = cleanKey.includes('left') || cleanKey.includes('_l');
                    const isRight = cleanKey.includes('right') || cleanKey.includes('_r');
                    const blinkVal = isLeft
                      ? (bShapes?.['eyeBlinkLeft'] ?? features.eyeBlinkLeft ?? 0)
                      : isRight
                      ? (bShapes?.['eyeBlinkRight'] ?? features.eyeBlinkRight ?? 0)
                      : (((features.eyeBlinkLeft || 0) + (features.eyeBlinkRight || 0)) / 2);
                    const wideVal = isLeft
                      ? Math.max(bShapes?.['eyeWideLeft'] ?? 0, features.eyeWideLeft ?? 0)
                      : isRight
                      ? Math.max(bShapes?.['eyeWideRight'] ?? 0, features.eyeWideRight ?? 0)
                      : (((features.eyeWideLeft || 0) + (features.eyeWideRight || 0)) / 2);
                    // Fade wide to 0 if blinking so eyelid can close completely
                    targetVal = Math.max(targetVal ?? 0, wideVal) * Math.max(0, 1 - blinkVal * 2.5);
                  } else if (cleanKey.includes('squint') || cleanKey.includes('eyesquint')) {
                    const isLeft = cleanKey.includes('left') || cleanKey.includes('_l');
                    const isRight = cleanKey.includes('right') || cleanKey.includes('_r');
                    const rawSquint = isLeft
                      ? (bShapes?.['eyeSquintLeft'] ?? (features.eyeWideLeft ? 0 : (features.eyeBlinkLeft ?? 0) * 0.3))
                      : isRight
                      ? (bShapes?.['eyeSquintRight'] ?? (features.eyeWideRight ? 0 : (features.eyeBlinkRight ?? 0) * 0.3))
                      : (targetVal ?? 0);
                    targetVal = rawSquint > 0.32 ? Math.min(1.0, (rawSquint - 0.32) * 1.5) : 0;
                  }

                  // 9. Eyebrows
                  if (cleanKey.includes('browinnerup') || cleanKey.includes('browup')) {
                    targetVal = Math.max(targetVal ?? 0, (bShapes?.['browInnerUp'] ?? 0) * 2.1, features.browRaise ?? 0);
                  } else if (cleanKey.includes('browouterupleft')) {
                    targetVal = Math.max(targetVal ?? 0, (bShapes?.['browOuterUpLeft'] ?? 0) * 2.0, (features.browRaise ?? 0) * 0.85);
                  } else if (cleanKey.includes('browouterupright')) {
                    targetVal = Math.max(targetVal ?? 0, (bShapes?.['browOuterUpRight'] ?? 0) * 2.0, (features.browRaise ?? 0) * 0.85);
                  } else if (cleanKey.includes('browdown')) {
                    const isLeft = cleanKey.includes('left') || cleanKey.includes('_l');
                    const isRight = cleanKey.includes('right') || cleanKey.includes('_r');
                    if (isLeft) {
                      targetVal = Math.max(targetVal ?? 0, (bShapes?.['browDownLeft'] ?? 0) * 2.0, features.browFurrow ?? 0);
                    } else if (isRight) {
                      targetVal = Math.max(targetVal ?? 0, (bShapes?.['browDownRight'] ?? 0) * 2.0, features.browFurrow ?? 0);
                    } else {
                      targetVal = Math.max(targetVal ?? 0, features.browFurrow ?? 0);
                    }
                  }

                  // 10. Smooth interpolation with differentiated speed groups (Fase 4)
                  // Fast: jaw/blink need instant response for lip-sync and natural blink
                  // Medium: expressions have moderate attack/decay
                  // Slow: subtle morphs fade gently
                  if (targetVal !== undefined) {
                    const curVal = infl[idx] || 0;
                    const speed = FAST_MORPH_KEYS.has(cleanKey)
                      ? (targetVal > curVal ? 0.92 : 0.82)
                      : MEDIUM_MORPH_KEYS.has(cleanKey)
                      ? 0.62
                      : 0.42;
                    infl[idx] = THREE.MathUtils.lerp(curVal, Math.min(1, Math.max(0, targetVal)), speed);
                  }
                }
              }
            },
            dispose: () => {
              rootGroup.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh) {
                  mesh.geometry?.dispose();
                  if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                  } else {
                    mesh.material?.dispose();
                  }
                }
              });
            },
          };

          characterControllerRef.current = controller;
          scene.add(controller.group);
        },
        undefined,
        (err) => {
          console.warn('[ThreeAvatarCanvas] Custom model load error, fallback to procedural mecha:', err);
          if (!isDisposed) {
            setIsLoading(false);
            const fallbackCtrl = buildProceduralRobotCharacter('mecha');
            characterControllerRef.current = fallbackCtrl;
            scene.add(fallbackCtrl.group);
          }
        }
      );
    }
  } else {
      // Distinct 3D Characters Built Instantly
      setIsLoading(false);
      let controller: Character3DController;

      if (avatarId === 'cat_3d') {
        controller = buildCatCharacter();
      } else if (avatarId === 'dog_3d') {
        controller = buildDogCharacter();
      } else if (avatarId === 'female_3d') {
        controller = buildFemaleCharacter();
      } else if (avatarId === 'horse_3d') {
        controller = buildHorseCharacter();
      } else if (avatarId === 'fox_sensei') {
        controller = buildFoxCharacter();
      } else if (avatarId === 'mesh_outline') {
        controller = buildMeshOutlineCharacter();
      } else if (avatarId === 'neon_holo') {
        controller = buildNeonHoloCharacter();
      } else if (avatarId === 'cyber_nova') {
        controller = buildProceduralRobotCharacter('cyber');
      } else if (avatarId === 'pixel_punk') {
        controller = buildProceduralRobotCharacter('punk');
      } else {
        controller = buildProceduralRobotCharacter('mecha');
      }

      characterControllerRef.current = controller;
      scene.add(controller.group);

      // Anchor 3D anatomical tracking nodes on procedural avatar's head (ears, snout, eyes, etc.)
      if (trackingProfile.mesh3DPoints && trackingProfile.mesh3DPoints.length > 0) {
        const nodeMat = new THREE.MeshBasicMaterial({ color: trackingProfile.dotColor });
        const nodeGeo = new THREE.SphereGeometry(0.015, 8, 8); // Ultra-thin delicate 3D tracking nodes
        trackingProfile.mesh3DPoints.forEach((pt) => {
          const node = new THREE.Mesh(nodeGeo, nodeMat);
          node.position.set(...pt.localPos);
          trackingGroup3D.add(node);
        });
        controller.headPivot.add(trackingGroup3D);
      }
    }

    // Off-screen culling: only render when this avatar card is visible in the viewport
    let isIntersecting = true;
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && container) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]) {
            isIntersecting = entries[0].isIntersecting;
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(container);
    }

    // Page visibility listener: pause rendering when tab is hidden or backgrounded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else if (!isDisposed) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 7. Main 60fps Three.js Render Loop with Continuous Smoothing Filter
    let lastTime = performance.now();
    const render = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(render);

      // Skip GPU render passes if tab is hidden or avatar is scrolled out of view on mobile
      if (document.hidden || !isIntersecting) {
        return;
      }

      // Synchronize 3D anatomical tracking mesh visibility
      if (trackingGroup3DRef.current) {
        trackingGroup3DRef.current.visible = show3DMeshRef.current;
      }

      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const feat = featuresRef.current;
      const cur = smoothPoseRef.current;
      const curTrackingMode = normalizeTrackingMode(trackingModeRef.current || feat.trackingMode);

      // Voice Rhythm & Dynamic Zoom (Modo Parafernalia: animación y zoom reactivos al ritmo de la voz)
      let dynamicZoomOffset = 0;
      if (curTrackingMode === 'parafernalia') {
        const rawVol = Number.isFinite(feat.audioVolume) ? (feat.audioVolume as number) : 0;
        const speechPunch = rawVol > 0.004 ? Math.min(0.60, (rawVol - 0.004) * 2.2) : 0;

        // Ataque rápido al hablar, decaimiento suave y fluido
        const zoomAlpha = speechPunch > currentZoomPunchRef.current
          ? 1 - Math.exp(-dt * 20)
          : 1 - Math.exp(-dt * 6.5);

        currentZoomPunchRef.current = THREE.MathUtils.lerp(
          currentZoomPunchRef.current,
          speechPunch,
          zoomAlpha
        );

        // Pulso rítmico sincronizado con la cadencia vocal
        const rhythmPulse = currentZoomPunchRef.current > 0.03
          ? Math.sin(now * 0.015) * (currentZoomPunchRef.current * 0.08)
          : 0;
        dynamicZoomOffset = currentZoomPunchRef.current + rhythmPulse;

        // Inclinación/cadencia sutil de cabeza al ritmo de la voz
        if (currentZoomPunchRef.current > 0.04) {
          const speechBob = Math.sin(now * 0.018) * 0.025 * currentZoomPunchRef.current;
          cur.pitch += speechBob;
        }
      } else {
        currentZoomPunchRef.current = THREE.MathUtils.lerp(
          currentZoomPunchRef.current,
          0,
          1 - Math.exp(-dt * 12)
        );
        dynamicZoomOffset = currentZoomPunchRef.current;
      }

      // ========================================================
      // 1:1 FAITHFUL HIGH-SPEED SMOOTHING FILTER
      // Tracks user's exact head rotation angle & velocity with zero drift
      // ========================================================
      const isDetected = feat.isFaceDetected;

      if (isDetected) {
        cur.lastValidTime = now;

        const safeYaw = Number.isFinite(feat.yaw) ? feat.yaw : 0;
        const safePitch = Number.isFinite(feat.pitch) ? feat.pitch : 0;
        const safeRoll = Number.isFinite(feat.roll) ? feat.roll : 0;

        // Snappy, time-step invariant exponential smoothing (faithful speed)
        const alphaRot = 1 - Math.exp(-dt * 26);
        cur.yaw = THREE.MathUtils.lerp(cur.yaw, safeYaw, alphaRot);
        cur.pitch = THREE.MathUtils.lerp(cur.pitch, safePitch, alphaRot);
        cur.roll = THREE.MathUtils.lerp(cur.roll, safeRoll, alphaRot);

        // Instant mouth tracking (fast opening attack, snappy release)
        const targetJaw = Math.min(1, Math.max(0, Number.isFinite(feat.jawOpen) ? feat.jawOpen : 0));
        const alphaJaw = targetJaw > cur.jawOpen ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 22);
        cur.jawOpen = THREE.MathUtils.lerp(cur.jawOpen, targetJaw, alphaJaw);

        const alphaFace = 1 - Math.exp(-dt * 22);
        cur.mouthSmile = THREE.MathUtils.lerp(cur.mouthSmile, Number.isFinite(feat.mouthSmile) ? feat.mouthSmile : 0, alphaFace);
        cur.mouthPucker = THREE.MathUtils.lerp(cur.mouthPucker, Number.isFinite(feat.mouthPucker) ? feat.mouthPucker : 0, alphaFace);
        cur.browRaise = THREE.MathUtils.lerp(cur.browRaise, Number.isFinite(feat.browRaise) ? feat.browRaise : 0, alphaFace);
        cur.browFurrow = THREE.MathUtils.lerp(cur.browFurrow, Number.isFinite(feat.browFurrow) ? feat.browFurrow : 0, alphaFace);
        cur.eyeBlinkLeft = THREE.MathUtils.lerp(cur.eyeBlinkLeft, Number.isFinite(feat.eyeBlinkLeft) ? feat.eyeBlinkLeft : 0, 1 - Math.exp(-dt * 35));
        cur.eyeBlinkRight = THREE.MathUtils.lerp(cur.eyeBlinkRight, Number.isFinite(feat.eyeBlinkRight) ? feat.eyeBlinkRight : 0, 1 - Math.exp(-dt * 35));
        cur.eyeWideLeft = THREE.MathUtils.lerp(cur.eyeWideLeft, Number.isFinite(feat.eyeWideLeft) ? feat.eyeWideLeft : 0, 1 - Math.exp(-dt * 30));
        cur.eyeWideRight = THREE.MathUtils.lerp(cur.eyeWideRight, Number.isFinite(feat.eyeWideRight) ? feat.eyeWideRight : 0, 1 - Math.exp(-dt * 30));
        cur.gazeX = THREE.MathUtils.lerp(cur.gazeX, Number.isFinite(feat.gazeX) ? feat.gazeX : 0, alphaFace);
        cur.gazeY = THREE.MathUtils.lerp(cur.gazeY, Number.isFinite(feat.gazeY) ? feat.gazeY : 0, alphaFace);
      } else {
        // No camera or face tracking off: Head stays perfectly neutral/centered, mouth animates dynamically with voice volume (Lip-Sync)
        const vol = Number.isFinite(feat.audioVolume) ? (feat.audioVolume as number) : 0;
        // Peak-only audio mouth opening: starts strictly at 0 (closed) and only animates on prominent vocal sound peaks (> 0.18)
        const audioGate = 0.18;
        const audioJaw = vol > audioGate
          ? Math.min(0.65, Math.pow((vol - audioGate) / (1.0 - audioGate), 1.3) * 0.75)
          : 0;
        const alphaJaw = audioJaw > cur.jawOpen ? 1 - Math.exp(-dt * 35) : 1 - Math.exp(-dt * 20);
        cur.jawOpen = THREE.MathUtils.lerp(cur.jawOpen, audioJaw, alphaJaw);

        // Swift, fluid return to centered resting pose for head rotation and non-mouth expressions
        const alphaCenter = 1 - Math.exp(-dt * 16);
        cur.yaw = THREE.MathUtils.lerp(cur.yaw, 0, alphaCenter);
        cur.pitch = THREE.MathUtils.lerp(cur.pitch, 0, alphaCenter);
        cur.roll = THREE.MathUtils.lerp(cur.roll, 0, alphaCenter);
        cur.mouthSmile = THREE.MathUtils.lerp(cur.mouthSmile, 0, alphaCenter);
        cur.mouthPucker = THREE.MathUtils.lerp(cur.mouthPucker, 0, alphaCenter);
        cur.browRaise = THREE.MathUtils.lerp(cur.browRaise, 0, alphaCenter);
        cur.browFurrow = THREE.MathUtils.lerp(cur.browFurrow, 0, alphaCenter);
        cur.eyeBlinkLeft = THREE.MathUtils.lerp(cur.eyeBlinkLeft, 0, alphaCenter);
        cur.eyeBlinkRight = THREE.MathUtils.lerp(cur.eyeBlinkRight, 0, alphaCenter);
        cur.eyeWideLeft = THREE.MathUtils.lerp(cur.eyeWideLeft, 0, alphaCenter);
        cur.eyeWideRight = THREE.MathUtils.lerp(cur.eyeWideRight, 0, alphaCenter);
        cur.gazeX = THREE.MathUtils.lerp(cur.gazeX, 0, alphaCenter);
        cur.gazeY = THREE.MathUtils.lerp(cur.gazeY, 0, alphaCenter);
      }

      // ========================================================
      // A. UPDATE GLTF ROBOT (three_robot)
      // ========================================================
      if (isGLBRobot) {
        if (mixerRef.current) {
          mixerRef.current.update(dt);
        }

        // 1. Head Bone Rotation (1:1 direct tracking offset)
        if (headBoneRef.current && initialHeadRotationRef.current) {
          const rest = initialHeadRotationRef.current;
          headBoneRef.current.rotation.x = rest.x + cur.pitch;
          headBoneRef.current.rotation.y = rest.y + cur.yaw;
          headBoneRef.current.rotation.z = rest.z + cur.roll;
        }

        // 2. Neck Bone Rotation (subtle natural sway)
        if (neckBoneRef.current && initialNeckRotationRef.current) {
          const rest = initialNeckRotationRef.current;
          neckBoneRef.current.rotation.x = rest.x + cur.pitch * 0.15;
          neckBoneRef.current.rotation.y = rest.y + cur.yaw * 0.15;
          neckBoneRef.current.rotation.z = rest.z + cur.roll * 0.15;
        }

        // Real-time mouth mapping purely driven by lips tracking (no false audio triggers)
        const activeMouthOpen = cur.jawOpen;

        // 3. Perfect Cyber Mouth Mapping (Animated Equalizer LED Matrix)
        const mouthBars = robotMouthBarsRef.current;
        if (mouthBars.length > 0) {
          const smile = cur.mouthSmile;
          const pucker = cur.mouthPucker;

          mouthBars.forEach((bar, i) => {
            const dist = Math.abs(i - 3) / 3; // 0 at center, 1 at edge
            const centerFactor = 1 - dist * 0.55;

            // Height reacts purely in real time to actual lips opening
            const targetH = 1.0 + (activeMouthOpen * 6.5) * centerFactor;
            bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, Math.max(0.4, targetH), 0.35);

            // Width contracts with mouth pucker
            bar.scale.x = THREE.MathUtils.lerp(bar.scale.x, Math.max(0.4, 1.0 - pucker * 0.45), 0.3);

            // Curvature: smile curves outer bars up; frown curves outer bars down
            const smileCurve = (i - 3) * (i - 3) * 0.00016 * smile;
            bar.position.y = THREE.MathUtils.lerp(bar.position.y, smileCurve, 0.3);
            bar.position.x = (i - 3) * 0.00105 * (1.0 - pucker * 0.35);
          });
        }

        // 4. Synchronized Morph Targets: Surprised morph target opens the robot mouth!
        const targetSurprised = activeMouthOpen;
        const targetSad = cur.mouthSmile < -0.15 ? Math.min(1, (-cur.mouthSmile - 0.15) * 1.8) : 0;
        const targetAngry = Math.min(1, Math.max(0, cur.browFurrow * 1.2));

        faceMeshesRef.current.forEach((face) => {
          const dict = face.morphTargetDictionary;
          const influences = face.morphTargetInfluences;
          if (!dict || !influences) return;

          const angryIdx = dict['Angry'];
          if (angryIdx !== undefined) {
            influences[angryIdx] = THREE.MathUtils.lerp(influences[angryIdx], targetAngry, 0.25);
          }
          const surprisedIdx = dict['Surprised'];
          if (surprisedIdx !== undefined) {
            influences[surprisedIdx] = THREE.MathUtils.lerp(influences[surprisedIdx], targetSurprised, 0.35);
          }
          const sadIdx = dict['Sad'];
          if (sadIdx !== undefined) {
            influences[sadIdx] = THREE.MathUtils.lerp(influences[sadIdx], targetSad, 0.25);
          }

          // ARKit Blendshapes (for custom 3D face models)
          const jawOpenIdx = dict['jawOpen'];
          if (jawOpenIdx !== undefined) {
            influences[jawOpenIdx] = THREE.MathUtils.lerp(influences[jawOpenIdx], activeMouthOpen, 0.4);
          }
          const blinkLIdx = dict['eyeBlinkLeft'];
          if (blinkLIdx !== undefined) {
            influences[blinkLIdx] = THREE.MathUtils.lerp(influences[blinkLIdx], cur.eyeBlinkLeft, 0.4);
          }
          const blinkRIdx = dict['eyeBlinkRight'];
          if (blinkRIdx !== undefined) {
            influences[blinkRIdx] = THREE.MathUtils.lerp(influences[blinkRIdx], cur.eyeBlinkRight, 0.4);
          }
          const wideLIdx = dict['eyeWideLeft'];
          if (wideLIdx !== undefined) {
            influences[wideLIdx] = THREE.MathUtils.lerp(influences[wideLIdx], cur.eyeWideLeft, 0.4);
          }
          const wideRIdx = dict['eyeWideRight'];
          if (wideRIdx !== undefined) {
            influences[wideRIdx] = THREE.MathUtils.lerp(influences[wideRIdx], cur.eyeWideRight, 0.4);
          }
          const smileLIdx = dict['mouthSmileLeft'];
          if (smileLIdx !== undefined) {
            const smileVal = Math.max(0, cur.mouthSmile);
            influences[smileLIdx] = THREE.MathUtils.lerp(influences[smileLIdx], smileVal, 0.35);
          }
          const smileRIdx = dict['mouthSmileRight'];
          if (smileRIdx !== undefined) {
            const smileVal = Math.max(0, cur.mouthSmile);
            influences[smileRIdx] = THREE.MathUtils.lerp(influences[smileRIdx], smileVal, 0.35);
          }
          const frownLIdx = dict['mouthFrownLeft'];
          if (frownLIdx !== undefined) {
            const frownVal = cur.mouthSmile < 0 ? -cur.mouthSmile : 0;
            influences[frownLIdx] = THREE.MathUtils.lerp(influences[frownLIdx], frownVal, 0.35);
          }
          const frownRIdx = dict['mouthFrownRight'];
          if (frownRIdx !== undefined) {
            const frownVal = cur.mouthSmile < 0 ? -cur.mouthSmile : 0;
            influences[frownRIdx] = THREE.MathUtils.lerp(influences[frownRIdx], frownVal, 0.35);
          }
          const puckerIdx = dict['mouthPucker'];
          if (puckerIdx !== undefined) {
            influences[puckerIdx] = THREE.MathUtils.lerp(influences[puckerIdx], cur.mouthPucker, 0.35);
          }
          const browUpIdx = dict['browInnerUp'];
          if (browUpIdx !== undefined) {
            influences[browUpIdx] = THREE.MathUtils.lerp(influences[browUpIdx], cur.browRaise, 0.35);
          }
          const browDownLIdx = dict['browDownLeft'];
          if (browDownLIdx !== undefined) {
            influences[browDownLIdx] = THREE.MathUtils.lerp(influences[browDownLIdx], cur.browFurrow, 0.35);
          }
          const browDownRIdx = dict['browDownRight'];
          if (browDownRIdx !== undefined) {
            influences[browDownRIdx] = THREE.MathUtils.lerp(influences[browDownRIdx], cur.browFurrow, 0.35);
          }
        });
      }

      // ========================================================
      // B. UPDATE PROCEDURAL 3D CHARACTERS (Cat, Dog, Female, Horse, etc.)
      // ========================================================
      const controller = characterControllerRef.current;
      if (controller) {
        // Pass the 1:1 faithful tracking state to character controller
        const smoothFeat: FaceFeatures = {
          ...feat,
          yaw: cur.yaw,
          pitch: cur.pitch,
          roll: cur.roll,
          jawOpen: cur.jawOpen,
          mouthSmile: cur.mouthSmile,
          mouthPucker: cur.mouthPucker,
          browRaise: cur.browRaise,
          browFurrow: cur.browFurrow,
          eyeBlinkLeft: cur.eyeBlinkLeft,
          eyeBlinkRight: cur.eyeBlinkRight,
          eyeWideLeft: cur.eyeWideLeft,
          eyeWideRight: cur.eyeWideRight,
          gazeX: cur.gazeX,
          gazeY: cur.gazeY,
        };

        controller.update(smoothFeat, dt, now);

        // Procedural Emote Motion
        const em = emoteTriggerRef.current;
        if (em) {
          const elapsed = (now - em.start) / 1000;
          if (em.name === 'Dance') {
            controller.group.position.x = Math.sin(elapsed * 8) * 0.25;
            controller.group.rotation.y = Math.sin(elapsed * 6) * 0.3;
          } else if (em.name === 'Jump') {
            controller.group.position.y = Math.max(0, Math.sin(elapsed * 6) * 0.45);
          } else if (em.name === 'Wave') {
            controller.headPivot.rotation.z += Math.sin(elapsed * 10) * 0.15;
          } else if (em.name === 'ThumbsUp') {
            controller.group.position.y = Math.sin(elapsed * 5) * 0.12;
          }
        } else {
          controller.group.position.set(0, 0, 0);
          controller.group.rotation.set(0, 0, 0);
        }
      }

      // Dynamic viewer camera recentering and dynamic voice-rhythm zoom (Parafernalia)
      if (camera) {
        const offX = cameraOffsetXRef.current || 0;
        const offY = cameraOffsetYRef.current || 0;
        camera.position.x = -offX;
        camera.position.y = 4.4 - offY;
        camera.position.z = 4.8 - dynamicZoomOffset;
        camera.lookAt(-offX, 3.8 - offY, 0);
      }

      renderer.render(scene, camera);
    };

    render();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (observer) {
        observer.disconnect();
      }
      canvasDom.removeEventListener('webglcontextlost', handleContextLost);
      canvasDom.removeEventListener('webglcontextrestored', handleContextRestored);

      if (characterControllerRef.current) {
        try {
          characterControllerRef.current.dispose();
        } catch (_) {}
      }

      // Systematic deep disposal of all meshes, geometries, and materials in scene
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (mesh.geometry) {
            mesh.geometry.dispose();
          }
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((mat) => {
                Object.keys(mat).forEach((key) => {
                  const val = (mat as any)[key];
                  if (val && typeof val === 'object' && val.isTexture) {
                    val.dispose();
                  }
                });
                mat.dispose();
              });
            } else {
              const mat = mesh.material;
              Object.keys(mat).forEach((key) => {
                const val = (mat as any)[key];
                if (val && typeof val === 'object' && val.isTexture) {
                  val.dispose();
                }
              });
              mat.dispose();
            }
          }
        }
      });
      scene.clear();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Force WebGL context release so mobile browser pool immediately frees the slot
      try {
        if (typeof renderer.forceContextLoss === 'function') {
          renderer.forceContextLoss();
        }
        if (renderer.domElement) {
          renderer.domElement.width = 1;
          renderer.domElement.height = 1;
        }
        renderer.dispose();
      } catch (_) {}
    };
  }, [avatarId, restoreCount, avatarRevision, avatarDef?.modelUrl]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-[#08080c] ${className}`}
    >
      {/* 3D Loading Spinner */}
      {isLoading && isWebglAvailable && !isContextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#08080c]/85 backdrop-blur-xs z-10">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <span className="text-[11px] font-medium text-cyan-300">
            Cargando 3D...
          </span>
        </div>
      )}

      {/* Error State */}
      {loadError && isWebglAvailable && !isContextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-rose-400 text-xs text-center z-10 bg-[#08080c]/90">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setRestoreCount((c) => c + 1)}
            className="mt-2 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-300 border border-slate-700 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* WebGL Fallback / Context Lost Recovery View (Prevents Blank/White Screen on Mobile) */}
      {(!isWebglAvailable || isContextLost) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-[#08080c] text-center z-10 animate-in fade-in">
          <div
            className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl shadow-xl border mb-2 transition-transform duration-200 ${
              isSpeaking ? 'scale-105 ring-2 ring-cyan-400' : ''
            }`}
            style={{
              backgroundColor: `${avatarDef.themeColor}18`,
              borderColor: `${avatarDef.themeColor}50`,
            }}
          >
            {avatarDef.emoji}
            {isSpeaking && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>
          <span className="text-xs font-bold text-slate-200 truncate max-w-[160px]">
            {avatarDef.name}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5">
            {isContextLost ? 'Restaurando GPU...' : 'Modo Ligero (Ahorro GPU)'}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsContextLost(false);
              setIsWebglAvailable(true);
              setRestoreCount((c) => c + 1);
            }}
            className="mt-2.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 text-[11px] font-semibold rounded-lg cursor-pointer transition shadow"
          >
            Reconectar 3D
          </button>
        </div>
      )}

      {/* User Name Badge & Speaking Indicator */}
      {userName && (
        <div className="absolute bottom-2 left-2 bg-slate-900/85 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold text-slate-100 flex items-center gap-1.5 border border-slate-700/60 shadow-lg z-20 pointer-events-none">
          <span
            className={`w-2 h-2 rounded-full ${
              isSpeaking ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <span className="truncate max-w-[120px]">{userName}</span>
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
            {isWebglAvailable && !isContextLost ? '3D WEBGL' : '2D LITE'}
          </span>
        </div>
      )}
    </div>
  );
};
