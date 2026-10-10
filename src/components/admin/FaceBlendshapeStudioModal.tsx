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
} from 'lucide-react';
import {
  faceToBlendshapeServiceSingleton,
  Face3DGenerationResult,
  TransformDebugParams,
  DEFAULT_DEBUG_PARAMS,
} from '../../services/face3d/faceToBlendshapeService';
import { ARKIT_BLENDSHAPE_NAMES, ARKitBlendshapeName } from '../../services/face3d/arkitMapper';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';

interface FaceBlendshapeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onSelectAvatar?: (avatarId: string) => void;
}

export const FaceBlendshapeStudioModal: React.FC<FaceBlendshapeStudioModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
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
  const currentResultRef = useRef<Face3DGenerationResult | null>(null);

  // Display toggles
  const [showWireframe, setShowWireframe] = useState(false);
  const [showHeadBase, setShowHeadBase] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Transform params
  const [debugParams, setDebugParams] = useState<TransformDebugParams>(DEFAULT_DEBUG_PARAMS);

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
      renderer.render(scene, camera);
    };
    animate();
  }, []);

  useEffect(() => {
    if (isOpen && isAdmin) {
      setTimeout(() => {
        initThreeScene();
      }, 100);
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      stopWebcam();
    };
  }, [isOpen, isAdmin, initThreeScene]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current || !cameraRef.current) return;
      const container = canvasRef.current.parentElement;
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      stopWebcam();
      setStatus('Foto capturada con éxito. Haz clic en "Generar Modelo 3D".', 'info');
    };
    img.src = dataUrl;
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
        const nameClean = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setExportAvatarName(nameClean.charAt(0).toUpperCase() + nameClean.slice(1));
        setStatus('Imagen cargada. Lista para procesar.', 'info');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Process image with MediaPipe Face Landmarker & Generate 3D Model
  const processImage = async () => {
    if (!selectedImageElement) {
      setStatus('Por favor sube o toma una foto primero.', 'error');
      return;
    }

    setIsProcessing(true);
    setStatus('Detectando 478 puntos faciales y blendshapes ARKit con MediaPipe...', 'info');

    try {
      const result = await faceToBlendshapeServiceSingleton.processFaceImage(selectedImageElement);
      currentResultRef.current = result;

      const scene = sceneRef.current;
      if (!scene) throw new Error('Scene not initialized');

      // Remove existing meshes
      const oldFace = scene.getObjectByName('faceMesh');
      if (oldFace) scene.remove(oldFace);
      const oldHead = scene.getObjectByName('headModel');
      if (oldHead) scene.remove(oldHead);

      faceMeshRef.current = result.faceMesh;
      headModelRef.current = result.headModel;

      scene.add(result.faceMesh);
      if (result.headModel) {
        result.headModel.visible = showHeadBase;
        scene.add(result.headModel);
      }

      // Apply transforms
      faceToBlendshapeServiceSingleton.applyTransforms(result.faceMesh, result.headModel, debugParams);

      // Initialize blendshapes map
      const initialBlendshapes: Record<string, number> = {};
      ARKIT_BLENDSHAPE_NAMES.forEach((name) => {
        initialBlendshapes[name] = result.blendshapes[name] || 0;
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
    if (!mesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;

    const idx = mesh.morphTargetDictionary[name];
    if (idx !== undefined) {
      mesh.morphTargetInfluences[idx] = value;
    }
  };

  // Reset Blendshapes
  const handleResetBlendshapes = () => {
    const mesh = faceMeshRef.current;
    const resetValues: Record<string, number> = {};
    ARKIT_BLENDSHAPE_NAMES.forEach((name) => {
      resetValues[name] = 0;
      if (mesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        const idx = mesh.morphTargetDictionary[name];
        if (idx !== undefined) mesh.morphTargetInfluences[idx] = 0;
      }
    });
    setTestBlendshapes(resetValues);
  };

  // Update Transforms
  const handleDebugParamChange = (category: 'head' | 'face', key: string, value: number) => {
    setDebugParams((prev) => {
      const updated = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      };

      if (faceMeshRef.current) {
        faceToBlendshapeServiceSingleton.applyTransforms(
          faceMeshRef.current,
          headModelRef.current,
          updated
        );
      }
      return updated;
    });
  };

  // Reset Transforms
  const handleResetTransforms = () => {
    setDebugParams(DEFAULT_DEBUG_PARAMS);
    if (faceMeshRef.current) {
      faceToBlendshapeServiceSingleton.applyTransforms(
        faceMeshRef.current,
        headModelRef.current,
        DEFAULT_DEBUG_PARAMS
      );
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
    setStatus('Exportando archivo GLB con 52 Morph Targets y textura embebida...', 'info');

    try {
      const buffer = await faceToBlendshapeServiceSingleton.exportGLB(
        faceMeshRef.current,
        headModelRef.current,
        showHeadBase
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
        showHeadBase
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

  if (!isOpen || !isAdmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-6xl h-[94vh] rounded-3xl bg-[#090b14] border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-[#0e1220] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                  Face to Blendshape 3D Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider">
                  ADMIN ONLY
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

        {/* Main Workspace Body: 3 Columns (Left: Input/Capture | Center: 3D Canvas | Right: Controls & Export) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 sm:p-4 overflow-hidden">
          {/* Left Panel: Upload & Image Source (Col 3) */}
          <div className="lg:col-span-3 flex flex-col gap-3 h-full overflow-y-auto pr-1">
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

          {/* Center Column: 3D Viewport (Col 5/6) */}
          <div className="lg:col-span-5 flex flex-col h-full rounded-2xl bg-[#05060b] border border-cyan-500/20 overflow-hidden relative">
            {/* Viewport Top Toolbar */}
            <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-1.5 bg-[#0e1220]/80 backdrop-blur-md p-1 rounded-xl border border-white/[0.08] pointer-events-auto shadow-lg">
                <button
                  type="button"
                  onClick={handleToggleWireframe}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    showWireframe ? 'bg-cyan-500 text-slate-950' : 'text-neutral-300 hover:bg-white/10'
                  }`}
                  title="Activar/Desactivar Malla Wireframe"
                >
                  <Box className="w-3.5 h-3.5" />
                  Wireframe
                </button>
                <button
                  type="button"
                  onClick={handleToggleHeadBase}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    showHeadBase ? 'bg-indigo-500 text-white' : 'text-neutral-300 hover:bg-white/10'
                  }`}
                  title="Mostrar/Ocultar Base de Cabeza 3D"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Base Cabeza
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetCamera}
                className="p-1.5 rounded-xl bg-[#0e1220]/80 backdrop-blur-md border border-white/[0.08] text-neutral-300 hover:text-cyan-300 hover:bg-white/10 pointer-events-auto transition cursor-pointer shadow-lg"
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
            </div>

            {/* Viewport Bottom Hint */}
            <div className="px-3 py-1.5 bg-[#090b14]/90 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-neutral-400">
              <span>Rotar: Click izq. + Arrastrar</span>
              <span>Zoom: Rueda scroll</span>
              <span>Mover: Click der. + Arrastrar</span>
            </div>
          </div>

          {/* Right Column: Controls, Blendshapes & Export (Col 4) */}
          <div className="lg:col-span-4 flex flex-col h-full rounded-2xl bg-[#0e1220]/90 border border-white/[0.08] overflow-hidden">
            {/* Tab Navigation */}
            <div className="grid grid-cols-3 p-1.5 bg-[#090b14] border-b border-white/[0.06] gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('morphs')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'morphs'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                Blendshapes
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tuning')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'tuning'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Ajustes 3D
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('export')}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'export'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
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
              <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-y-auto gap-4">
                <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                  <span className="text-xs font-bold text-neutral-200">Calibración de Cabeza y Rostro</span>
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
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Head Controls */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
                  <span className="text-[11px] font-black text-indigo-300 uppercase tracking-wider block">
                    Alineación Base de Cabeza
                  </span>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Escala X ({debugParams.head.scaleMultiplierX.toFixed(2)})</span>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={debugParams.head.scaleMultiplierX}
                        onChange={(e) => handleDebugParamChange('head', 'scaleMultiplierX', parseFloat(e.target.value))}
                        className="w-32 accent-indigo-400"
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Escala Y ({debugParams.head.scaleMultiplierY.toFixed(2)})</span>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={debugParams.head.scaleMultiplierY}
                        onChange={(e) => handleDebugParamChange('head', 'scaleMultiplierY', parseFloat(e.target.value))}
                        className="w-32 accent-indigo-400"
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Profundidad Z ({debugParams.head.scaleMultiplierZ.toFixed(2)})</span>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.05"
                        value={debugParams.head.scaleMultiplierZ}
                        onChange={(e) => handleDebugParamChange('head', 'scaleMultiplierZ', parseFloat(e.target.value))}
                        className="w-32 accent-indigo-400"
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Push Back ({debugParams.head.pushBackFactor.toFixed(2)})</span>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.02"
                        value={debugParams.head.pushBackFactor}
                        onChange={(e) => handleDebugParamChange('head', 'pushBackFactor', parseFloat(e.target.value))}
                        className="w-32 accent-indigo-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Face Controls */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
                  <span className="text-[11px] font-black text-cyan-300 uppercase tracking-wider block">
                    Alineación Malla Facial
                  </span>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Posición Y ({debugParams.face.posOffsetY.toFixed(2)})</span>
                      <input
                        type="range"
                        min="-0.5"
                        max="0.5"
                        step="0.02"
                        value={debugParams.face.posOffsetY}
                        onChange={(e) => handleDebugParamChange('face', 'posOffsetY', parseFloat(e.target.value))}
                        className="w-32 accent-cyan-400"
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Posición Z ({debugParams.face.posOffsetZ.toFixed(2)})</span>
                      <input
                        type="range"
                        min="-0.5"
                        max="0.5"
                        step="0.02"
                        value={debugParams.face.posOffsetZ}
                        onChange={(e) => handleDebugParamChange('face', 'posOffsetZ', parseFloat(e.target.value))}
                        className="w-32 accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
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
