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
  Link2,
  Share2,
  Copy,
  Sliders,
  RotateCcw,
  Clock,
  X,
  Camera,
  CameraOff,
  Eye,
  EyeOff,
  Database,
  Cloud,
  Key,
  Settings,
  Radio,
} from 'lucide-react';
import { AvatarId, FaceFeatures } from '../../types';
import { AVATAR_LIST } from '../avatars/avatarConfigs';
import { AvatarCanvas } from '../avatars/AvatarCanvas';
import { AudioWaveform } from '../common/AudioWaveform';
import { AuthenticatedUser } from '../auth/Login';
import { dbServiceSingleton, RoomRecord } from '../../services/dbService';
import { getAvatarTrackingProfile, transformAvatarLandmark } from '../avatars/avatarTrackingProfiles';
import { getSupabaseClient, setSupabaseAnonKey, SUPABASE_URL } from '../../services/supabaseClient';

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
  cameraStream?: MediaStream | null;
  landmarks?: Array<{ x: number; y: number; z: number }> | null;
  onRequestCamera?: () => void;
  cameraError?: string | null;
  availableCameras?: MediaDeviceInfo[];
  onSelectCamera?: (deviceId: string) => void;
}

// Random fun anonymous handles for quick generation
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

export const Lobby: React.FC<LobbyProps> = ({
  onJoinRoom,
  localFeatures,
  isCameraActive,
  isMicActive,
  onToggleCamera,
  onToggleMic,
  isModelReady,
  authUser,
  cameraStream,
  landmarks,
  onRequestCamera,
  cameraError,
  availableCameras = [],
  onSelectCamera,
}) => {
  // Read room query parameter if present
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('room');
      if (r && r.trim()) {
        return r.trim().toLowerCase();
      }
    }
    return 'alpha';
  });

  const [userName, setUserName] = useState<string>(() => {
    if (authUser?.name) return authUser.name;
    const p = ANON_PREFIXES[Math.floor(Math.random() * ANON_PREFIXES.length)];
    const s = ANON_SUFFIXES[Math.floor(Math.random() * ANON_SUFFIXES.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${p}${s}_${num}`;
  });

  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>('face_cap');
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showCameraPip, setShowCameraPip] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);

  // Calibration & Offset Controls
  const [cameraOffsetX, setCameraOffsetX] = useState(0);
  const [cameraOffsetY, setCameraOffsetY] = useState(0);
  const [trackingSensitivity, setTrackingSensitivity] = useState(1.0);

  // Active Single Room State
  const [activeRoomRecord, setActiveRoomRecord] = useState<RoomRecord | null>(null);
  const [customRoomTitle, setCustomRoomTitle] = useState('Sala Principal en Vivo');
  const [isAdminConfigOpen, setIsAdminConfigOpen] = useState(false);

  // Supabase Cloud State
  const [showDbModal, setShowDbModal] = useState(false);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
        localStorage.getItem('xstreamx_supabase_anon_key') ||
        ''
      );
    }
    return '';
  });
  const [hasSupabaseClient, setHasSupabaseClient] = useState(false);

  useEffect(() => {
    setHasSupabaseClient(!!getSupabaseClient());
  }, [supabaseAnonKeyInput]);

  const isAdminUser = authUser?.role === 'admin';

  // Load Active Room from Database
  const loadActiveRoom = async () => {
    try {
      const active = await dbServiceSingleton.getActiveRoom();
      setActiveRoomRecord(active);
      setCustomRoomTitle(active.name || 'Sala Principal en Vivo');
      // If URL did not specify a custom room, use active room id
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (!params.get('room')) {
          setRoomId(active.id);
        }
      }
    } catch (e) {
      console.warn('[Lobby] Error loading active room:', e);
    }
  };

  useEffect(() => {
    loadActiveRoom();
  }, []);

  const handleSaveSupabaseKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseAnonKey(supabaseAnonKeyInput.trim());
    setHasSupabaseClient(!!getSupabaseClient());
    await loadActiveRoom();
    setShowDbModal(false);
  };

  // Preview video element ref for PiP
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (pipVideoRef.current && cameraStream) {
      pipVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream, showCameraPip]);

  // Real-time canvas overlay for facial landmark mesh tracking preview
  useEffect(() => {
    if (!showCameraPip || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks || landmarks.length === 0 || !isCameraActive) {
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
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

    const drawPath = (indices: number[], color: string, width = 0.75, isClosed = false) => {
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

    profile.contours.forEach((c) => {
      drawPath(c.indices, c.color || profile.color, 0.75, c.isClosed || false);
    });

    profile.activeIndices.forEach((idx) => {
      const pt = getPt(idx);
      if (!pt) return;
      ctx.fillStyle = profile.dotColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 0.85, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [landmarks, showCameraPip, isCameraActive, selectedAvatarId]);

  const selectedAvatar =
    AVATAR_LIST.find((a) => a.id === selectedAvatarId) || AVATAR_LIST[0];

  const getPublicShareUrl = (roomCode: string) => {
    if (typeof window === 'undefined') return '';
    const cleanRoom = roomCode.trim().toLowerCase() || 'alpha';
    return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(cleanRoom)}`;
  };

  const handleCopyLink = () => {
    const url = getPublicShareUrl(roomId);
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleNativeShare = async () => {
    const url = getPublicShareUrl(roomId);
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'XSTREAMX - Videollamada con Avatares 3D',
          text: `¡Únete a mi videollamada en vivo en la sala "${(activeRoomRecord?.name || roomId).toUpperCase()}" de XSTREAMX!`,
          url,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }
    handleCopyLink();
  };

  const handleGenerateRandomAnon = () => {
    const p = ANON_PREFIXES[Math.floor(Math.random() * ANON_PREFIXES.length)];
    const s = ANON_SUFFIXES[Math.floor(Math.random() * ANON_SUFFIXES.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    setUserName(`${p}${s}_${num}`);
  };

  const handleAdminUpdateRoom = async () => {
    const cleanId = roomId.trim().toLowerCase() || 'alpha';
    const cleanTitle = customRoomTitle.trim() || `Sala ${cleanId.toUpperCase()}`;
    const updated: RoomRecord = {
      id: cleanId,
      name: cleanTitle,
      adminId: authUser?.username || 'admin',
      isLocked: false,
      participantCount: 1,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    await dbServiceSingleton.setActiveRoom(updated);
    setActiveRoomRecord(updated);
    setIsAdminConfigOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = userName.trim();
    const trimmedRoom = (roomId || activeRoomRecord?.id || 'alpha').trim().toLowerCase();

    if (!trimmedName) {
      setError('Por favor escribe tu nombre o alias para identificarte.');
      return;
    }

    setError(null);

    // Save/update room in database
    try {
      await dbServiceSingleton.saveRoom({
        id: trimmedRoom,
        name: activeRoomRecord?.name || `Sala ${trimmedRoom.toUpperCase()}`,
        adminId: authUser?.username || userName,
        isLocked: false,
        participantCount: 1,
        createdAt: Date.now(),
        lastActive: Date.now(),
      });
    } catch (e) {
      console.warn('Error persisting room:', e);
    }

    onJoinRoom({
      userName: trimmedName,
      roomId: trimmedRoom,
      avatarId: selectedAvatarId,
      createAsAdmin: isAdminUser,
    });
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Interactive Avatar Mirror Preview with Camera Recenter Sliders */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-md bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-2xl relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
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
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                  {isModelReady ? 'IA ACTIVA' : 'CALIBRANDO...'}
                </span>
              </div>
            </div>

            {/* Avatar Canvas */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
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

              {/* PiP Camera Preview with Real-time Landmark Overlay */}
              {showCameraPip && (
                <div className="absolute bottom-3 right-3 w-36 h-28 bg-slate-950 rounded-lg overflow-hidden border border-cyan-500/40 shadow-2xl z-30">
                  <video
                    ref={pipVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <canvas
                    ref={canvasRef}
                    width={144}
                    height={112}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                  <div className="absolute top-1 left-1 px-1 rounded bg-black/60 text-[9px] font-mono text-cyan-400">
                    ANATOMICAL MESH
                  </div>
                </div>
              )}

              {/* AI Status Indicator */}
              <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-mono text-cyan-300 flex items-center gap-1.5 border border-slate-800 z-20">
                <span
                  className={`w-2 h-2 rounded-full ${
                    localFeatures.isFaceDetected
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                  }`}
                />
                <span className="text-[11px]">
                  {localFeatures.isFaceDetected
                    ? 'Rostro Detectado (MediaPipe)'
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
              </div>
            )}

            {/* Hardware Controls & Device Selector */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    isMicActive
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
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    isCameraActive
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
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                    showCameraPip
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                  title="Ver overlay anatómico de tracking"
                >
                  {showCameraPip ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Audio visualizer */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800">
                <AudioWaveform volume={localFeatures.audioVolume} isMuted={!isMicActive} />
                <span className="text-xs font-mono text-slate-400">
                  {Math.round(localFeatures.audioVolume * 100)}%
                </span>
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

            {/* Camera Error / Permission Notice */}
            {cameraError && (
              <div className="mt-3 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-xs text-amber-200 flex flex-col gap-2">
                <span>{cameraError}</span>
                {onRequestCamera && (
                  <button
                    type="button"
                    onClick={onRequestCamera}
                    className="self-start px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-[11px] transition cursor-pointer"
                  >
                    Reintentar Conexión
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Identity & Direct Join Form */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 md:p-7 shadow-2xl space-y-5">
            
            {/* Supabase Cloud Status Indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${hasSupabaseClient ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400'}`} />
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  Supabase Realtime Cloud:
                </span>
                <span className={`font-mono text-[11px] ${hasSupabaseClient ? 'text-emerald-300' : 'text-cyan-300'}`}>
                  {hasSupabaseClient ? 'Nube Conectada' : 'Listo'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDbModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition cursor-pointer border border-slate-700 hover:border-cyan-500/50"
              >
                <Settings className="w-3 h-3 text-cyan-400" />
                <span>Configurar DB</span>
              </button>
            </div>

            {/* SINGLE ACTIVE ROOM BANNER */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/90 via-slate-900 to-indigo-950/90 border border-cyan-500/40 shadow-lg shadow-cyan-950/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-black text-cyan-400 tracking-wider flex items-center gap-1.5">
                    <span>SALA ÚNICA ACTIVA</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-mono">
                      EN VIVO
                    </span>
                  </div>
                  <div className="text-base font-black text-white">
                    {activeRoomRecord?.name || 'Sala ALPHA en Vivo'}
                  </div>
                </div>
              </div>

              {isAdminUser && (
                <button
                  type="button"
                  onClick={() => setIsAdminConfigOpen(!isAdminConfigOpen)}
                  className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin Sala</span>
                </button>
              )}
            </div>

            {/* Admin Room Editor Drawer */}
            {isAdminUser && isAdminConfigOpen && (
              <div className="p-3 bg-slate-950 rounded-xl border border-cyan-800/60 space-y-2.5 text-xs">
                <span className="font-bold text-cyan-300 uppercase tracking-wider block">
                  Configuración de Sala Única (Admin)
                </span>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Nombre de la Sala</label>
                  <input
                    type="text"
                    value={customRoomTitle}
                    onChange={(e) => setCustomRoomTitle(e.target.value)}
                    placeholder="Ej. Sala de Transmisión VIP"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Código ID de Sala</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    placeholder="alpha"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 uppercase"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdminUpdateRoom}
                  className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition"
                >
                  Guardar y Activar Sala Única en Supabase
                </button>
              </div>
            )}

            {/* Direct Join Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Step 1: Avatar Selector Grid */}
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
                        onClick={() => setSelectedAvatarId(avatar.id)}
                        className={`relative p-2 rounded-xl border text-left flex flex-col items-center gap-1 transition cursor-pointer ${
                          isSelected
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
                </div>
              </div>

              {/* Step 2: Name / Alias Input */}
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
                  placeholder="Escribe tu nombre aquí..."
                  maxLength={24}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-semibold transition"
                />
              </div>

              {/* Error feedback */}
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-xs text-rose-300">
                  {error}
                </div>
              )}

              {/* Step 3: High-Impact Direct Enter Button */}
              <button
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-slate-950 font-black tracking-wide text-sm flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/30 transition active:scale-[0.99] cursor-pointer"
              >
                <span>INGRESAR A LA SALA EN VIVO AHORA</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Share Public Link Bar */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                    Enlace de Invitación
                  </span>
                  <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/80">
                    Acceso Directo
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={getPublicShareUrl(roomId)}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 select-all focus:outline-none focus:border-cyan-500 truncate"
                    title="Enlace público para invitar a cualquier persona"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    }`}
                    title="Copiar link público para ingresar"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>¡Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shrink-0 cursor-pointer"
                    title="Compartir enlace con otro participante"
                  >
                    <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>

      </div>

      {/* Supabase Cloud Connection & SQL Schema Modal */}
      {showDbModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Base de Datos Supabase (Salas Persistentes)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Las salas y perfiles se guardan automáticamente en tu instancia en la nube de Supabase para que no se pierdan al recargar o cambiar de dispositivo.
            </p>

            <form onSubmit={handleSaveSupabaseKey} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  URL del Proyecto Supabase
                </label>
                <input
                  type="text"
                  readOnly
                  value={SUPABASE_URL}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 select-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Supabase Public Anon Key</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    (Settings → API → Project API Keys → anon public)
                  </span>
                </label>
                <input
                  type="password"
                  value={supabaseAnonKeyInput}
                  onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  Guardar y Sincronizar Salas
                </button>
                <button
                  type="button"
                  onClick={() => setShowSqlHelp(!showSqlHelp)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition cursor-pointer"
                >
                  {showSqlHelp ? 'Ocultar SQL' : 'Ver Esquema SQL'}
                </button>
              </div>
            </form>

            {showSqlHelp && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-semibold text-slate-300">Esquema SQL para Supabase:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const sql = `CREATE TABLE IF NOT EXISTS public.rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, admin_id TEXT DEFAULT '', is_locked BOOLEAN DEFAULT false, participant_count INTEGER DEFAULT 0, created_at BIGINT, last_active BIGINT); ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY; CREATE POLICY "Allow public all on rooms" ON public.rooms FOR ALL USING (true);`;
                      navigator.clipboard.writeText(sql);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                  >
                    {copiedSql ? '¡Copiado!' : 'Copiar SQL Rápido'}
                  </button>
                </div>
                <pre className="p-2 bg-slate-900 rounded text-[10px] font-mono text-cyan-300 overflow-x-auto max-h-40">
{`-- Ejecuta esto en el SQL Editor de tu Supabase:
CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id TEXT DEFAULT '',
  is_locked BOOLEAN DEFAULT false,
  participant_count INTEGER DEFAULT 0,
  created_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
  last_active BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all on rooms" ON public.rooms FOR ALL USING (true);`}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
