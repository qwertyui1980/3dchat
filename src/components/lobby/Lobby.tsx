import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ArrowRight,
  Check,
  Dices,
  Sparkles,
  Sliders,
  RotateCcw,
  Clock,
  Camera,
  Eye,
  EyeOff,
  Radio,
  Upload,
  AlertCircle,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { AvatarId, FaceFeatures } from '../../types';
import { AVATAR_LIST } from '../avatars/avatarConfigs';
import { AvatarCanvas } from '../avatars/AvatarCanvas';
import { AudioWaveform } from '../common/AudioWaveform';
import { AuthenticatedUser } from '../auth/Login';
import { dbServiceSingleton, RoomRecord } from '../../services/dbService';
import { getAvatarTrackingProfile, transformAvatarLandmark } from '../avatars/avatarTrackingProfiles';
import { networkServiceSingleton } from '../../services/networkService';
import { LegalDisclaimerModal } from '../common/LegalDisclaimerModal';

interface LobbyProps {
  onJoinRoom: (config: {
    userName: string;
    roomId: string;
    avatarId: AvatarId;
    createAsAdmin: boolean;
  }) => void;
  localFeatures: FaceFeatures;
  isCameraActive: boolean;
  isMicActive: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  isModelReady: boolean;
  authUser?: AuthenticatedUser | null;
  landmarks?: Array<{ x: number; y: number; z: number }> | null;
  onRequestCamera?: () => void;
  cameraError?: string | null;
  availableCameras?: MediaDeviceInfo[];
  onSelectCamera?: (deviceId: string) => void;
  hasMicPermission: boolean;
  micError?: string | null;
  onRequestMic?: () => void;
}

// Random fun anonymous handles generator
const ANON_PREFIXES = [
  'Cyber',
  'Neo',
  'Quantum',
  'Glitch',
  'Solar',
  'Pixel',
  'Astro',
  'Vortex',
  'Nova',
  'Hyper',
  'Flux',
  'Matrix',
  'Apex',
  'Spark',
];

const ANON_SUFFIXES = [
  'Runner',
  'Fox',
  'Cat',
  'Neko',
  'Pilot',
  'Ghost',
  'Rider',
  'Ninja',
  'Samurai',
  'Knight',
  'Rover',
  'Specter',
  'Droid',
  'Cipher',
];

