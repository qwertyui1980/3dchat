import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AvatarId, FaceFeatures } from '../../types';
import { getAvatarTrackingProfile } from './avatarTrackingProfiles';
import { AVATAR_LIST } from './avatarConfigs';
import {
  Character3DController,
  buildCatCharacter,
  buildDogCharacter,
  buildFemaleCharacter,
  buildHorseCharacter,
  buildFoxCharacter,
  buildProceduralRobotCharacter,
  buildMeshOutlineCharacter,
  buildFaceCapCharacter,
} from './threeCharacterBuilder';
import { getAssetUrl } from '../../utils/assetUrl';
import {
  isLeaderAvatar,
  hasCachedLeaderModel,
  loadCustomLeaderModel,
  buildCustomLeaderCharacter,
} from './customLeaderAvatars';

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
}

export const ThreeAvatarCanvas: React.FC<ThreeAvatarCanvasProps> = ({
  avatarId = 'three_robot',
  features,
  userName,
  isSpeaking = false,
  className = '',
  cameraOffsetX = 0,
  cameraOffsetY = 0,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isGLBRobot = avatarId === 'three_robot';
  const isFaceCapAvatar = avatarId === 'face_cap';
  const [isLoading, setIsLoading] = useState(
    (isGLBRobot && !cachedGLTF) ||
    (isFaceCapAvatar && !cachedFaceCapGLTF)
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isWebglAvailable, setIsWebglAvailable] = useState(true);
  const [isContextLost, setIsContextLost] = useState(false);
  const [restoreCount, setRestoreCount] = useState(0);
  const [currentEmote, setCurrentEmote] = useState<string | null>(null);
  const [show3DMesh, setShow3DMesh] = useState(false);
  const show3DMeshRef = useRef(false);
  show3DMeshRef.current = show3DMesh;
  const trackingGroup3DRef = useRef<THREE.Group | null>(null);
  const trackingProfile = getAvatarTrackingProfile(avatarId);

  const avatarDef = useMemo(() => {
    return AVATAR_LIST.find((a) => a.id === avatarId) || {
      id: avatarId,
      name: 'Avatar 3D',
      emoji: '👤',
      themeColor: '#06b6d4',
      accentColor: '#38bdf8',
      badge: '3D',
    };
  }, [avatarId]);

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
      trump_3d: 0xe11d48,
      putin_3d: 0x2563eb,
      jinping_3d: 0xdc2626,
      bush_3d: 0x3b82f6,
      thatcher_3d: 0x8b5cf6,
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
          clonedScene.position.set(0, 0, 0);
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
    } else if (isLeaderAvatar(avatarId)) {
      setIsLoading(!hasCachedLeaderModel(avatarId));
      loadCustomLeaderModel(avatarId)
        .then((model) => {
          if (isDisposed) return;
          setIsLoading(false);
          const controller = buildCustomLeaderCharacter(avatarId, model);
          characterControllerRef.current = controller;
          scene.add(controller.group);
        })
        .catch((err) => {
          console.error(`[ThreeAvatarCanvas] Error loading leader ${avatarId}:`, err);
          if (!isDisposed) {
            setIsLoading(false);
            setLoadError(`Error al cargar modelo 3D (${avatarId})`);
          }
        });
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
        cur.gazeX = THREE.MathUtils.lerp(cur.gazeX, Number.isFinite(feat.gazeX) ? feat.gazeX : 0, alphaFace);
        cur.gazeY = THREE.MathUtils.lerp(cur.gazeY, Number.isFinite(feat.gazeY) ? feat.gazeY : 0, alphaFace);
      } else {
        // No camera or face tracking off: Head stays neutral, mouth animates dynamically with voice volume
        const vol = Number.isFinite(feat.audioVolume) ? feat.audioVolume : 0;
        const audioJaw = vol > 0.05 ? Math.min(1, Math.max(0, (vol - 0.05) * 3.2)) : 0;
        const alphaJaw = audioJaw > cur.jawOpen ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 20);
        cur.jawOpen = THREE.MathUtils.lerp(cur.jawOpen, audioJaw, alphaJaw);

        // Smoothly glide head and other facial features to neutral
        const decay = 0.04;
        cur.yaw = THREE.MathUtils.lerp(cur.yaw, 0, decay);
        cur.pitch = THREE.MathUtils.lerp(cur.pitch, 0, decay);
        cur.roll = THREE.MathUtils.lerp(cur.roll, 0, decay);
        cur.mouthSmile = THREE.MathUtils.lerp(cur.mouthSmile, 0, decay);
        cur.mouthPucker = THREE.MathUtils.lerp(cur.mouthPucker, 0, decay);
        cur.browRaise = THREE.MathUtils.lerp(cur.browRaise, 0, decay);
        cur.browFurrow = THREE.MathUtils.lerp(cur.browFurrow, 0, decay);
        cur.eyeBlinkLeft = THREE.MathUtils.lerp(cur.eyeBlinkLeft, 0, decay);
        cur.eyeBlinkRight = THREE.MathUtils.lerp(cur.eyeBlinkRight, 0, decay);
        cur.gazeX = THREE.MathUtils.lerp(cur.gazeX, 0, decay);
        cur.gazeY = THREE.MathUtils.lerp(cur.gazeY, 0, decay);
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

      // Dynamic viewer camera recentering
      if (camera) {
        const offX = cameraOffsetXRef.current || 0;
        const offY = cameraOffsetYRef.current || 0;
        camera.position.x = -offX;
        camera.position.y = 4.4 - offY;
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
  }, [avatarId, restoreCount]);

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
