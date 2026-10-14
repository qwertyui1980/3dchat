import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Sparkles,
  Upload,
  Camera,
  Download,
  Shield,
  X,
  Sliders,
  Eye,
  Smile,
  RefreshCw,
  Layers,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Maximize2,
  Minimize2,
  Box,
  Image as ImageIcon,
  Video,
  VideoOff,
  Palette,
  Wand2,
  Volume2,
  VolumeX,
  ScanFace,
} from 'lucide-react';
import {
  faceToBlendshapeServiceSingleton,
  Face3DGenerationResult,
  TransformDebugParams,
  DEFAULT_DEBUG_PARAMS,
  createTrackingPointsMesh,
  DEFAULT_GESTURE_PARAMS,
} from '../../services/face3d/faceToBlendshapeService';
import { EyePairResult, IRIS_COLOR_PRESETS, PUPIL_COLOR_PRESETS } from '../../services/face3d/eyeGenerator';
import { ARKIT_BLENDSHAPE_NAMES, ARKitBlendshapeName, ARKitBlendshapeMapper } from '../../services/face3d/arkitMapper';
import { faceTrackerSingleton } from '../../services/mediapipeService';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';

interface FaceBlendshapeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onSelectAvatar?: (avatarId: string) => void;
}

export const FaceBlendshapeStudioModal: React.FC<FaceBlendshapeStudioModalProps> = ({
  isOpen,
  onClose,
  isAdmin = true,
  onSelectAvatar,
}) => {
  // Tabs
  const [activeTab, setActiveTab] = useState<'morphs' | 'tuning' | 'export'>('morphs');

  // Image & Processing state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedImageElement, setSelectedImageElement] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [hasGeneratedModel, setHasGeneratedModel] = useState(false);

  // Webcam capture state
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);

  // Live Webcam Real-time Tracking state
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const arkitMapperRef = useRef<ARKitBlendshapeMapper>(new ARKitBlendshapeMapper());
  const lastUiUpdateRef = useRef<number>(0);

  // Speech Simulation Preview state (dividing from lower lip down, closing with upper lip)
  const [isSimulatingSpeech, setIsSimulatingSpeech] = useState(false);
  const isSimulatingSpeechRef = useRef(false);
  isSimulatingSpeechRef.current = isSimulatingSpeech;

  // 3D Viewport refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Model Objects refs
  const faceMeshRef = useRef<THREE.Mesh | null>(null);
  const headModelRef = useRef<THREE.Group | null>(null);
  const bustModelRef = useRef<THREE.Group | null>(null);
  const eyesGroupRef = useRef<THREE.Group | null>(null);
  const oralCavityRef = useRef<THREE.Group | null>(null);
  const eyePairResultRef = useRef<EyePairResult | null>(null);
  const trackingPointsRef = useRef<THREE.Points | null>(null);
  const photoPlaneRef = useRef<THREE.Mesh | null>(null);
  const currentResultRef = useRef<Face3DGenerationResult | null>(null);

  // Display toggles
  const [showFaceMesh, setShowFaceMesh] = useState(true);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showHeadBase, setShowHeadBase] = useState(true);
  const [showTrackingPoints, setShowTrackingPoints] = useState(false);
  const [showPhotoPlane, setShowPhotoPlane] = useState(false);
  const [photoPlaneOpacity, setPhotoPlaneOpacity] = useState(0.7);
  const showPhotoPlaneRef = useRef(showPhotoPlane);
  showPhotoPlaneRef.current = showPhotoPlane;
  const photoPlaneOpacityRef = useRef(photoPlaneOpacity);
  photoPlaneOpacityRef.current = photoPlaneOpacity;
  const [tuningTarget, setTuningTarget] = useState<'face' | 'mouth' | 'eyes' | 'head' | 'gestures'>('face');
  const [isCopied, setIsCopied] = useState(false);

  // Transform params
  const [debugParams, setDebugParams] = useState<TransformDebugParams>(DEFAULT_DEBUG_PARAMS);
  const debugParamsRef = useRef<TransformDebugParams>(DEFAULT_DEBUG_PARAMS);
  debugParamsRef.current = debugParams;

  // Morph targets test values (0 to 1)
  const [testBlendshapes, setTestBlendshapes] = useState<Record<string, number>>({});

  // Export / Avatar saving state
  const [exportAvatarName, setExportAvatarName] = useState('');
  const [exportThemeColor, setExportThemeColor] = useState('#06b6d4');
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper status setter
  const setStatus = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setStatusMessage({ text, type });
    if (type === 'success') {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }, []);

  // Initialize Three.js Scene
  const initThreeScene = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    if (!container) return;

    // Cleanup existing
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c16);
    sceneRef.current = scene;

    if (photoPlaneRef.current) {
      scene.add(photoPlaneRef.current);
    }

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 400;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2.2);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.8;
    controls.maxDistance = 5.0;
    controlsRef.current = controls;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
    frontLight.position.set(0, 0, 5);
    scene.add(frontLight);

    const topLight = new THREE.DirectionalLight(0xa5f3fc, 0.8);
    topLight.position.set(0, 5, 2);
    scene.add(topLight);

    const backLight = new THREE.DirectionalLight(0x818cf8, 0.6);
    backLight.position.set(0, -2, -5);
    scene.add(backLight);

    const leftLight = new THREE.PointLight(0x38bdf8, 0.5);
    leftLight.position.set(-4, 0, 2);
    scene.add(leftLight);

    const rightLight = new THREE.PointLight(0x818cf8, 0.5);
    rightLight.position.set(4, 0, 2);
    scene.add(rightLight);

    // Subtle grid helper on floor
    const grid = new THREE.GridHelper(4, 20, 0x06b6d4, 0x1e293b);
    grid.position.y = -1.2;
    scene.add(grid);

    // Render loop
    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();

      if (isSimulatingSpeechRef.current && faceMeshRef.current) {
        const t = performance.now() * 0.0055;
        // Natural speech syllabic envelope (cadence between 0 and 0.70)
        const wave = Math.sin(t * 1.9) * 0.38 + Math.sin(t * 3.7) * 0.22 + Math.sin(t * 0.8) * 0.15;
        const speechOpen = Math.max(0, Math.min(0.75, wave));

        const mesh = faceMeshRef.current;
        const jawIdx = mesh.morphTargetDictionary ? mesh.morphTargetDictionary['jawOpen'] : undefined;
        if (jawIdx !== undefined && mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[jawIdx] = speechOpen;
        }

        if (oralCavityRef.current) {
          const lowerTeeth = oralCavityRef.current.getObjectByName('lowerTeeth');
          if (lowerTeeth) {
            if (!lowerTeeth.userData.basePos) lowerTeeth.userData.basePos = lowerTeeth.position.clone();
            const base = lowerTeeth.userData.basePos as THREE.Vector3;
            lowerTeeth.position.y = base.y - speechOpen * 0.18;
            lowerTeeth.position.z = base.z - speechOpen * 0.08;
          }
        }
      }

      // Animate 478 MediaPipe tracking points dynamically with mesh morph target influences
      if (trackingPointsRef.current && trackingPointsRef.current.visible && faceMeshRef.current) {
        const mesh = faceMeshRef.current;
        const ptsGeo = trackingPointsRef.current.geometry;
        const posAttr = ptsGeo.attributes.position;
        const basePoints = mesh.userData.canonicalPoints;
        const morphAttrs = mesh.geometry.morphAttributes.position;
        const influences = mesh.morphTargetInfluences;
        if (basePoints && morphAttrs && influences) {
          for (let i = 0; i < basePoints.length; i++) {
            let px = basePoints[i].x;
            let py = basePoints[i].y;
            let pz = basePoints[i].z + 0.008;
            for (let m = 0; m < morphAttrs.length; m++) {
              const inf = influences[m];
              if (inf > 0.001) {
                const morphPos = morphAttrs[m];
                px += (morphPos.getX(i) - basePoints[i].x) * inf;
                py += (morphPos.getY(i) - basePoints[i].y) * inf;
                pz += (morphPos.getZ(i) - basePoints[i].z) * inf;
              }
            }
            posAttr.setXYZ(i, px, py, pz);
          }
          posAttr.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
    };
    animate();
  }, []);

  // Stop Live Webcam Tracking
  const stopLiveWebcamTracking = useCallback(() => {
    faceTrackerSingleton.stopTracking();
    if (liveStreamRef.current) {
      liveStreamRef.current.getTracks().forEach((t) => t.stop());
      liveStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setIsLiveTracking(false);

    const currentParams = debugParamsRef.current;
    // Reset rotation to neutral
    if (faceMeshRef.current) {
      faceMeshRef.current.rotation.set(
        THREE.MathUtils.degToRad(currentParams.face.rotationX),
        THREE.MathUtils.degToRad(currentParams.face.rotationY),
        THREE.MathUtils.degToRad(currentParams.face.rotationZ)
      );
    }
    if (headModelRef.current) {
      headModelRef.current.rotation.set(
        THREE.MathUtils.degToRad(currentParams.head.rotationX),
        THREE.MathUtils.degToRad(currentParams.head.rotationY),
        THREE.MathUtils.degToRad(currentParams.head.rotationZ)
      );
    }
    if (eyePairResultRef.current) {
      eyePairResultRef.current.updateGaze(
        currentParams.eyes?.manualGazeX || 0,
        currentParams.eyes?.manualGazeY || 0
      );
    }
    if (oralCavityRef.current) {
      const lowerTeeth = oralCavityRef.current.getObjectByName('lowerTeeth');
      if (lowerTeeth) {
        lowerTeeth.position.y = -0.038;
        lowerTeeth.position.z = -0.065;
      }
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isOpen && isAdmin) {
      timer = setTimeout(() => {
        initThreeScene();
      }, 100);
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      stopWebcam();
      stopLiveWebcamTracking();
    };
  }, [isOpen, isAdmin, initThreeScene, stopLiveWebcamTracking]);

  // Handle Responsive Resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      const container = canvasRef.current.parentElement;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    };

    // Initial resize trigger
    handleResize();

    const container = canvasRef.current?.parentElement;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        handleResize();
      });
      observer.observe(container);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Stop Webcam
  const stopWebcam = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop());
      webcamStreamRef.current = null;
    }
    setIsWebcamActive(false);
  };

  // Start Webcam
  const startWebcam = async () => {
    try {
      stopWebcam();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      webcamStreamRef.current = stream;
      setIsWebcamActive(true);
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play();
      }
    } catch (err: any) {
      setStatus(`Error accediendo a la cámara: ${err?.message || err}`, 'error');
    }
  };

  // Take snapshot from Webcam
  const captureWebcamSnapshot = () => {
    if (!webcamVideoRef.current) return;
    const video = webcamVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSelectedImageElement(img);
      setPreviewUrl(dataUrl);
      setShowPhotoPlane(true);
      stopWebcam();
      setStatus('Foto capturada con éxito. Haz clic en "Generar Modelo 3D".', 'info');
    };
    img.src = dataUrl;
  };

  // Start Live Webcam Tracking
  const startLiveWebcamTracking = async () => {
    try {
      if (!faceMeshRef.current) {
        setStatus('Genera el modelo 3D primero para animar los blendshapes en vivo.', 'error');
        return;
      }

      stopLiveWebcamTracking();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      liveStreamRef.current = stream;
      setIsLiveTracking(true);

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
        await liveVideoRef.current.play();

        faceTrackerSingleton.startTracking(
          liveVideoRef.current,
          (features) => {
            // Live head pose orientation (lerped)
            if (faceMeshRef.current) {
              const baseY = THREE.MathUtils.degToRad(debugParams.face.rotationY);
              const baseX = THREE.MathUtils.degToRad(debugParams.face.rotationX);
              const baseZ = THREE.MathUtils.degToRad(debugParams.face.rotationZ);

              faceMeshRef.current.rotation.y = THREE.MathUtils.lerp(faceMeshRef.current.rotation.y, baseY + features.yaw * 0.75, 0.3);
              faceMeshRef.current.rotation.x = THREE.MathUtils.lerp(faceMeshRef.current.rotation.x, baseX + features.pitch * 0.75, 0.3);
              faceMeshRef.current.rotation.z = THREE.MathUtils.lerp(faceMeshRef.current.rotation.z, baseZ + features.roll * 0.75, 0.3);
            }
            if (headModelRef.current) {
              const baseY = THREE.MathUtils.degToRad(debugParams.head.rotationY);
              const baseX = THREE.MathUtils.degToRad(debugParams.head.rotationX);
              const baseZ = THREE.MathUtils.degToRad(debugParams.head.rotationZ);

              headModelRef.current.rotation.y = THREE.MathUtils.lerp(headModelRef.current.rotation.y, baseY + features.yaw * 0.75, 0.3);
              headModelRef.current.rotation.x = THREE.MathUtils.lerp(headModelRef.current.rotation.x, baseX + features.pitch * 0.75, 0.3);
              headModelRef.current.rotation.z = THREE.MathUtils.lerp(headModelRef.current.rotation.z, baseZ + features.roll * 0.75, 0.3);
            }

            // Real-time 3D Eyeball Gaze Tracking from Webcam
            if (
              eyePairResultRef.current &&
              debugParams.eyes?.enabled &&
              (debugParams.eyes?.gazeTracking ?? true)
            ) {
              eyePairResultRef.current.updateGaze(features.gazeX || 0, features.gazeY || 0);
            }
          },
          undefined,
          (categories, landmarks) => {
            // Live ARKit blendshapes mapping
            const mapped = arkitMapperRef.current.mapMediaPipeToARKit(categories, landmarks);
            const mesh = faceMeshRef.current;
            if (!mesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

            Object.entries(mapped).forEach(([name, val]) => {
              const idx = mesh.morphTargetDictionary![name];
              if (idx !== undefined && mesh.morphTargetInfluences) {
                mesh.morphTargetInfluences[idx] = val;
              }
            });

            // Live Oral Cavity Lower Dental Arch Kinematics
            if (oralCavityRef.current && debugParams.mouth?.oralCavityEnabled) {
              const lowerTeeth = oralCavityRef.current.getObjectByName('lowerTeeth');
              if (lowerTeeth) {
                if (!lowerTeeth.userData.basePos) lowerTeeth.userData.basePos = lowerTeeth.position.clone();
                const base = lowerTeeth.userData.basePos as THREE.Vector3;
                const jawOpenVal = mapped['jawOpen'] || 0;
                const jawIntensity = debugParams.mouth?.jawOpenScale ?? 1.0;
                lowerTeeth.position.y = base.y - jawOpenVal * 0.18 * jawIntensity;
                lowerTeeth.position.z = base.z - jawOpenVal * 0.08 * jawIntensity;
              }
            }

            // Throttle UI slider updates to every 60ms for silky 60 FPS ThreeJS + smooth React
            const now = performance.now();
            if (now - lastUiUpdateRef.current > 60) {
              lastUiUpdateRef.current = now;
              setTestBlendshapes({ ...mapped });
            }
          }
        );
      }
      setStatus('¡Espejo facial activo! Mueve tu rostro o habla frente a la cámara.', 'success');
    } catch (err: any) {
      console.error('[FaceBlendshapeStudio] Live tracking error:', err);
      setStatus(`Error al iniciar tracking en vivo: ${err?.message || err}`, 'error');
      stopLiveWebcamTracking();
    }
  };

  // Load Image File
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('Por favor selecciona un archivo de imagen (PNG, JPG, WebP).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setSelectedImageElement(img);
        setPreviewUrl(dataUrl);
        setShowPhotoPlane(true);
        const nameClean = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setExportAvatarName(nameClean.charAt(0).toUpperCase() + nameClean.slice(1));
        setStatus('Imagen cargada. Lista para procesar.', 'info');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Reference Photo Plane in 3D Viewport (align 3D avatar against background photo)
  const updatePhotoPlane = useCallback(
    (img: HTMLImageElement | HTMLCanvasElement | null) => {
      const scene = sceneRef.current;
      if (!scene) return;

      if (!img) {
        if (photoPlaneRef.current) {
          scene.remove(photoPlaneRef.current);
          photoPlaneRef.current.geometry.dispose();
          if (photoPlaneRef.current.material instanceof THREE.Material) {
            photoPlaneRef.current.material.dispose();
          }
          photoPlaneRef.current = null;
        }
        return;
      }

      const naturalWidth = 'naturalWidth' in img ? (img.naturalWidth || img.width) : img.width;
      const naturalHeight = 'naturalHeight' in img ? (img.naturalHeight || img.height) : img.height;
      const aspect = naturalWidth / (naturalHeight || 1);

      if (photoPlaneRef.current) {
        scene.remove(photoPlaneRef.current);
        photoPlaneRef.current.geometry.dispose();
        if (photoPlaneRef.current.material instanceof THREE.Material) {
          photoPlaneRef.current.material.dispose();
        }
        photoPlaneRef.current = null;
      }

      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;

      const planeHeight = 2.4;
      const planeWidth = planeHeight * aspect;
      const geo = new THREE.PlaneGeometry(planeWidth, planeHeight);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: photoPlaneOpacityRef.current,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'referencePhotoPlane';
      mesh.position.set(0, 0, -1.60);
      mesh.visible = showPhotoPlaneRef.current;
      mesh.renderOrder = -1;
      scene.add(mesh);
      photoPlaneRef.current = mesh;
    },
    []
  );

  useEffect(() => {
    if (selectedImageElement) {
      updatePhotoPlane(selectedImageElement);
    }
  }, [selectedImageElement, updatePhotoPlane]);

  useEffect(() => {
    if (photoPlaneRef.current) {
      photoPlaneRef.current.visible = showPhotoPlane;
      if (photoPlaneRef.current.material instanceof THREE.MeshBasicMaterial) {
        photoPlaneRef.current.material.opacity = photoPlaneOpacity;
      }
    }
  }, [showPhotoPlane, photoPlaneOpacity]);

  // Process image with MediaPipe Face Landmarker & Generate 3D Model
  const processImage = async () => {
    if (!selectedImageElement) {
      setStatus('Por favor sube o toma una foto primero.', 'error');
      return;
    }

    setIsProcessing(true);
    setStatus('Detectando 478 puntos faciales y blendshapes ARKit con MediaPipe...', 'info');

    try {
      const result = await faceToBlendshapeServiceSingleton.processFaceImage(
        selectedImageElement,
        {
          mouthParams: debugParams.mouth,
          eyeOptions: debugParams.eyes,
        }
      );
      currentResultRef.current = result;

      const scene = sceneRef.current;
      if (!scene) throw new Error('Scene not initialized');

      // Remove existing meshes
      const oldFace = scene.getObjectByName('faceMesh');
      if (oldFace) scene.remove(oldFace);
      const oldHead = scene.getObjectByName('headModel');
      if (oldHead) scene.remove(oldHead);
      const oldBust = scene.getObjectByName('bustModel');
      if (oldBust) scene.remove(oldBust);
      const oldEyes = scene.getObjectByName('eyesGroup');
      if (oldEyes) scene.remove(oldEyes);
      const oldCavity = scene.getObjectByName('oralCavity');
      if (oldCavity) scene.remove(oldCavity);
      const oldPts = scene.getObjectByName('trackingPointsMesh');
      if (oldPts) scene.remove(oldPts);

      faceMeshRef.current = result.faceMesh;
      headModelRef.current = result.headModel;
      bustModelRef.current = null;
      eyesGroupRef.current = result.eyesGroup;
      oralCavityRef.current = result.oralCavity;
      eyePairResultRef.current = result.eyePairResult;

      scene.add(result.faceMesh);
      if (result.eyesGroup) {
        result.eyesGroup.visible = debugParams.eyes?.enabled ?? true;
        scene.add(result.eyesGroup);
      }
      if (result.oralCavity) {
        result.oralCavity.visible = debugParams.mouth?.oralCavityEnabled ?? true;
        scene.add(result.oralCavity);
      }
      if (result.headModel) {
        result.headModel.visible = showHeadBase;
        scene.add(result.headModel);
      }

      // Create 478 MediaPipe landmark tracking points cloud
      if (result.faceMesh.userData.canonicalPoints) {
        const ptsMesh = createTrackingPointsMesh(result.faceMesh.userData.canonicalPoints);
        ptsMesh.visible = showTrackingPoints;
        trackingPointsRef.current = ptsMesh;
        scene.add(ptsMesh);
      }

      // Apply transforms
      faceToBlendshapeServiceSingleton.applyTransforms(
        result.faceMesh,
        result.headModel,
        null,
        debugParams,
        result.eyesGroup,
        result.oralCavity,
        result.eyePairResult,
        trackingPointsRef.current
      );

      // Initialize blendshapes map to 0 (neutral rest pose)
      const initialBlendshapes: Record<string, number> = {};
      ARKIT_BLENDSHAPE_NAMES.forEach((name) => {
        initialBlendshapes[name] = 0;
      });
      setTestBlendshapes(initialBlendshapes);

      setHasGeneratedModel(true);
      setStatus('¡Modelo 3D con 52 Blendshapes ARKit y textura UV generado con éxito!', 'success');
    } catch (err: any) {
      console.error('[FaceBlendshapeStudio] Error processing:', err);
      setStatus(err?.message || 'Error al procesar la imagen facial.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Update Morph Target Influence in real time
  const handleBlendshapeChange = (name: string, value: number) => {
    setTestBlendshapes((prev) => ({ ...prev, [name]: value }));

    const mesh = faceMeshRef.current;
    if (!mesh) return;

    let idx = mesh.morphTargetDictionary ? mesh.morphTargetDictionary[name] : undefined;
    if (idx === undefined && mesh.geometry?.userData?.targetNames) {
      const targetNames = mesh.geometry.userData.targetNames as string[];
      const found = targetNames.indexOf(name);
      if (found !== -1) idx = found;
    }
    if (idx === undefined) {
      const fallbackIdx = (ARKIT_BLENDSHAPE_NAMES as readonly string[]).indexOf(name);
      if (fallbackIdx !== -1) idx = fallbackIdx;
    }

    if (idx !== undefined && mesh.morphTargetInfluences && idx < mesh.morphTargetInfluences.length) {
      mesh.morphTargetInfluences[idx] = value;
    }

    if (name === 'jawOpen' && oralCavityRef.current) {
      const lowerTeeth = oralCavityRef.current.getObjectByName('lowerTeeth');
      if (lowerTeeth) {
        if (!lowerTeeth.userData.basePos) lowerTeeth.userData.basePos = lowerTeeth.position.clone();
        const base = lowerTeeth.userData.basePos as THREE.Vector3;
        lowerTeeth.position.y = base.y - value * 0.18;
        lowerTeeth.position.z = base.z - value * 0.08;
      }
    }

    // Connect eyeLook blendshape sliders to 3D eyeball gaze tracking
    if (name.startsWith('eyeLook') && eyePairResultRef.current) {
      let gx = 0;
      let gy = 0;
      if (name === 'eyeLookInLeft' || name === 'eyeLookOutRight') gx = value;
      else if (name === 'eyeLookOutLeft' || name === 'eyeLookInRight') gx = -value;
      else if (name === 'eyeLookUpLeft' || name === 'eyeLookUpRight') gy = value;
      else if (name === 'eyeLookDownLeft' || name === 'eyeLookDownRight') gy = -value;
      eyePairResultRef.current.updateGaze(gx, gy);
    }
  };

  // Reset Blendshapes
  const handleResetBlendshapes = () => {
    const mesh = faceMeshRef.current;
    const resetValues: Record<string, number> = {};
    ARKIT_BLENDSHAPE_NAMES.forEach((name, i) => {
      resetValues[name] = 0;
      if (mesh && mesh.morphTargetInfluences) {
        let idx = mesh.morphTargetDictionary ? mesh.morphTargetDictionary[name] : i;
        if (idx === undefined) idx = i;
        if (idx < mesh.morphTargetInfluences.length) {
          mesh.morphTargetInfluences[idx] = 0;
        }
      }
    });
    if (oralCavityRef.current) {
      const lowerTeeth = oralCavityRef.current.getObjectByName('lowerTeeth');
      if (lowerTeeth && lowerTeeth.userData.basePos) {
        lowerTeeth.position.copy(lowerTeeth.userData.basePos);
      }
    }
    if (eyePairResultRef.current) {
      eyePairResultRef.current.updateGaze(0, 0);
    }
    setIsSimulatingSpeech(false);
    isSimulatingSpeechRef.current = false;
    setTestBlendshapes(resetValues);
  };

  const toggleSpeechSimulation = () => {
    const next = !isSimulatingSpeech;
    setIsSimulatingSpeech(next);
    isSimulatingSpeechRef.current = next;
    if (!next && faceMeshRef.current) {
      handleBlendshapeChange('jawOpen', 0);
    }
  };

  // Update Transforms & Calibration Parameters
  const handleDebugParamChange = (
    category: 'head' | 'face' | 'mouth' | 'eyes' | 'bust',
    key: string,
    value: any
  ) => {
    setDebugParams((prev) => {
      const updated: TransformDebugParams = {
        ...prev,
        [category]: {
          ...(prev as any)[category],
          [key]: value,
        },
      };

      // Real-time Eyeball Appearance / Manual Gaze / Pupil Size & Color Update
      if (category === 'eyes' && eyePairResultRef.current) {
        if (key === 'irisColor') {
          eyePairResultRef.current.setIrisColor(value);
        } else if (key === 'pupilColor') {
          eyePairResultRef.current.setPupilColor(value);
        } else if (key === 'pupilSize') {
          eyePairResultRef.current.setPupilSize(value);
        } else if (key === 'manualGazeX' || key === 'manualGazeY') {
          const gx = key === 'manualGazeX' ? value : updated.eyes.manualGazeX;
          const gy = key === 'manualGazeY' ? value : updated.eyes.manualGazeY;
          eyePairResultRef.current.updateGaze(gx, gy);
        }
      }

      if (faceMeshRef.current) {
        faceToBlendshapeServiceSingleton.applyTransforms(
          faceMeshRef.current,
          headModelRef.current,
          bustModelRef.current,
          updated,
          eyesGroupRef.current,
          oralCavityRef.current,
          eyePairResultRef.current,
          trackingPointsRef.current
        );
      }
      return updated;
    });
  };

  // Sync 478 Landmark Tracking Points visibility toggle
  useEffect(() => {
    if (trackingPointsRef.current) {
      trackingPointsRef.current.visible = showTrackingPoints;
    }
  }, [showTrackingPoints]);

  // Re-generate Face Mesh with new mouth parameters
  const handleRebakeMouthMesh = async () => {
    if (!selectedImageElement) {
      setStatus('Sube o captura una foto primero.', 'error');
      return;
    }
    setIsProcessing(true);
    setStatus('Re-generando geometría facial con nueva calibración de boca...', 'info');
    try {
      await processImage();
      setStatus('¡Geometría de boca y labios actualizada con éxito!', 'success');
    } catch (err: any) {
      setStatus(err?.message || 'Error al actualizar malla.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Re-generate Face Mesh with new gestures and multi-point calibration parameters
  const handleRebakeGestureMesh = async () => {
    if (!selectedImageElement) {
      setStatus('Sube o captura una foto primero.', 'error');
      return;
    }
    setIsProcessing(true);
    setStatus('Re-generando morph targets con calibración multi-punto para captura de gestos...', 'info');
    try {
      await processImage();
      setStatus('¡Geometría y morph targets para captura de gestos actualizados con éxito!', 'success');
    } catch (err: any) {
      setStatus(err?.message || 'Error al actualizar malla.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset Gesture Parameters Exclusively
  const handleResetGestureParams = () => {
    setDebugParams((prev) => {
      const updated: TransformDebugParams = {
        ...prev,
        mouth: {
          ...prev.mouth,
          ...DEFAULT_GESTURE_PARAMS,
        },
      };
      if (faceMeshRef.current) {
        faceToBlendshapeServiceSingleton.applyTransforms(
          faceMeshRef.current,
          headModelRef.current,
          bustModelRef.current,
          updated,
          eyesGroupRef.current,
          oralCavityRef.current,
          eyePairResultRef.current,
          trackingPointsRef.current
        );
      }
      return updated;
    });
    setStatus('Parámetros de gestos restablecidos por defecto.', 'info');
  };

  // Test Quick Gesture Combinations
  const handleTestQuickGesture = (gesture: 'smile' | 'surprise' | 'wink' | 'furrow' | 'pucker' | 'neutral') => {
    if (!faceMeshRef.current) return;
    const mesh = faceMeshRef.current;
    const dict = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (!dict || !influences) return;

    // Reset all
    influences.fill(0);
    const updatedTest: Record<string, number> = {};
    ARKIT_BLENDSHAPE_NAMES.forEach((name) => {
      updatedTest[name] = 0;
    });

    const setMorph = (name: string, val: number) => {
      const idx = dict[name];
      if (idx !== undefined) {
        influences[idx] = val;
        updatedTest[name] = val;
      }
    };

    switch (gesture) {
      case 'smile':
        setMorph('mouthSmileLeft', 0.95);
        setMorph('mouthSmileRight', 0.95);
        setMorph('cheekSquintLeft', 0.4);
        setMorph('cheekSquintRight', 0.4);
        break;
      case 'surprise':
        setMorph('jawOpen', 0.65);
        setMorph('browInnerUp', 0.9);
        setMorph('browOuterUpLeft', 0.7);
        setMorph('browOuterUpRight', 0.7);
        setMorph('eyeWideLeft', 0.85);
        setMorph('eyeWideRight', 0.85);
        break;
      case 'wink':
        setMorph('eyeBlinkLeft', 1.0);
        setMorph('mouthSmileLeft', 0.7);
        setMorph('browDownLeft', 0.3);
        break;
      case 'furrow':
        setMorph('browDownLeft', 0.95);
        setMorph('browDownRight', 0.95);
        setMorph('eyeSquintLeft', 0.5);
        setMorph('eyeSquintRight', 0.5);
        setMorph('mouthFrownLeft', 0.3);
        setMorph('mouthFrownRight', 0.3);
        break;
      case 'pucker':
        setMorph('mouthPucker', 1.0);
        break;
      case 'neutral':
      default:
        break;
    }

    setTestBlendshapes(updatedTest);
  };

  // Reset All Transforms
  const handleResetTransforms = () => {
    setDebugParams(DEFAULT_DEBUG_PARAMS);
    if (eyePairResultRef.current) {
      eyePairResultRef.current.setIrisColor(DEFAULT_DEBUG_PARAMS.eyes.irisColor);
      eyePairResultRef.current.updateGaze(0, 0);
    }
    if (faceMeshRef.current) {
      faceToBlendshapeServiceSingleton.applyTransforms(
        faceMeshRef.current,
        headModelRef.current,
        bustModelRef.current,
        DEFAULT_DEBUG_PARAMS,
        eyesGroupRef.current,
        oralCavityRef.current,
        eyePairResultRef.current
      );
    }
  };

  // Reset Face Mesh Transforms Exclusively
  const handleResetFaceTransforms = () => {
    setDebugParams((prev) => {
      const updated: TransformDebugParams = {
        ...prev,
        face: { ...DEFAULT_DEBUG_PARAMS.face },
      };
      if (faceMeshRef.current) {
        faceToBlendshapeServiceSingleton.applyTransforms(
          faceMeshRef.current,
          headModelRef.current,
          bustModelRef.current,
          updated,
          eyesGroupRef.current,
          oralCavityRef.current,
          eyePairResultRef.current
        );
      }
      return updated;
    });
  };

  // Reset Mouth Parameters Exclusively
  const handleResetMouthParams = () => {
    setDebugParams((prev) => {
      const updated: TransformDebugParams = {
        ...prev,
        mouth: { ...DEFAULT_DEBUG_PARAMS.mouth },
      };
      if (faceMeshRef.current) {
        faceToBlendshapeServiceSingleton.applyTransforms(
          faceMeshRef.current,
          headModelRef.current,
          bustModelRef.current,
          updated,
          eyesGroupRef.current,
          oralCavityRef.current,
          eyePairResultRef.current
        );
      }
      return updated;
    });
  };

  // Reset Eyeball Parameters Exclusively
  const handleResetEyeParams = () => {
    setDebugParams((prev) => {
      const updated: TransformDebugParams = {
        ...prev,
        eyes: { ...DEFAULT_DEBUG_PARAMS.eyes },
      };
      if (eyePairResultRef.current) {
        eyePairResultRef.current.setIrisColor(DEFAULT_DEBUG_PARAMS.eyes.irisColor);
        eyePairResultRef.current.updateGaze(0, 0);
      }
      if (faceMeshRef.current) {
        faceToBlendshapeServiceSingleton.applyTransforms(
          faceMeshRef.current,
          headModelRef.current,
          bustModelRef.current,
          updated,
          eyesGroupRef.current,
          oralCavityRef.current,
          eyePairResultRef.current
        );
      }
      return updated;
    });
  };

  // Reset Head Base Transforms Exclusively
  const handleResetHeadTransforms = () => {
    setDebugParams((prev) => {
      const updated: TransformDebugParams = {
        ...prev,
        head: { ...DEFAULT_DEBUG_PARAMS.head },
      };
      if (faceMeshRef.current) {
        faceToBlendshapeServiceSingleton.applyTransforms(
          faceMeshRef.current,
          headModelRef.current,
          bustModelRef.current,
          updated,
          eyesGroupRef.current,
          oralCavityRef.current,
          eyePairResultRef.current
        );
      }
      return updated;
    });
  };

  // Toggle Face Mesh Visibility
  const handleToggleFaceMesh = () => {
    const next = !showFaceMesh;
    setShowFaceMesh(next);
    if (faceMeshRef.current) {
      faceMeshRef.current.visible = next;
    }
  };

  // Toggle Wireframe
  const handleToggleWireframe = () => {
    const next = !showWireframe;
    setShowWireframe(next);
    if (faceMeshRef.current && (faceMeshRef.current.material as THREE.MeshStandardMaterial)) {
      (faceMeshRef.current.material as THREE.MeshStandardMaterial).wireframe = next;
    }
  };

  // Toggle Head Base Model
  const handleToggleHeadBase = () => {
    const next = !showHeadBase;
    setShowHeadBase(next);
    if (headModelRef.current) {
      headModelRef.current.visible = next;
    }
  };

  // Reset Camera View
  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 0, 2.2);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  // Copy Debug Params to Clipboard
  const handleCopyDebugParams = () => {
    const jsonStr = JSON.stringify(debugParams, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Export GLB file download
  const handleExportGLB = async () => {
    if (!faceMeshRef.current) {
      setStatus('No hay ningún modelo 3D generado para exportar.', 'error');
      return;
    }

    setIsExporting(true);
    setStatus('Exportando archivo GLB con 52 Morph Targets, Ojos 3D y cavidad oral...', 'info');

    try {
      const buffer = await faceToBlendshapeServiceSingleton.exportGLB(
        faceMeshRef.current,
        headModelRef.current,
        null,
        eyesGroupRef.current,
        oralCavityRef.current,
        showHeadBase,
        false,
        debugParams.eyes?.enabled ?? true,
        debugParams.mouth?.oralCavityEnabled ?? true
      );

      const blob = new Blob([buffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = (exportAvatarName.trim() || 'face-model-blendshapes')
        .toLowerCase()
        .replace(/\s+/g, '-');
      link.download = `${safeName}.glb`;
      link.click();
      URL.revokeObjectURL(url);

      setStatus(`¡Modelo "${safeName}.glb" descargado exitosamente!`, 'success');
    } catch (err: any) {
      console.error('[FaceBlendshapeStudio] Export error:', err);
      setStatus(`Error exportando GLB: ${err?.message || err}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // Save directly as XStreamX Custom Avatar
  const handleSaveToXStreamX = async () => {
    if (!faceMeshRef.current) {
      setStatus('No hay ningún modelo 3D generado.', 'error');
      return;
    }

    const avatarName = exportAvatarName.trim() || 'Mi Avatar 3D Facial';

    setIsSavingAvatar(true);
    try {
      const buffer = await faceToBlendshapeServiceSingleton.exportGLB(
        faceMeshRef.current,
        headModelRef.current,
        null,
        eyesGroupRef.current,
        oralCavityRef.current,
        showHeadBase,
        false,
        debugParams.eyes?.enabled ?? true,
        debugParams.mouth?.oralCavityEnabled ?? true
      );

      const file = new File([buffer], `${avatarName.toLowerCase().replace(/\s+/g, '_')}.glb`, {
        type: 'model/gltf-binary',
      });

      const newAvatar = await avatarModelServiceSingleton.addCustomModel({
        name: avatarName,
        tagline: 'Avatar 3D generado desde foto con MediaPipe y ARKit Blendshapes',
        category: 'Creados con IA',
        themeColor: exportThemeColor,
        badge: 'ARKit 3D Face',
        file,
      });

      setSaveSuccessMsg(`¡Avatar "${newAvatar.name}" guardado exitosamente en tu catálogo 3D de XStreamX!`);
      if (onSelectAvatar) {
        onSelectAvatar(newAvatar.id);
      }
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('[FaceBlendshapeStudio] Save avatar error:', err);
      setStatus(`Error al guardar avatar: ${err?.message || err}`, 'error');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2 md:p-3 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full h-full max-w-[99vw] xl:max-w-[98vw] 2xl:max-w-[2400px] max-h-[99vh] sm:max-h-[96vh] rounded-2xl sm:rounded-3xl bg-[#090b14] border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-[#0e1220] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                  3D Masks
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider">
                  3D STUDIO
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Genera modelos 3D con 52 morph targets ARKit y texturizado UV desde una sola foto
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 hover:text-rose-400 text-neutral-400 border border-white/[0.08] flex items-center justify-center transition cursor-pointer"
            title="Cerrar estudio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Workspace Body: Fully Responsive Layout across any browser width */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2.5 sm:gap-3 p-2.5 sm:p-3.5 overflow-hidden">
          {/* Left Panel: Upload & Image Source */}
          <div className="w-full lg:w-[260px] xl:w-[280px] 2xl:w-[320px] shrink-0 flex flex-col gap-3 h-auto max-h-[280px] lg:max-h-none lg:h-full overflow-y-auto pr-1">
            <div className="p-3.5 rounded-2xl bg-[#0e1220]/90 border border-white/[0.08] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-cyan-400" />
                  1. Foto Frontal
                </span>
                {previewUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setSelectedImageElement(null);
                      stopWebcam();
                    }}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {/* Webcam Live Capture View */}
              {isWebcamActive ? (
                <div className="flex flex-col gap-2">
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black border border-cyan-500/50">
                    <video
                      ref={webcamVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 border-2 border-dashed border-cyan-400/40 pointer-events-none rounded-xl" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={captureWebcamSnapshot}
                      className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capturar Foto
                    </button>
                    <button
                      type="button"
                      onClick={stopWebcam}
                      className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                /* Image Preview */
                <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/60 border border-white/[0.1] group">
                  <img
                    src={previewUrl}
                    alt="Rostro seleccionado"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md rounded-lg p-1.5 text-center text-[10px] text-cyan-300 font-medium border border-white/10">
                    Rostro listo para procesar
                  </div>
                </div>
              ) : (
                /* Upload Drag & Drop Box */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileSelect(e.dataTransfer.files[0]);
                    }
                  }}
                  className="aspect-square w-full rounded-xl border-2 border-dashed border-cyan-500/30 hover:border-cyan-400 bg-cyan-950/[0.1] hover:bg-cyan-950/[0.2] flex flex-col items-center justify-center p-4 text-center cursor-pointer transition group"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 group-hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-2 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-neutral-200">
                    Arrastra una foto aquí
                  </span>
                  <span className="text-[10px] text-neutral-400 mt-1">
                    o haz clic para explorar (.jpg, .png)
                  </span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
              />

              {/* Action Buttons for Source */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-[#151928] hover:bg-[#1f253d] text-neutral-200 border border-white/[0.08] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  Subir Archivo
                </button>
                <button
                  type="button"
                  onClick={startWebcam}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-[#151928] hover:bg-[#1f253d] text-neutral-200 border border-white/[0.08] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  Tomar Selfie
                </button>
              </div>

              {/* Process Button */}
              <button
                type="button"
                disabled={!selectedImageElement || isProcessing}
                onClick={processImage}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-black text-xs tracking-wider shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>PROCESANDO MEDIAPIPE...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>GENERAR MODELO 3D</span>
                  </>
                )}
              </button>
            </div>

            {/* Status Feedback */}
            {statusMessage && (
              <div
                className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 animate-fade-in ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-200'
                    : statusMessage.type === 'error'
                    ? 'bg-rose-950/80 border-rose-600/60 text-rose-200'
                    : 'bg-cyan-950/80 border-cyan-600/60 text-cyan-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : statusMessage.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Center Column: 3D Viewport (Expands dynamically to fill available width) */}
          <div className="flex-1 min-w-0 min-h-[350px] lg:min-h-0 h-full flex flex-col rounded-2xl bg-[#05060b] border border-cyan-500/20 overflow-hidden relative shadow-inner">
            {/* Viewport Top Toolbar */}
            <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 z-10 flex items-center justify-between pointer-events-none gap-2">
              <div className="flex items-center gap-1 sm:gap-1.5 bg-[#0e1220]/85 backdrop-blur-md p-1 rounded-xl border border-white/[0.08] pointer-events-auto shadow-lg overflow-x-auto max-w-[calc(100%-48px)] no-scrollbar">
                <button
                  type="button"
                  onClick={handleToggleFaceMesh}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    showFaceMesh ? 'bg-cyan-500 text-slate-950' : 'text-neutral-300 hover:bg-white/10'
                  }`}
                  title="Mostrar/Ocultar Malla Facial"
                >
                  <Smile className="w-3.5 h-3.5" />
                  Malla
                </button>
                <button
                  type="button"
                  onClick={handleToggleWireframe}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    showWireframe ? 'bg-cyan-400 text-slate-950' : 'text-neutral-300 hover:bg-white/10'
                  }`}
                  title="Activar/Desactivar Malla Wireframe"
                >
                  <Box className="w-3.5 h-3.5" />
                  Wireframe
                </button>
                <button
                  type="button"
                  onClick={handleToggleHeadBase}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    showHeadBase ? 'bg-indigo-500 text-white' : 'text-neutral-300 hover:bg-white/10'
                  }`}
                  title="Mostrar/Ocultar Base de Cabeza 3D"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Base Cabeza
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !debugParams.eyes?.enabled;
                    handleDebugParamChange('eyes', 'enabled', next);
                  }}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    debugParams.eyes?.enabled ? 'bg-cyan-400 text-slate-950 font-black' : 'text-neutral-400 hover:bg-white/10'
                  }`}
                  title="Mostrar/Ocultar Ojos 3D"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ojos 3D
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !debugParams.mouth?.oralCavityEnabled;
                    handleDebugParamChange('mouth', 'oralCavityEnabled', next);
                  }}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    debugParams.mouth?.oralCavityEnabled ? 'bg-rose-500 text-white font-black' : 'text-neutral-400 hover:bg-white/10'
                  }`}
                  title="Mostrar/Ocultar Cavidad Oral y Dientes 3D"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Boca
                </button>
                <button
                  type="button"
                  onClick={() => setShowTrackingPoints(!showTrackingPoints)}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    showTrackingPoints ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/30' : 'text-neutral-400 hover:bg-white/10'
                  }`}
                  title="Mostrar/Ocultar Nube 3D de 478 Puntos Faciales MediaPipe"
                >
                  <ScanFace className="w-3.5 h-3.5" />
                  478 Puntos
                </button>
                <button
                  type="button"
                  onClick={() => setShowPhotoPlane(!showPhotoPlane)}
                  className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    showPhotoPlane ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30' : 'text-neutral-400 hover:bg-white/10'
                  }`}
                  title="Mostrar/Ocultar Foto Original en el Plano de Fondo 3D"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Plano Foto
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetCamera}
                className="shrink-0 p-1.5 rounded-xl bg-[#0e1220]/80 backdrop-blur-md border border-white/[0.08] text-neutral-300 hover:text-cyan-300 hover:bg-white/10 pointer-events-auto transition cursor-pointer shadow-lg"
                title="Centrar cámara"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* 3D Canvas */}
            <div className="flex-1 w-full h-full relative">
              <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

              {!hasGeneratedModel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/[0.08] border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-3">
                    <Box className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-bold text-neutral-300">Visor 3D en Espera</h4>
                  <p className="text-xs text-neutral-500 max-w-xs mt-1">
                    Sube una foto o toma una captura y pulsa &ldquo;Generar Modelo 3D&rdquo; para ver el render interactivo con morph targets.
                  </p>
                </div>
              )}

              {/* Live Tracking PiP Webcam Box */}
              <div
                className={`absolute bottom-3 left-3 z-20 w-32 aspect-square rounded-2xl overflow-hidden border border-cyan-500/50 shadow-2xl bg-black/90 backdrop-blur-md transition-all duration-300 ${
                  isLiveTracking ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-90 pointer-events-none'
                }`}
              >
                <video
                  ref={liveVideoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-rose-500/40 text-[9px] font-black text-rose-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  EN VIVO
                </div>
              </div>
            </div>

            {/* Viewport Bottom Hint */}
            <div className="px-3 py-1.5 bg-[#090b14]/90 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-neutral-400">
              <span>Rotar: Click izq. + Arrastrar</span>
              <span>Zoom: Rueda scroll</span>
              <span>Mover: Click der. + Arrastrar</span>
            </div>
          </div>

          {/* Right Column: Controls, Blendshapes & Export */}
          <div className="w-full lg:w-[360px] xl:w-[420px] 2xl:w-[480px] shrink-0 flex flex-col h-auto max-h-[460px] lg:max-h-none lg:h-full rounded-2xl bg-[#0e1220]/90 border border-white/[0.08] overflow-hidden">
            {/* Tab Navigation */}
            <div className="grid grid-cols-3 p-1.5 bg-[#090b14] border-b border-white/[0.06] gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('morphs')}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'morphs'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Probar y modificar los 52 blendshapes"
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Expresiones</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tuning')}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'tuning'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Calibración y alineación 3D"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Ajustes</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`py-2 px-1 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                  activeTab === 'export'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                title="Descargar GLB o guardar en XStreamX"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar</span>
              </button>
            </div>

            {/* Tab 1: ARKit Blendshapes Live Testing */}
            {activeTab === 'morphs' && (
              <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto gap-3">
                <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                  <div>
                    <span className="text-xs font-bold text-neutral-200">52 Blendshapes ARKit</span>
                    <p className="text-[10px] text-neutral-400">Mueve los controles para probar las expresiones faciales en tiempo real</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetBlendshapes}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                {/* Live Webcam Mirror Control Card */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/30 flex items-center justify-between gap-3 shadow-lg shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                        isLiveTracking
                          ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40'
                          : 'bg-cyan-500/20 text-cyan-400'
                      }`}
                    >
                      {isLiveTracking ? <Video className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Espejo Webcam en Vivo</span>
                        {isLiveTracking && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] font-black uppercase tracking-wider animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                            EN VIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        {isLiveTracking
                          ? 'Modificando 52 blendshapes en vivo con tu cámara'
                          : 'Anima el modelo en tiempo real con tu rostro'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={isLiveTracking ? stopLiveWebcamTracking : startLiveWebcamTracking}
                    disabled={!hasGeneratedModel}
                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md ${
                      !hasGeneratedModel
                        ? 'opacity-40 cursor-not-allowed bg-neutral-800 text-neutral-500'
                        : isLiveTracking
                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30'
                    }`}
                  >
                    {isLiveTracking ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    {isLiveTracking ? 'Detener' : 'Activar Webcam'}
                  </button>
                </div>

                {/* Speech Animation Preview Card (Divides from lower lip, closes with upper lip) */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-cyan-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-lg shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
                        isSimulatingSpeech
                          ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/40 animate-pulse'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {isSimulatingSpeech ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Efecto Habla (Labio Inferior)</span>
                        {isSimulatingSpeech && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-black uppercase tracking-wider animate-pulse">
                            HABLANDO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-neutral-400">
                        {isSimulatingSpeech
                          ? 'Mouth dividiéndose desde labio inferior y cerrando con el superior'
                          : 'Simula cadencia de habla para verificar separación y cierre'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={toggleSpeechSimulation}
                    disabled={!hasGeneratedModel || isLiveTracking}
                    className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md ${
                      !hasGeneratedModel || isLiveTracking
                        ? 'opacity-40 cursor-not-allowed bg-neutral-800 text-neutral-500'
                        : isSimulatingSpeech
                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                    }`}
                  >
                    {isSimulatingSpeech ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    {isSimulatingSpeech ? 'Detener Habla' : 'Probar Habla'}
                  </button>
                </div>

                {/* Quick Gestures Testing Strip */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-amber-950/40 border border-amber-500/30 shadow-lg shrink-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ScanFace className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-200">Prueba Rápida de Gestos</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTestQuickGesture('neutral')}
                      disabled={!hasGeneratedModel}
                      className="text-[10px] text-amber-300 hover:text-white underline cursor-pointer"
                    >
                      Reset Neutral
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTestQuickGesture('smile')}
                      disabled={!hasGeneratedModel}
                      className="py-1.5 px-1 rounded-lg bg-black/40 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-bold text-neutral-200 hover:text-amber-200 transition text-center cursor-pointer disabled:opacity-40"
                    >
                      😊 Sonrisa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestQuickGesture('surprise')}
                      disabled={!hasGeneratedModel}
                      className="py-1.5 px-1 rounded-lg bg-black/40 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-bold text-neutral-200 hover:text-amber-200 transition text-center cursor-pointer disabled:opacity-40"
                    >
                      😲 Sorpresa
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestQuickGesture('wink')}
                      disabled={!hasGeneratedModel}
                      className="py-1.5 px-1 rounded-lg bg-black/40 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-bold text-neutral-200 hover:text-amber-200 transition text-center cursor-pointer disabled:opacity-40"
                    >
                      😉 Guiño
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestQuickGesture('furrow')}
                      disabled={!hasGeneratedModel}
                      className="py-1.5 px-1 rounded-lg bg-black/40 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-bold text-neutral-200 hover:text-amber-200 transition text-center cursor-pointer disabled:opacity-40"
                    >
                      😠 Ceño
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestQuickGesture('pucker')}
                      disabled={!hasGeneratedModel}
                      className="py-1.5 px-1 rounded-lg bg-black/40 hover:bg-amber-500/20 border border-amber-500/20 text-[10px] font-bold text-neutral-200 hover:text-amber-200 transition text-center cursor-pointer disabled:opacity-40"
                    >
                      😗 Pucker
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestQuickGesture('neutral')}
                      disabled={!hasGeneratedModel}
                      className="py-1.5 px-1 rounded-lg bg-black/40 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-neutral-400 hover:text-white transition text-center cursor-pointer disabled:opacity-40"
                    >
                      😐 Neutral
                    </button>
                  </div>
                </div>

                {!hasGeneratedModel ? (
                  <div className="py-12 text-center text-xs text-neutral-500">
                    Genera el modelo 3D primero para probar los morph targets.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ARKIT_BLENDSHAPE_NAMES.map((name) => {
                      const val = testBlendshapes[name] || 0;
                      return (
                        <div key={name} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-neutral-300 font-semibold">{name}</span>
                            <span className="font-mono text-cyan-400 font-bold">{(val * 100).toFixed(0)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={val}
                            onChange={(e) => handleBlendshapeChange(name, parseFloat(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-neutral-800 rounded-lg"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Fine Tuning (Transforms & Alignment) */}
            {activeTab === 'tuning' && (
              <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto gap-3.5">
                <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                  <div>
                    <span className="text-xs font-bold text-neutral-200">Ajuste y Calibración 3D</span>
                    <p className="text-[10px] text-neutral-400">Alinea milimétricamente la malla sobre el cráneo base.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyDebugParams}
                      className="text-[11px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {isCopied ? 'Copiado' : 'Copiar JSON'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetTransforms}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      title="Restablecer todos los ajustes a los valores por defecto"
                    >
                      Reset Todo
                    </button>
                  </div>
                </div>

                {/* Sub-selector: Malla Facial, Boca y Labios, Ojos 3D, Base de Cabeza, Gestos y Tracking */}
                <div className="grid grid-cols-5 gap-1 p-1 bg-black/40 rounded-xl border border-white/[0.08] shrink-0">
                  <button
                    type="button"
                    onClick={() => setTuningTarget('face')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      tuningTarget === 'face'
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Smile className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Cara</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTuningTarget('mouth')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      tuningTarget === 'mouth'
                        ? 'bg-rose-500 text-white shadow-md font-black'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Boca</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTuningTarget('eyes')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      tuningTarget === 'eyes'
                        ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Ojos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTuningTarget('head')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      tuningTarget === 'head'
                        ? 'bg-indigo-500 text-white shadow-md font-black'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Cabeza</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTuningTarget('gestures')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                      tuningTarget === 'gestures'
                        ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <ScanFace className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Gestos</span>
                  </button>
                </div>

                {/* --- 1. Malla Facial (Exclusivo) --- */}
                {tuningTarget === 'face' && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-[11px] text-cyan-300 flex items-center justify-between">
                      <span>Estos controles afectan <strong>únicamente a la máscara facial</strong>.</span>
                      <button
                        type="button"
                        onClick={handleResetFaceTransforms}
                        className="text-[10px] text-cyan-400 underline hover:text-cyan-200 cursor-pointer"
                      >
                        Reset Malla
                      </button>
                    </div>

                    {/* Tamaño y Escala */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider block">
                        Tamaño y Escala de la Malla
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Tamaño General (Uniforme)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.01"
                              value={debugParams.face.scaleUniform ?? 1.0}
                              onChange={(e) => handleDebugParamChange('face', 'scaleUniform', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {(debugParams.face.scaleUniform ?? 1.0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Ancho Malla (X)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.01"
                              value={debugParams.face.scaleX}
                              onChange={(e) => handleDebugParamChange('face', 'scaleX', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.scaleX.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Alto Malla (Y)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.01"
                              value={debugParams.face.scaleY}
                              onChange={(e) => handleDebugParamChange('face', 'scaleY', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.scaleY.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Profundidad / Grosor (Z)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.3"
                              max="2.5"
                              step="0.01"
                              value={debugParams.face.scaleZ}
                              onChange={(e) => handleDebugParamChange('face', 'scaleZ', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.scaleZ.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ubicación y Desplazamiento */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider block">
                        Ubicación de la Malla (Posición)
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Horizontal X (Izq / Der)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.005"
                              value={debugParams.face.posOffsetX}
                              onChange={(e) => handleDebugParamChange('face', 'posOffsetX', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.posOffsetX.toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Vertical Y (Arriba / Abajo)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.005"
                              value={debugParams.face.posOffsetY}
                              onChange={(e) => handleDebugParamChange('face', 'posOffsetY', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.posOffsetY.toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Profundidad Z (Delante / Atrás)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.005"
                              value={debugParams.face.posOffsetZ}
                              onChange={(e) => handleDebugParamChange('face', 'posOffsetZ', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.posOffsetZ.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Inclinación y Rotación */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider block">
                        Rotación y Ángulo de la Malla
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Pitch X (Inclinación vertical)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={debugParams.face.rotationX}
                              onChange={(e) => handleDebugParamChange('face', 'rotationX', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.rotationX}°
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Yaw Y (Giro horizontal)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={debugParams.face.rotationY}
                              onChange={(e) => handleDebugParamChange('face', 'rotationY', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.rotationY}°
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Roll Z (Inclinación lateral)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={debugParams.face.rotationZ}
                              onChange={(e) => handleDebugParamChange('face', 'rotationZ', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-cyan-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-cyan-300 font-bold">
                              {debugParams.face.rotationZ}°
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- 2. Boca y Labios (Calibración Anatómica) --- */}
                {tuningTarget === 'mouth' && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-[11px] text-rose-300 flex items-center justify-between">
                      <span>Calibración anatómica de <strong>profundidad oral y labios</strong>.</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleRebakeMouthMesh}
                          className="text-[10px] text-rose-300 font-bold bg-rose-500/20 hover:bg-rose-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition"
                          title="Re-calcular geometría facial con estos parámetros de boca"
                        >
                          <Wand2 className="w-3 h-3" />
                          Re-aplicar a Malla
                        </button>
                        <button
                          type="button"
                          onClick={handleResetMouthParams}
                          className="text-[10px] text-rose-400 underline hover:text-rose-200 cursor-pointer"
                        >
                          Reset Boca
                        </button>
                      </div>
                    </div>

                    {/* Controles de Forma Bucal y Labios */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider block">
                        Forma Bucal y Profundidad
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Profundidad Oral (Hundimiento)</span>
                            <span className="text-[9px] text-neutral-500">Hunde los labios en Z para crear cavidad</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="0.35"
                              step="0.005"
                              value={debugParams.mouth?.mouthDepthPush ?? 0.12}
                              onChange={(e) => handleDebugParamChange('mouth', 'mouthDepthPush', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-rose-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-rose-300 font-bold">
                              {(debugParams.mouth?.mouthDepthPush ?? 0.12).toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Grosor de Labios</span>
                            <span className="text-[9px] text-neutral-500">Escala el volumen tridimensional</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.02"
                              value={debugParams.mouth?.lipThickness ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'lipThickness', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-rose-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-rose-300 font-bold">
                              {(debugParams.mouth?.lipThickness ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Posición Vertical (Y)</span>
                            <span className="text-[9px] text-neutral-500">Alineación de altura de los labios</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.2"
                              max="0.2"
                              step="0.005"
                              value={debugParams.mouth?.mouthOffsetY ?? 0.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'mouthOffsetY', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-rose-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-rose-300 font-bold">
                              {(debugParams.mouth?.mouthOffsetY ?? 0.0).toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Curvatura de Comisuras</span>
                            <span className="text-[9px] text-neutral-500">Eleva las comisuras para evitar gesto caído</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.1"
                              max="0.15"
                              step="0.005"
                              value={debugParams.mouth?.smileOffset ?? 0.02}
                              onChange={(e) => handleDebugParamChange('mouth', 'smileOffset', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-rose-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-rose-300 font-bold">
                              {(debugParams.mouth?.smileOffset ?? 0.02).toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Controles Dinámicos y Cavidad Oral */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-rose-400 uppercase tracking-wider block">
                        Apertura y Cavidad Oral 3D
                      </span>

                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Amplitud de Mandíbula</span>
                            <span className="text-[9px] text-neutral-500">Multiplicador de apertura al hablar</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="1.8"
                              step="0.05"
                              value={debugParams.mouth?.jawOpenScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'jawOpenScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-rose-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-rose-300 font-bold">
                              {(debugParams.mouth?.jawOpenScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                          <div>
                            <span className="text-xs font-bold text-neutral-200 block">Cavidad Oral y Dientes 3D</span>
                            <span className="text-[10px] text-neutral-400">
                              Cámara oscura anatómica con arcadas dentales detrás de los labios
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={debugParams.mouth?.oralCavityEnabled ?? true}
                            onChange={(e) => handleDebugParamChange('mouth', 'oralCavityEnabled', e.target.checked)}
                            className="w-4 h-4 accent-rose-400 rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- 3. Ojos 3D y Tracking de Mirada --- */}
                {tuningTarget === 'eyes' && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between">
                      <span>Ojos 3D biomiméticos con <strong>seguimiento ocular por webcam</strong>.</span>
                      <button
                        type="button"
                        onClick={handleResetEyeParams}
                        className="text-[10px] text-emerald-400 underline hover:text-emerald-200 cursor-pointer"
                      >
                        Reset Ojos
                      </button>
                    </div>

                    {/* Activación & Tracking */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-neutral-200 block">Activar Ojos 3D</span>
                          <span className="text-[10px] text-neutral-400">Esclera realista, iris procedural y córnea reflectiva</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={debugParams.eyes?.enabled ?? true}
                          onChange={(e) => handleDebugParamChange('eyes', 'enabled', e.target.checked)}
                          className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.04]">
                        <div>
                          <span className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                            Seguimiento con Cámara Web
                            {isLiveTracking && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                            )}
                          </span>
                          <span className="text-[10px] text-neutral-400">Los ojos 3D giran en tiempo real siguiendo tus pupilas</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={debugParams.eyes?.gazeTracking ?? true}
                          onChange={(e) => handleDebugParamChange('eyes', 'gazeTracking', e.target.checked)}
                          className="w-4 h-4 accent-emerald-400 rounded cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Tamaño y Ubicación en Cuencas */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">
                        Tamaño y Ubicación en Cuencas
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Tamaño / Escala</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.6"
                              max="1.6"
                              step="0.02"
                              value={debugParams.eyes?.scale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('eyes', 'scale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-emerald-300 font-bold">
                              {(debugParams.eyes?.scale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Separación Interpupilar (X)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.1"
                              max="0.1"
                              step="0.005"
                              value={debugParams.eyes?.spacingX ?? 0.0}
                              onChange={(e) => handleDebugParamChange('eyes', 'spacingX', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-emerald-300 font-bold">
                              {(debugParams.eyes?.spacingX ?? 0.0).toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Altura en Cuenca (Y)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.1"
                              max="0.1"
                              step="0.005"
                              value={debugParams.eyes?.offsetY ?? 0.0}
                              onChange={(e) => handleDebugParamChange('eyes', 'offsetY', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-emerald-300 font-bold">
                              {(debugParams.eyes?.offsetY ?? 0.0).toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Profundidad en Cuenca (Z)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.15"
                              max="0.15"
                              step="0.005"
                              value={debugParams.eyes?.offsetZ ?? 0.0}
                              onChange={(e) => handleDebugParamChange('eyes', 'offsetZ', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-emerald-300 font-bold">
                              {(debugParams.eyes?.offsetZ ?? 0.0).toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.04]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Tamaño de Pupila</span>
                            <span className="text-[9px] text-neutral-500">Diámetro de la pupila negra</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.18"
                              max="0.55"
                              step="0.01"
                              value={debugParams.eyes?.pupilSize ?? 0.32}
                              onChange={(e) => handleDebugParamChange('eyes', 'pupilSize', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-emerald-300 font-bold">
                              {Math.round(((debugParams.eyes?.pupilSize ?? 0.32) / 0.32) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Color del Iris y Presets */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">
                          Color del Iris
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={debugParams.eyes?.irisColor ?? '#00e5ff'}
                            onChange={(e) => handleDebugParamChange('eyes', 'irisColor', e.target.value)}
                            className="w-6 h-6 rounded-md border-0 cursor-pointer bg-transparent"
                          />
                          <span className="font-mono text-[10px] text-emerald-300 uppercase">
                            {debugParams.eyes?.irisColor ?? '#00e5ff'}
                          </span>
                        </div>
                      </div>

                      {/* Presets de Color */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {IRIS_COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.color}
                            type="button"
                            onClick={() => handleDebugParamChange('eyes', 'irisColor', preset.color)}
                            className={`p-1.5 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer ${
                              (debugParams.eyes?.irisColor ?? '#00e5ff').toLowerCase() === preset.color.toLowerCase()
                                ? 'border-emerald-400 bg-emerald-950/40 text-emerald-300'
                                : 'border-white/[0.06] bg-black/30 text-neutral-400 hover:border-white/20'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                              style={{ backgroundColor: preset.color }}
                            />
                            <span className="text-[9px] font-bold truncate">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color de la Pupila y Presets */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">
                            Color de la Pupila
                          </span>
                          <span className="text-[9px] text-neutral-500">Tono del centro pupilar 3D</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={debugParams.eyes?.pupilColor ?? '#000000'}
                            onChange={(e) => handleDebugParamChange('eyes', 'pupilColor', e.target.value)}
                            className="w-6 h-6 rounded-md border-0 cursor-pointer bg-transparent"
                          />
                          <span className="font-mono text-[10px] text-emerald-300 uppercase">
                            {debugParams.eyes?.pupilColor ?? '#000000'}
                          </span>
                        </div>
                      </div>

                      {/* Presets de Color de Pupila */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {PUPIL_COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.color}
                            type="button"
                            onClick={() => handleDebugParamChange('eyes', 'pupilColor', preset.color)}
                            className={`p-1.5 rounded-lg border text-left transition flex items-center gap-1.5 cursor-pointer ${
                              (debugParams.eyes?.pupilColor ?? '#000000').toLowerCase() === preset.color.toLowerCase()
                                ? 'border-emerald-400 bg-emerald-950/40 text-emerald-300'
                                : 'border-white/[0.06] bg-black/30 text-neutral-400 hover:border-white/20'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20"
                              style={{ backgroundColor: preset.color }}
                            />
                            <span className="text-[9px] font-bold truncate">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Prueba Manual de Mirada */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">
                          Prueba Manual de Mirada
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleDebugParamChange('eyes', 'manualGazeX', 0);
                            handleDebugParamChange('eyes', 'manualGazeY', 0);
                          }}
                          className="text-[10px] text-emerald-400 underline hover:text-emerald-200 cursor-pointer"
                        >
                          Centrar Mirada
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400">Horizontal X (Izq / Der)</span>
                          <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.05"
                            value={debugParams.eyes?.manualGazeX ?? 0}
                            onChange={(e) => handleDebugParamChange('eyes', 'manualGazeX', parseFloat(e.target.value))}
                            className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-400">Vertical Y (Arriba / Abajo)</span>
                          <input
                            type="range"
                            min="-1"
                            max="1"
                            step="0.05"
                            value={debugParams.eyes?.manualGazeY ?? 0}
                            onChange={(e) => handleDebugParamChange('eyes', 'manualGazeY', parseFloat(e.target.value))}
                            className="w-24 sm:w-32 accent-emerald-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- 4. Base de Cabeza --- */}
                {tuningTarget === 'head' && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center justify-between">
                      <span>Estos controles calibran el <strong>cráneo y contorno posterior</strong>.</span>
                      <button
                        type="button"
                        onClick={handleResetHeadTransforms}
                        className="text-[10px] text-indigo-400 underline hover:text-indigo-200 cursor-pointer"
                      >
                        Reset Cabeza
                      </button>
                    </div>

                    {/* Escala Cabeza */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-indigo-300 uppercase tracking-wider block">
                        Escala de Base de Cabeza
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Escala Ancho X</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.2"
                              step="0.02"
                              value={debugParams.head.scaleMultiplierX}
                              onChange={(e) => handleDebugParamChange('head', 'scaleMultiplierX', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.scaleMultiplierX.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Escala Alto Y</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.2"
                              step="0.02"
                              value={debugParams.head.scaleMultiplierY}
                              onChange={(e) => handleDebugParamChange('head', 'scaleMultiplierY', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.scaleMultiplierY.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Profundidad Z</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.2"
                              step="0.02"
                              value={debugParams.head.scaleMultiplierZ}
                              onChange={(e) => handleDebugParamChange('head', 'scaleMultiplierZ', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.scaleMultiplierZ.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Push Back (Atrás)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.0"
                              max="1.0"
                              step="0.02"
                              value={debugParams.head.pushBackFactor}
                              onChange={(e) => handleDebugParamChange('head', 'pushBackFactor', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.pushBackFactor.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ubicación Cabeza */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-indigo-300 uppercase tracking-wider block">
                        Ubicación de la Cabeza
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Horizontal X</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.005"
                              value={debugParams.head.posOffsetX}
                              onChange={(e) => handleDebugParamChange('head', 'posOffsetX', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.posOffsetX.toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Vertical Y</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.005"
                              value={debugParams.head.posOffsetY}
                              onChange={(e) => handleDebugParamChange('head', 'posOffsetY', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.posOffsetY.toFixed(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Profundidad Z</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.5"
                              max="0.5"
                              step="0.005"
                              value={debugParams.head.posOffsetZ}
                              onChange={(e) => handleDebugParamChange('head', 'posOffsetZ', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.posOffsetZ.toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rotación Cabeza */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-indigo-300 uppercase tracking-wider block">
                        Rotación de la Cabeza
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Inclinación Pitch X</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={debugParams.head.rotationX}
                              onChange={(e) => handleDebugParamChange('head', 'rotationX', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.rotationX}°
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Giro Yaw Y</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={debugParams.head.rotationY}
                              onChange={(e) => handleDebugParamChange('head', 'rotationY', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.rotationY}°
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-neutral-300">Inclinación Roll Z</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-45"
                              max="45"
                              step="1"
                              value={debugParams.head.rotationZ}
                              onChange={(e) => handleDebugParamChange('head', 'rotationZ', parseFloat(e.target.value))}
                              className="w-28 sm:w-36 accent-indigo-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-indigo-300 font-bold">
                              {debugParams.head.rotationZ}°
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* --- 5. Calibración de Gestos y Tracking Multi-Punto --- */}
                {tuningTarget === 'gestures' && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200 flex items-center justify-between">
                      <div>
                        <span className="font-bold block">Calibración de Gestos Multi-Punto</span>
                        <span className="text-[10px] text-neutral-400">
                          Ajusta la respuesta y amplitud para el modo <strong>Reconocimiento de Gestos</strong>.
                        </span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleRebakeGestureMesh}
                          className="text-[10px] text-amber-950 font-black bg-amber-400 hover:bg-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-md shadow-amber-400/20"
                          title="Re-calcular los 52 morph targets con estos parámetros de gestos"
                        >
                          <Wand2 className="w-3 h-3" />
                          Re-calcular Malla
                        </button>
                        <button
                          type="button"
                          onClick={handleResetGestureParams}
                          className="text-[10px] text-amber-400 underline hover:text-amber-200 cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    {/* Grupo 1: Cejas y Frente (Multi-Punto) */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block">
                        Cejas y Frente (Arco Multi-Punto)
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Elevación de Cejas</span>
                            <span className="text-[9px] text-neutral-500">Amplitud de arco frontal (browInnerUp, outer)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.5"
                              step="0.05"
                              value={debugParams.mouth?.browRaiseScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'browRaiseScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.browRaiseScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Fruncido / Ceño</span>
                            <span className="text-[9px] text-neutral-500">Tensión hacia glabella (browDown)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.5"
                              step="0.05"
                              value={debugParams.mouth?.browFurrowScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'browFurrowScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.browFurrowScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Altura Base de Cejas (Y)</span>
                            <span className="text-[9px] text-neutral-500">Desplazamiento vertical del arco natural</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="-0.15"
                              max="0.15"
                              step="0.005"
                              value={debugParams.mouth?.browOffsetY ?? 0.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'browOffsetY', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.browOffsetY ?? 0.0).toFixed(3)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grupo 2: Ojos y Párpados */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block">
                        Ojos y Párpados (Contorno Completo)
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Cierre de Párpados (Blink)</span>
                            <span className="text-[9px] text-neutral-500">Amplitud de parpadeo superior/inferior</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={debugParams.mouth?.eyeBlinkScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'eyeBlinkScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.eyeBlinkScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Sorpresa / Apertura (Wide)</span>
                            <span className="text-[9px] text-neutral-500">Expansión palpebral al abrir los ojos</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={debugParams.mouth?.eyeWideScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'eyeWideScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.eyeWideScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Entrecerrar / Squint</span>
                            <span className="text-[9px] text-neutral-500">Elevación de párpado inferior y mejilla</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={debugParams.mouth?.eyeSquintScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'eyeSquintScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.eyeSquintScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grupo 3: Mejillas y Sonrisa */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block">
                        Mejillas, Sonrisa y Gestos Cigomáticos
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Amplitud de Sonrisa</span>
                            <span className="text-[9px] text-neutral-500">Elevación bilateral y extensión de comisuras</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.5"
                              step="0.05"
                              value={debugParams.mouth?.smileScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'smileScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.smileScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Tristeza / Descenso (Frown)</span>
                            <span className="text-[9px] text-neutral-500">Tracción hacia abajo de comisuras</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.5"
                              step="0.05"
                              value={debugParams.mouth?.frownScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'frownScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.frownScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Inflado de Mejillas (Cheek Puff)</span>
                            <span className="text-[9px] text-neutral-500">Volumen expansivo en Z y X</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.5"
                              step="0.05"
                              value={debugParams.mouth?.cheekPuffScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'cheekPuffScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.cheekPuffScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Beso / Fruncido (Pucker)</span>
                            <span className="text-[9px] text-neutral-500">Compresión radial y proyección frontal</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.5"
                              step="0.05"
                              value={debugParams.mouth?.puckerScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'puckerScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.puckerScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grupo 4: Mandíbula y Labios */}
                    <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5">
                      <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block">
                        Mandíbula y Cinemática Labial
                      </span>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Apertura Mandibular (Jaw Open)</span>
                            <span className="text-[9px] text-neutral-500">Multiplicador de apertura de quijada</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={debugParams.mouth?.jawOpenScale ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'jawOpenScale', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.jawOpenScale ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-neutral-300 block font-medium">Separación Labio Inferior</span>
                            <span className="text-[9px] text-neutral-500">Fuerza de división hacia abajo al hablar o abrir la boca</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0.5"
                              max="2.0"
                              step="0.05"
                              value={debugParams.mouth?.lipSeparationRatio ?? 1.0}
                              onChange={(e) => handleDebugParamChange('mouth', 'lipSeparationRatio', parseFloat(e.target.value))}
                              className="w-24 sm:w-32 accent-amber-400 cursor-pointer"
                            />
                            <span className="w-10 text-right font-mono text-[10px] text-amber-300 font-bold">
                              {(debugParams.mouth?.lipSeparationRatio ?? 1.0).toFixed(2)}x
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Export & Add to XStreamX */}
            {activeTab === 'export' && (
              <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto gap-4">
                <div>
                  <span className="text-xs font-bold text-neutral-200">Exportar y Publicar Avatar 3D</span>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Guarda el modelo directamente en el ecosistema XStreamX o descárgalo como archivo .GLB universal con 52 morph targets.
                  </p>
                </div>

                {saveSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                )}

                {/* Avatar Metadata Configuration */}
                <div className="space-y-3 p-3.5 rounded-2xl bg-black/40 border border-white/[0.06]">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      Nombre del Avatar 3D
                    </label>
                    <input
                      type="text"
                      value={exportAvatarName}
                      onChange={(e) => setExportAvatarName(e.target.value)}
                      placeholder="Ej: Mi Avatar Face 3D"
                      className="w-full px-3 py-2 bg-[#090b14] border border-white/[0.1] focus:border-cyan-400 rounded-xl text-neutral-100 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      Color de Acento
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={exportThemeColor}
                        onChange={(e) => setExportThemeColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-white/20 bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-xs text-neutral-400">{exportThemeColor}</span>
                    </div>
                  </div>
                </div>

                {/* Direct Save into App */}
                <button
                  type="button"
                  disabled={!hasGeneratedModel || isSavingAvatar}
                  onClick={handleSaveToXStreamX}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSavingAvatar ? (
                    <>
                      <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>GUARDANDO EN XSTREAMX...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>GUARDAR COMO AVATAR EN XSTREAMX</span>
                    </>
                  )}
                </button>

                {/* Download Universal GLB */}
                <button
                  type="button"
                  disabled={!hasGeneratedModel || isExporting}
                  onClick={handleExportGLB}
                  className="w-full py-3 px-4 rounded-xl bg-[#151928] hover:bg-[#1f253d] text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 text-xs font-bold tracking-wide flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>GENERANDO ARCHIVO GLB...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>DESCARGAR ARCHIVO .GLB</span>
                    </>
                  )}
                </button>

                <div className="p-3 rounded-xl bg-cyan-950/[0.2] border border-cyan-500/20 text-[10px] text-cyan-200/80 leading-relaxed">
                  💡 <strong>Compatibilidad GLB:</strong> El archivo exportado incluye la malla facial 3D, textura UV embebida de 1024x1024 y los 52 morph targets ARKit, listo para usar en Blender, Unreal Engine, Unity o Three.js.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