function generateRandomAlias(): string {
  const p = ANON_PREFIXES[Math.floor(Math.random() * ANON_PREFIXES.length)];
  const s = ANON_SUFFIXES[Math.floor(Math.random() * ANON_SUFFIXES.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${p}${s}_${num}`;
}

const STORAGE_AVATAR_KEY = 'xstreamx_selected_avatar';
const SINGLE_ROOM_ID = 'main';

export const Lobby: React.FC<LobbyProps> = ({
  onJoinRoom,
  localFeatures,
  isCameraActive,
  isMicActive,
  onToggleCamera,
  onToggleMic,
  isModelReady,
  authUser,
  landmarks,
  onRequestCamera,
  cameraError,
  availableCameras = [],
  onSelectCamera,
  hasMicPermission,
  micError,
  onRequestMic,
}) => {
  const isAdminUser = authUser?.role === 'admin';

  // Always generate a random alias unless signed in with X.com account
  const [userName, setUserName] = useState<string>(() => {
    if (authUser?.provider === 'x' && authUser.name) {
      return authUser.name;
    }
    return generateRandomAlias();
  });

  // Remember selected avatar from localStorage
  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_AVATAR_KEY) as AvatarId;
      if (saved && AVATAR_LIST.some((a) => a.id === saved)) {
        return saved;
      }
    }
    return 'three_robot';
  });

  const [error, setError] = useState<string | null>(null);
  const [showCameraPip, setShowCameraPip] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(true);
  const [isLegalOpen, setIsLegalOpen] = useState(false);

  // Calibration & Offset Controls
  const [cameraOffsetX, setCameraOffsetX] = useState(0);
  const [cameraOffsetY, setCameraOffsetY] = useState(0);
  const [trackingSensitivity, setTrackingSensitivity] = useState(1.0);

  // Single Room State & Real-time Active Status
  const [isRoomActive, setIsRoomActive] = useState<boolean>(true);
  const [activeRoomRecord, setActiveRoomRecord] = useState<RoomRecord | null>(null);
  const hasActiveAdminInRoom = !!activeRoomRecord?.hasActiveAdmin;
  const isAnotherAdminInRoom = isAdminUser && hasActiveAdminInRoom;
  const [isCheckingRoom, setIsCheckingRoom] = useState<boolean>(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState<boolean>(false);

  // Function to check whether the single room has been created by an admin
  const checkSingleRoomStatus = async () => {
    const isStaticDeploy =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:');

    if (isStaticDeploy) {
      setIsRoomActive(true);
      setActiveRoomRecord({
        id: SINGLE_ROOM_ID,
        name: 'Espacio Principal en Vivo',
        adminId: 'admin',
        isLocked: false,
        participantCount: 1,
        createdAt: Date.now(),
        lastActive: Date.now(),
      });
      setIsCheckingRoom(false);
      return;
    }

    try {
      // 1. Check server API status
      const serverStatus = await fetch('/api/room/status')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (serverStatus && serverStatus.isOpen && serverStatus.room) {
        setIsRoomActive(true);
        setActiveRoomRecord({
          id: serverStatus.room.id,
          name: serverStatus.room.name || 'Espacio Principal en Vivo',
          adminId: serverStatus.room.adminId || '',
          isLocked: !!serverStatus.room.isLocked,
          participantCount: serverStatus.room.userCount || 0,
          createdAt: Date.now(),
          lastActive: Date.now(),
          hasActiveAdmin: !!(serverStatus.hasActiveAdmin ?? serverStatus.room.hasActiveAdmin),
          activeAdminName: serverStatus.activeAdminName || serverStatus.room.activeAdminName || '',
        });
        setIsCheckingRoom(false);
        return;
      }

      // 2. Check Database / Storage
      const dbRoom = await dbServiceSingleton.getActiveRoom();
      if (dbRoom) {
        setIsRoomActive(true);
        setActiveRoomRecord(dbRoom);
      } else {
        setIsRoomActive(true);
        setActiveRoomRecord({
          id: SINGLE_ROOM_ID,
          name: 'Espacio Principal en Vivo',
          adminId: 'admin',
          isLocked: false,
          participantCount: 1,
          createdAt: Date.now(),
          lastActive: Date.now(),
        });
      }
    } catch (e) {
      setIsRoomActive(true);
    } finally {
      setIsCheckingRoom(false);
    }
  };

  useEffect(() => {
    const isStaticDeploy =
      typeof window !== 'undefined' &&
      (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:');

    checkSingleRoomStatus();

    // Listen to real-time socket events for room opening/closing
    networkServiceSingleton.onRoomStatusChanged = (status) => {
      if (status && status.isOpen) {
        setIsRoomActive(true);
        setActiveRoomRecord({
          id: status.room?.id || SINGLE_ROOM_ID,
          name: status.room?.name || 'Espacio Principal en Vivo',
          adminId: status.room?.adminId || '',
          isLocked: !!status.room?.isLocked,
          participantCount: status.room?.userCount || 0,
          createdAt: Date.now(),
          lastActive: Date.now(),
          hasActiveAdmin: !!(status.hasActiveAdmin ?? status.room?.hasActiveAdmin),
          activeAdminName: status.activeAdminName || status.room?.activeAdminName || '',
        });
      }
    };

    if (isStaticDeploy) return;

    // Polling interval every 3 seconds to ensure sync across different clients on server environments
    const interval = setInterval(() => {
      checkSingleRoomStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Handle avatar change & persist in localStorage
  const handleSelectAvatar = (id: AvatarId) => {
    setSelectedAvatarId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_AVATAR_KEY, id);
    }
  };

  // Canvas ref for real-time anatomical mesh visualization (100% private, zero video rendering)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time canvas overlay for facial landmark mesh tracking preview
  useEffect(() => {
    if (!showCameraPip || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Dark sleek biometric HUD background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, w, h);

    // Subtle HUD grid lines
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Grid
    for (let x = 20; x < w; x += 20) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 20; y < h; y += 20) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Subtle center crosshair
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 12, h / 2);
    ctx.lineTo(w / 2 + 12, h / 2);
    ctx.moveTo(w / 2, h / 2 - 12);
    ctx.lineTo(w / 2, h / 2 + 12);
    ctx.stroke();

    if (!landmarks || landmarks.length === 0 || !isCameraActive) {
      // Empty state HUD info
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        !isCameraActive ? 'Cámara pausada' : 'Buscando rostro...',
        w / 2,
        h / 2 + 25
      );
      return;
    }

    const profile = getAvatarTrackingProfile(selectedAvatarId);

    const getPt = (idx: number) => {
      const raw = landmarks[idx];
      if (!raw) return null;
      const t = transformAvatarLandmark(profile, idx, raw, landmarks);
      return {
        x: (1 - t.x) * w,
        y: t.y * h,
      };
    };

    const drawPath = (indices: number[], color: string, width = 1, isClosed = false) => {
      const validPoints: Array<{ x: number; y: number }> = [];
      for (const idx of indices) {
        const pt = getPt(idx);
        if (pt) validPoints.push(pt);
      }
      if (validPoints.length < 2) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(validPoints[0].x, validPoints[0].y);
      for (let i = 1; i < validPoints.length; i++) {
        ctx.lineTo(validPoints[i].x, validPoints[i].y);
      }
      if (isClosed) {
        ctx.closePath();
      }
      ctx.stroke();
    };

    // Draw anatomical contours with glowing vector style
    profile.contours.forEach((c) => {
      drawPath(c.indices, c.color || '#06b6d4', 1.0, c.isClosed || false);
    });

    // Draw active key landmark points (eyes, pupils, mouth, jaw)
    profile.activeIndices.forEach((idx) => {
      const pt = getPt(idx);
      if (!pt) return;
      ctx.fillStyle = profile.dotColor || '#38bdf8';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [landmarks, showCameraPip, isCameraActive, selectedAvatarId]);

  const selectedAvatar =
    AVATAR_LIST.find((a) => a.id === selectedAvatarId) || AVATAR_LIST[0];

  const handleGenerateRandomAnon = () => {
    setUserName(generateRandomAlias());
  };

  // Admin action to create/activate the single room
  const handleAdminCreateRoom = async () => {
    if (hasActiveAdminInRoom) {
      setError(
        `Ya hay un Administrador activo en la sala (${activeRoomRecord?.activeAdminName || 'Administrador'}). No puede haber más de un Admin al mismo tiempo en la sala.`
      );
      return;
    }
    setError(null);
    setIsCreatingRoom(true);
    try {
      const newRoom = await dbServiceSingleton.createOrActivateRoom(
        'Espacio Principal en Vivo',
        authUser?.username || 'admin'
      );
      setIsRoomActive(true);
      setActiveRoomRecord(newRoom);

      // Join room directly as admin
      onJoinRoom({
        userName: userName.trim() || 'Administrador',
        roomId: SINGLE_ROOM_ID,
        avatarId: selectedAvatarId,
        createAsAdmin: true,
      });
    } catch (err: any) {
      setError(err?.message || 'Error al crear el espacio.');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Join as regular participant (even if authenticated as admin)
  const handleJoinAsParticipant = () => {
    const trimmedName = userName.trim() || 'Participante';

    if (!hasMicPermission) {
      setError('No es posible ingresar al espacio sin conceder permisos de micrófono.');
      if (onRequestMic) onRequestMic();
      return;
    }

    setError(null);

    onJoinRoom({
      userName: trimmedName,
      roomId: SINGLE_ROOM_ID,
      avatarId: selectedAvatarId,
      createAsAdmin: false,
    });
  };

  // Participant or Admin submitting to enter room
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = userName.trim();

    if (!trimmedName) {
      setError('Por favor escribe tu nombre o alias para identificarte.');
      return;
    }

    if (!hasMicPermission) {
      setError('No es posible ingresar al espacio sin conceder permisos de micrófono.');
      if (onRequestMic) onRequestMic();
      return;
    }

    if (isAdminUser && hasActiveAdminInRoom) {
      setError(
        `Ya hay un Administrador activo en la sala (${activeRoomRecord?.activeAdminName || 'Administrador'}). No puede haber más de un Admin al mismo tiempo en la sala. Puedes ingresar como participante.`
      );
      return;
    }

    setError(null);

    onJoinRoom({
      userName: trimmedName,
      roomId: SINGLE_ROOM_ID,
      avatarId: selectedAvatarId,
      createAsAdmin: isAdminUser,
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[#070709] text-neutral-100 flex items-start sm:items-center justify-center p-3 sm:p-6 md:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center py-2">

        {/* Columna Izquierda: Espejo de Avatar en Vivo y Calibración de Cámara */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-md bg-[#0d0d12]/95 rounded-2xl border border-white/[0.08] p-5 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Espejo de Avatar en Vivo
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedAvatar.trackingProfile && (
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold border"
                    style={{
                      color: selectedAvatar.trackingProfile.dotColor,
                      borderColor: `${selectedAvatar.trackingProfile.color}55`,
                      backgroundColor: `${selectedAvatar.trackingProfile.color}15`,
                    }}
                    title={selectedAvatar.trackingProfile.description}
                  >
                    {selectedAvatar.trackingProfile.badge}
                  </span>
                )}
              </div>
            </div>

            {/* Avatar Canvas */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#040406] border border-white/[0.06] flex items-center justify-center shadow-inner">
              <AvatarCanvas
                avatarId={selectedAvatarId}
                features={{
                  ...localFeatures,
                  pitch: (localFeatures.pitch + cameraOffsetY) * trackingSensitivity,
                  yaw: (localFeatures.yaw + cameraOffsetX) * trackingSensitivity,
                }}
                isSpeaking={isMicActive && localFeatures.audioVolume > 0.08}
                cameraOffsetX={cameraOffsetX}
                cameraOffsetY={cameraOffsetY}
                className="w-full h-full"
              />

              {/* Real-time Anatomical Mesh Overlay (100% Private - Zero Camera Image Rendered) */}
              {showCameraPip && isCameraActive && (
                <div className="absolute bottom-3 right-3 w-40 h-32 bg-slate-950/95 rounded-xl overflow-hidden border border-cyan-500/50 shadow-2xl z-30 flex flex-col">
                  <div className="flex items-center justify-between px-2 py-1 bg-slate-900/90 border-b border-slate-800">
                    <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Mesh Anatómico
                    </span>
                  </div>
                  <div className="relative flex-1 w-full bg-slate-950">
                    <canvas
                      ref={canvasRef}
                      width={160}
                      height={108}
                      className="w-full h-full block"
                    />
                  </div>
                </div>
              )}

              {/* Status Indicator */}
              <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-mono text-cyan-300 flex items-center gap-1.5 border border-slate-800 z-20">
                <span
                  className={`w-2 h-2 rounded-full ${localFeatures.isFaceDetected
                      ? 'bg-emerald-400 animate-pulse'
                      : !isCameraActive
                        ? 'bg-cyan-400'
                        : 'bg-amber-400'
                    }`}
                />
                <span className="text-[11px]">
                  {localFeatures.isFaceDetected
                    ? 'Rostro Detectado (MediaPipe)'
                    : !isCameraActive
                      ? 'Modo Solo Voz (Lip-Sync Activo)'
                      : 'Buscando Rostro...'}
                </span>
              </div>

              {/* Adjustments quick toggle button */}
              <button
                type="button"
                onClick={() => setShowAdjustments(!showAdjustments)}
                className="absolute top-3 left-3 p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 backdrop-blur-sm transition z-20 cursor-pointer"
                title="Ajustar centrado y sensibilidad"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Slider Adjustments Drawer */}
            {showAdjustments && (
              <div className="mt-3 p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between text-slate-400 font-medium">
                  <span>Centrado y Calibración de Cámara</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCameraOffsetX(0);
                      setCameraOffsetY(0);
                      setTrackingSensitivity(1.0);
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Eje Horizontal (X)</span>
                    <span className="font-mono text-cyan-300">{cameraOffsetX.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.02"
                    value={cameraOffsetX}
                    onChange={(e) => setCameraOffsetX(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Eje Vertical (Y)</span>
                    <span className="font-mono text-cyan-300">{cameraOffsetY.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.02"
                    value={cameraOffsetY}
                    onChange={(e) => setCameraOffsetY(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Sensibilidad de Expresión</span>
                    <span className="font-mono text-cyan-300">{trackingSensitivity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={trackingSensitivity}
                    onChange={(e) => setTrackingSensitivity(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Hardware Controls & Device Selector */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${isMicActive
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-400 shadow-sm'
                      : 'bg-rose-950/60 hover:bg-rose-900 border-rose-800 text-rose-300'
                    }`}
                  title={isMicActive ? 'Silenciar Micrófono' : 'Activar Micrófono'}
                >
                  {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${isCameraActive
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-400 shadow-sm'
                      : 'bg-rose-950/60 hover:bg-rose-900 border-rose-800 text-rose-300'
                    }`}
                  title={isCameraActive ? 'Pausar Cámara' : 'Reanudar Cámara'}
                >
                  {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowCameraPip(!showCameraPip)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${showCameraPip
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                  title="Mesh Anatómico. Sin vídeo"
                >
                  {showCameraPip ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Audio visualizer */}
              <div className="flex items-center">
                <AudioWaveform
                  volume={localFeatures.audioVolume}
                  isMuted={!isMicActive}
                  width={90}
                  height={24}
                  color="#22d3ee"
                />
              </div>
            </div>

            {/* Camera Select Dropdown */}
            {availableCameras.length > 1 && onSelectCamera && (
              <div className="mt-3">
                <select
                  onChange={(e) => onSelectCamera(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
                >
                  {availableCameras.map((cam, idx) => (
                    <option key={cam.deviceId || idx} value={cam.deviceId}>
                      {cam.label || `Cámara ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Camera & Microphone Notices */}
            {!hasMicPermission && (
              <div className="mt-3 p-3.5 bg-rose-950/80 border border-rose-600 rounded-xl text-xs text-rose-200 flex flex-col gap-2 shadow-lg shadow-rose-950/50 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Permiso de micrófono no concedido</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  {micError || 'Es obligatorio conceder permisos de micrófono en tu navegador para poder ingresar y comunicarte en el espacio.'}
                </p>
                {onRequestMic && (
                  <button
                    type="button"
                    onClick={onRequestMic}
                    className="self-start px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Conceder Permiso de Micrófono</span>
                  </button>
                )}
              </div>
            )}

            {!isCameraActive && (
              <div className="mt-3 p-3 bg-sky-950/40 border border-sky-800/60 rounded-xl text-xs text-sky-200 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-bold text-sky-300">
                  <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Modo Solo Voz Activo</span>
                </div>
                <p className="text-[11px] text-sky-200/80 leading-relaxed">
                  Puedes ingresar y participar en el espacio sin cámara. La boca de tu avatar 3D se animará automáticamente en base a tu voz al hablar.
                </p>
                {onRequestCamera && (
                  <button
                    type="button"
                    onClick={onRequestCamera}
                    className="self-start mt-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold rounded text-[11px] transition cursor-pointer flex items-center gap-1"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Activar Cámara</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Selección de Avatar, Alias y Acceso al Espacio Único */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="bg-[#0d0d12]/95 rounded-2xl border border-white/[0.08] p-5 md:p-7 shadow-2xl space-y-5">

            {/* AVISO BLOQUEANTE: PERMISO DE MICRÓFONO REQUERIDO */}
            {!hasMicPermission && (
              <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-600 text-rose-200 text-xs space-y-2.5 shadow-xl shadow-rose-950/50 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>Micrófono obligatorio para ingresar al espacio</span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  {micError || 'No se han concedido permisos de micrófono. No es posible ingresar al espacio sin acceso a tu micrófono.'}
                </p>
                {onRequestMic && (
                  <button
                    type="button"
                    onClick={onRequestMic}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-2 shadow-lg shadow-rose-600/30"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Conceder Permiso de Micrófono</span>
                  </button>
                )}
              </div>
            )}

            {/* AVISO: REGLA DE ADMIN ÚNICO */}
            {isAnotherAdminInRoom && (
              <div className="p-4 rounded-xl bg-amber-950/70 border border-amber-500/70 text-amber-200 text-xs space-y-2.5 shadow-xl shadow-amber-950/40 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  <span>Ya hay un Administrador activo en la sala</span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Actualmente el administrador <strong className="text-amber-100 font-semibold">{activeRoomRecord?.activeAdminName || 'Administrador'}</strong> se encuentra en la sala. Por regla del sistema, <strong className="text-amber-100">no puede haber más de un Admin al mismo tiempo en la sala</strong>.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleJoinAsParticipant}
                    className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Users className="w-4 h-4" />
                    <span>Ingresar como Participante</span>
                  </button>
                  <span className="text-[11px] text-amber-300/70">(Participa sin rol de administrador)</span>
                </div>
              </div>
            )}

            {/* Direct Join / Create Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Paso 1: Selector de Avatar 3D */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-2 flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black flex items-center justify-center">1</span>
                  <span>Elige tu Avatar 3D</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {AVATAR_LIST.map((avatar) => {
                    const isSelected = avatar.id === selectedAvatarId;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => handleSelectAvatar(avatar.id)}
                        className={`relative p-2 rounded-xl border text-left flex flex-col items-center gap-1 transition cursor-pointer ${isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-400/40 shadow-md shadow-cyan-500/20 scale-[1.02]'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                      >
                        <div
                          className="w-10 h-10 rounded-lg border flex items-center justify-center text-xl shadow-inner shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${avatar.themeColor}22, ${avatar.accentColor}33)`,
                            borderColor: `${avatar.themeColor}55`,
                          }}
                        >
                          {avatar.emoji || '🎭'}
                        </div>
                        <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                          {avatar.name}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 flex items-center justify-center shadow">
                            <Check className="w-2.5 h-2.5 text-slate-950" />
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {/* Opción Futura: Subir Avatar Propio */}
                  <div
                    title="Próximamente: Podrás subir tu modelo o avatar personalizado"
                    className="relative p-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 text-left flex flex-col items-center justify-center gap-1 opacity-60 cursor-not-allowed select-none"
                  >
                    <div className="w-10 h-10 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 text-center leading-tight">
                      Subir Propio
                    </span>
                    <span className="text-[8px] font-mono text-cyan-400 px-1 py-0.2 bg-cyan-950/80 rounded border border-cyan-900">
                      Pronto
                    </span>
                  </div>
                </div>
              </div>

              {/* Paso 2: Nombre o Alias (Aleatorio por defecto salvo cuenta de X.com) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black flex items-center justify-center">2</span>
                    <span>Tu Nombre o Alias</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomAnon}
                    className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Aleatorio</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Escribe tu nombre o alias aquí..."
                  maxLength={24}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-semibold transition"
                />
              </div>

              {/* Error feedback */}
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Paso 3: Botón de Acción Directo */}
              {!hasMicPermission ? (
                <button
                  type="button"
                  onClick={onRequestMic}
                  className="w-full py-3.5 px-4 rounded-xl bg-rose-900/90 hover:bg-rose-800 text-rose-100 font-black tracking-wide text-xs sm:text-sm flex items-center justify-center gap-2 border border-rose-600 shadow-xl shadow-rose-950/60 transition cursor-pointer active:scale-[0.99]"
                >
                  <MicOff className="w-4 h-4 text-rose-300 animate-pulse shrink-0" />
                  <span>CONCEDER MICRÓFONO PARA PODER INGRESAR</span>
                </button>
              ) : isAnotherAdminInRoom ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleJoinAsParticipant}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black tracking-wide text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 transition active:scale-[0.99] cursor-pointer"
                  >
                    <Users className="w-4 h-4 fill-slate-950" />
                    <span>INGRESAR COMO PARTICIPANTE</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[11px] text-center text-amber-300/80">
                    La sala ya cuenta con un Admin activo. Ingresarás con rol de participante sin privilegios de administración.
                  </p>
                </div>
              ) : (
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-slate-950 font-black tracking-wide text-sm flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/30 transition active:scale-[0.99] cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>INGRESAR AL ESPACIO EN VIVO AHORA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
              {/* Legal & Origin Footer */}
              <div className="pt-2 text-center text-[10px] text-neutral-500 flex flex-col items-center gap-1">
                <span>
                  Software libre bajo total responsabilidad personal del usuario.
                </span>
                <div className="flex items-center gap-2 text-neutral-400">
                  <span>Origen: <strong className="text-neutral-300">XStreamX</strong></span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setIsLegalOpen(true)}
                    className="text-cyan-400/80 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Ver Licencia y Descargo Legal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

      </div>

      <LegalDisclaimerModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />
    </div>
  );
};
