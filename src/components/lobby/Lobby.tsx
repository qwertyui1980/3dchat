import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  AlertCircle,
  AlertTriangle,
  Play,
  Plus,
  Layers,
  ScanFace,
  X,
  Box,
  Pencil,
  Smile,
} from 'lucide-react';
import { AvatarId, FaceFeatures, AvatarDefinition, DynamicTrackingMode } from '../../types';
import { AVATAR_LIST } from '../avatars/avatarConfigs';
import { avatarModelServiceSingleton, MAX_USER_AVATARS } from '../../services/avatarModelService';
import { AvatarCanvas } from '../avatars/AvatarCanvas';
import { AudioWaveform } from '../common/AudioWaveform';
import { AuthenticatedUser } from '../auth/Login';
import { dbServiceSingleton, RoomRecord } from '../../services/dbService';
import { indexedDbService } from '../../services/db/indexedDbService';
import { getAvatarTrackingProfile, transformAvatarLandmark, registerAvatarTrackingProfile } from '../avatars/avatarTrackingProfiles';
import { networkServiceSingleton } from '../../services/networkService';
import { LegalDisclaimerModal } from '../common/LegalDisclaimerModal';
import { AdminControlPanel } from '../room/AdminControlPanel';
import { FaceBlendshapeStudioModal } from '../admin/FaceBlendshapeStudioModal';
import {
  applyDynamicMode,
  TRACKING_MODES_CONFIG,
  normalizeTrackingMode,
  QuickGestureType,
  QUICK_GESTURES,
} from '../../services/face3d/dynamicModeHelper';

interface LobbyProps {
  onJoinRoom: (config: {
    userName: string;
    roomId: string;
    avatarId: AvatarId;
    createAsAdmin: boolean;
    isMicActive: boolean;
    isCameraActive: boolean;
    trackingMode: DynamicTrackingMode;
    cameraOffsetX: number;
    cameraOffsetY: number;
    trackingSensitivity: number;
    showTrackingPip: boolean;
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
  activeGesture?: QuickGestureType | null;
  onTriggerGesture?: (gesture: QuickGestureType) => void;
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
const getUserAvatarStorageKey = (username?: string) =>
  username ? `xstreamx_selected_avatar_${username.toLowerCase()}` : STORAGE_AVATAR_KEY;
const STORAGE_TRACKING_MODE_KEY = 'xstreamx_tracking_mode';
const STORAGE_OFFSET_X_KEY = 'xstreamx_camera_offset_x';
const STORAGE_OFFSET_Y_KEY = 'xstreamx_camera_offset_y';
const STORAGE_SENSITIVITY_KEY = 'xstreamx_tracking_sensitivity';
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
  activeGesture,
  onTriggerGesture,
}) => {
  const isAdminUser = authUser?.role === 'admin';

  const [localActiveGesture, setLocalActiveGesture] = useState<QuickGestureType | null>(null);
  const [showGesturesMenu, setShowGesturesMenu] = useState(false);
  const currentActiveGesture = activeGesture !== undefined ? activeGesture : localActiveGesture;

  const handleGestureClick = (gesture: QuickGestureType) => {
    if (onTriggerGesture) {
      onTriggerGesture(gesture);
    } else {
      setLocalActiveGesture((prev) => (prev === gesture || gesture === 'neutral') ? null : gesture);
    }
  };

  // Generate random alias or use authenticated user name
  const [userName, setUserName] = useState<string>(() => {
    if (authUser?.name) {
      return authUser.name;
    }
    return generateRandomAlias();
  });

  // Remember selected avatar from localStorage
  const [avatars, setAvatars] = useState<AvatarDefinition[]>(() =>
    isAdminUser
      ? avatarModelServiceSingleton.getAllAvatars()
      : avatarModelServiceSingleton.getActiveAvatars()
  );
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isFaceStudioOpen, setIsFaceStudioOpen] = useState(false);

  useEffect(() => {
    const unsub = avatarModelServiceSingleton.subscribe(() => {
      setAvatars(
        isAdminUser
          ? avatarModelServiceSingleton.getAllAvatars()
          : avatarModelServiceSingleton.getActiveAvatars()
      );
    });
    return unsub;
  }, [isAdminUser]);

  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>(() => {
    if (typeof window !== 'undefined') {
      const userKey = getUserAvatarStorageKey(authUser?.username);
      const savedUser = localStorage.getItem(userKey) as AvatarId;
      if (savedUser && avatarModelServiceSingleton.getAvatarById(savedUser)) {
        return savedUser;
      }
      if (authUser?.avatarId && avatarModelServiceSingleton.getAvatarById(authUser.avatarId)) {
        return authUser.avatarId as AvatarId;
      }
      const saved = localStorage.getItem(STORAGE_AVATAR_KEY) as AvatarId;
      if (saved && saved !== 'three_robot' && avatarModelServiceSingleton.getAvatarById(saved)) {
        return saved;
      }
    }
    if (authUser?.avatarId && avatarModelServiceSingleton.getAvatarById(authUser.avatarId)) {
      return authUser.avatarId as AvatarId;
    }
    return 'lincoln_3d';
  });

  // Synchronize authenticated user profile & assigned 3D avatar
  useEffect(() => {
    if (!authUser) return;

    if (authUser.name && authUser.name !== userName) {
      setUserName(authUser.name);
    }

    let isMounted = true;
    avatarModelServiceSingleton.syncUserCloudAvatars(authUser.username).catch(() => {});

    dbServiceSingleton.getUser(authUser.username).then((acc) => {
      if (!isMounted) return;
      const userKey = getUserAvatarStorageKey(authUser.username);
      const savedUserAvatar = typeof window !== 'undefined' ? (localStorage.getItem(userKey) as AvatarId) : null;

      if (savedUserAvatar && avatarModelServiceSingleton.getAvatarById(savedUserAvatar)) {
        setSelectedAvatarId(savedUserAvatar);
      } else if (acc?.avatarId && avatarModelServiceSingleton.getAvatarById(acc.avatarId)) {
        setSelectedAvatarId(acc.avatarId as AvatarId);
        if (typeof window !== 'undefined') {
          localStorage.setItem(userKey, acc.avatarId);
        }
      } else if (authUser.avatarId && avatarModelServiceSingleton.getAvatarById(authUser.avatarId)) {
        setSelectedAvatarId(authUser.avatarId as AvatarId);
      }
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [authUser?.username, authUser?.name, authUser?.avatarId]);

  // Tabs: 'predefined' (Modelos Predefinidos) vs 'custom' (Mis Avatares / 3D Masks en LocalStorage)
  const [avatarTab, setAvatarTab] = useState<'predefined' | 'custom'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_AVATAR_KEY) as AvatarId;
      if (saved) {
        const found = avatarModelServiceSingleton.getAvatarById(saved);
        if (found?.isCustom) return 'custom';
      }
    }
    return 'predefined';
  });

  const predefinedAvatars = useMemo(() => avatars.filter((a) => !a.isCustom), [avatars]);
  const customAvatars = useMemo(() => {
    return avatars.filter((a) => {
      if (!a.isCustom) return false;
      if (authUser?.username && !isAdminUser) {
        return a.ownerId === authUser.username || !a.ownerId;
      }
      return true;
    });
  }, [avatars, authUser?.username, isAdminUser]);

  const handleDeleteCustomAvatar = (avatarId: string, avatarName: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el avatar "${avatarName}"?`)) {
      avatarModelServiceSingleton.deleteModel(avatarId);
      if (selectedAvatarId === avatarId) {
        const fallback = predefinedAvatars[0]?.id || 'three_robot';
        setSelectedAvatarId(fallback);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_AVATAR_KEY, fallback);
        }
      }
    }
  };

  const handleRenameAvatar = (avatarId: string, currentName: string) => {
    const newName = window.prompt(`Cambiar nombre del modelo "${currentName}":`, currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      avatarModelServiceSingleton.renameModel(avatarId, newName.trim());
    }
  };

  const [error, setError] = useState<string | null>(null);
  const [showCameraPip, setShowCameraPip] = useState(false);
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [editingAvatarForStudio, setEditingAvatarForStudio] = useState<AvatarDefinition | null>(null);

  const handleEditCustomAvatar = (avatar: AvatarDefinition) => {
    setEditingAvatarForStudio(avatar);
    setIsFaceStudioOpen(true);
  };

  // Dynamic Tracking Modes ('parafernalia' | 'gestures' | 'lipsync')
  const [trackingMode, setTrackingMode] = useState<DynamicTrackingMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_TRACKING_MODE_KEY) as DynamicTrackingMode;
      if (saved) {
        return normalizeTrackingMode(saved);
      }
    }
    return 'parafernalia';
  });

  const handleSelectTrackingMode = (mode: DynamicTrackingMode) => {
    setTrackingMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_TRACKING_MODE_KEY, mode);
    }
  };

  // Calibration & Offset Controls initialized from localStorage
  const [cameraOffsetX, setCameraOffsetX] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_OFFSET_X_KEY);
      if (saved) return parseFloat(saved) || 0;
    }
    return 0;
  });
  const [cameraOffsetY, setCameraOffsetY] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_OFFSET_Y_KEY);
      if (saved) return parseFloat(saved) || 0;
    }
    return 0;
  });
  const [trackingSensitivity, setTrackingSensitivity] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_SENSITIVITY_KEY);
      if (saved) return parseFloat(saved) || 1.0;
    }
    return 1.0;
  });

  const handleCameraOffsetX = (val: number) => {
    setCameraOffsetX(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OFFSET_X_KEY, val.toString());
    }
  };

  const handleCameraOffsetY = (val: number) => {
    setCameraOffsetY(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OFFSET_Y_KEY, val.toString());
    }
  };

  const handleTrackingSensitivity = (val: number) => {
    setTrackingSensitivity(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_SENSITIVITY_KEY, val.toString());
    }
  };

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

  // Handle avatar change & persist in localStorage and user profile
  const handleSelectAvatar = (id: AvatarId) => {
    setSelectedAvatarId(id);
    if (typeof window !== 'undefined') {
      const userKey = getUserAvatarStorageKey(authUser?.username);
      localStorage.setItem(userKey, id);
      localStorage.setItem(STORAGE_AVATAR_KEY, id);
    }
    if (authUser?.username) {
      dbServiceSingleton.getUser(authUser.username).then((acc) => {
        if (acc && acc.avatarId !== id) {
          dbServiceSingleton.saveUser({ ...acc, avatarId: id }).catch(() => {});
        }
      }).catch(() => {});
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

    const customDef = avatarModelServiceSingleton.getAvatarById(selectedAvatarId);
    if (customDef?.trackingProfile) {
      registerAvatarTrackingProfile(selectedAvatarId, customDef.trackingProfile);
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
    avatars.find((a) => a.id === selectedAvatarId) ||
    avatarModelServiceSingleton.getAvatarById(selectedAvatarId) ||
    avatars[0] ||
    AVATAR_LIST[0];

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
        isMicActive,
        isCameraActive,
        trackingMode,
        cameraOffsetX,
        cameraOffsetY,
        trackingSensitivity,
        showTrackingPip: showCameraPip,
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

    if (!hasMicPermission && onRequestMic) {
      onRequestMic();
    }

    setError(null);

    onJoinRoom({
      userName: trimmedName,
      roomId: SINGLE_ROOM_ID,
      avatarId: selectedAvatarId,
      createAsAdmin: false,
      isMicActive: hasMicPermission ? isMicActive : false,
      isCameraActive,
      trackingMode,
      cameraOffsetX,
      cameraOffsetY,
      trackingSensitivity,
      showTrackingPip: showCameraPip,
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
      isMicActive,
      isCameraActive,
      trackingMode,
      cameraOffsetX,
      cameraOffsetY,
      trackingSensitivity,
      showTrackingPip: showCameraPip,
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
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_#ffe600]" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Elige tu avatar
                </span>
              </div>
              {isAdminUser && (
                <button
                  type="button"
                  onClick={() => setIsAdminPanelOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300 text-[11px] font-bold transition active:scale-95 cursor-pointer shadow-sm shadow-yellow-950/40"
                  title="Abrir Panel de Control del Administrador (Usuarios, Contraseñas y Modelos 3D)"
                >
                  <Shield className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Panel Admin</span>
                </button>
              )}
            </div>

            {/* Avatar Canvas */}
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#040406] border border-white/[0.06] flex items-center justify-center shadow-inner">
              <AvatarCanvas
                key={`${selectedAvatarId}_${selectedAvatar?.modelUrl || selectedAvatar?.createdAt || ''}`}
                avatarId={selectedAvatarId}
                features={applyDynamicMode(
                  localFeatures,
                  trackingMode,
                  trackingSensitivity,
                  cameraOffsetX,
                  cameraOffsetY,
                  currentActiveGesture
                )}
                trackingMode={trackingMode}
                isSpeaking={normalizeTrackingMode(trackingMode) !== 'gestures' && isMicActive && localFeatures.audioVolume > 0.08}
                cameraOffsetX={cameraOffsetX}
                cameraOffsetY={cameraOffsetY}
                className="w-full h-full"
              />

              {/* Real-time Anatomical Mesh Overlay (100% Private - Zero Camera Image Rendered) */}
              {showCameraPip && (
                <div className="absolute bottom-3 right-3 w-44 h-36 bg-slate-950/95 rounded-xl overflow-hidden border border-cyan-500/50 shadow-2xl z-30 flex flex-col animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 border-b border-slate-800">
                    <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-cyan-400 animate-pulse' : 'bg-amber-400'}`} />
                      Puntos Capturados
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCameraPip(false)}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                      title="Cerrar panel de puntos"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center">
                    <canvas
                      ref={canvasRef}
                      width={176}
                      height={120}
                      className="w-full h-full block"
                    />
                    {!isCameraActive && (
                      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center z-10">
                        <span className="text-[11px] text-slate-300 font-medium mb-1.5">Cámara inactiva</span>
                        <button
                          type="button"
                          onClick={onToggleCamera}
                          className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md transition-colors cursor-pointer"
                        >
                          Activar Cámara
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}



              {/* Top controls: Adjustments and Anatomical Mesh points quick toggle */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 z-20">
                <button
                  type="button"
                  onClick={() => setShowAdjustments(!showAdjustments)}
                  className={`p-1.5 rounded-lg border backdrop-blur-sm transition cursor-pointer ${
                    showAdjustments
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-800'
                  }`}
                  title="Ajustar centrado y sensibilidad"
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!showCameraPip && !isCameraActive) {
                      onToggleCamera();
                    }
                    setShowCameraPip(!showCameraPip);
                  }}
                  className={`p-1.5 rounded-lg border backdrop-blur-sm transition cursor-pointer ${
                    showCameraPip
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20 font-bold'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border-slate-800'
                  }`}
                  title={showCameraPip ? 'Ocultar Puntos Capturados' : 'Ver Puntos Capturados (Mesh Anatómico)'}
                >
                  {showCameraPip ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Slider Adjustments Drawer */}
            {showAdjustments && (
              <div className="mt-3 p-3 bg-slate-950/90 rounded-xl border border-slate-800 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between text-slate-400 font-medium">
                  <span>Centrado y Calibración de Cámara</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleCameraOffsetX(0);
                      handleCameraOffsetY(0);
                      handleTrackingSensitivity(1.0);
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
                    onChange={(e) => handleCameraOffsetX(parseFloat(e.target.value))}
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
                    onChange={(e) => handleCameraOffsetY(parseFloat(e.target.value))}
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
                    onChange={(e) => handleTrackingSensitivity(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Selector de Modos Dinámicos */}
            <div className="mt-3.5 p-2.5 bg-slate-950/80 rounded-xl border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Modos Dinámicos</span>
                </span>
                <span
                  className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
                  style={{
                    color: TRACKING_MODES_CONFIG[trackingMode].color,
                    borderColor: `${TRACKING_MODES_CONFIG[trackingMode].color}40`,
                    backgroundColor: `${TRACKING_MODES_CONFIG[trackingMode].color}15`,
                  }}
                >
                  {TRACKING_MODES_CONFIG[trackingMode].label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {/* 1. Parafernalia (Amarillo Neón) */}
                <button
                  type="button"
                  onClick={() => handleSelectTrackingMode('parafernalia')}
                  className={`p-2 rounded-lg border text-left transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    normalizeTrackingMode(trackingMode) === 'parafernalia'
                      ? 'bg-yellow-950/80 border-yellow-400 text-white ring-1 ring-yellow-400/40 shadow-sm shadow-yellow-500/20'
                      : 'bg-[#121218] hover:bg-[#181822] text-neutral-400 border-white/[0.06]'
                  }`}
                  title="Modo divertido: la máscara se mueve al ritmo de la voz, con gestos y zoom dinámico"
                >
                  <Sparkles className={`w-4 h-4 ${normalizeTrackingMode(trackingMode) === 'parafernalia' ? 'text-yellow-400' : 'text-neutral-400'}`} />
                  <span className="text-[11px] font-bold leading-none text-center">Parafernalia</span>
                  <span className="text-[9px] text-neutral-400 text-center leading-none">Voz & Zoom</span>
                </button>

                {/* 2. Reconocimiento de Gestos (Azul Neón) */}
                <button
                  type="button"
                  onClick={() => handleSelectTrackingMode('gestures')}
                  className={`p-2 rounded-lg border text-left transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    normalizeTrackingMode(trackingMode) === 'gestures'
                      ? 'bg-blue-950/80 border-blue-400 text-white ring-1 ring-blue-400/40 shadow-sm shadow-blue-500/20'
                      : 'bg-[#121218] hover:bg-[#181822] text-neutral-400 border-white/[0.06]'
                  }`}
                  title="Reconoce única y exclusivamente gestos faciales por cámara y los iguala en el avatar"
                >
                  <ScanFace className={`w-4 h-4 ${normalizeTrackingMode(trackingMode) === 'gestures' ? 'text-blue-400' : 'text-neutral-400'}`} />
                  <span className="text-[11px] font-bold leading-none text-center">Gestos</span>
                  <span className="text-[9px] text-neutral-400 text-center leading-none">100% Cámara</span>
                </button>

                {/* 3. Lip Sync (Rojo Neón) */}
                <button
                  type="button"
                  onClick={() => handleSelectTrackingMode('lipsync')}
                  className={`p-2 rounded-lg border text-left transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                    normalizeTrackingMode(trackingMode) === 'lipsync'
                      ? 'bg-rose-950/80 border-rose-500 text-white ring-1 ring-rose-500/40 shadow-sm shadow-rose-500/20'
                      : 'bg-[#121218] hover:bg-[#181822] text-neutral-400 border-white/[0.06]'
                  }`}
                  title="Máscara estática: el audio anima únicamente la sección de los labios y la boca sin requerir video"
                >
                  <Radio className={`w-4 h-4 ${normalizeTrackingMode(trackingMode) === 'lipsync' ? 'text-rose-400' : 'text-neutral-400'}`} />
                  <span className="text-[11px] font-bold leading-none text-center">Lip Sync</span>
                  <span className="text-[9px] text-neutral-400 text-center leading-none">Solo Boca</span>
                </button>
              </div>
            </div>

            {/* Hardware Controls & Device Selector */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${isMicActive
                    ? 'bg-slate-800 hover:bg-slate-700 border-blue-500/50 text-blue-400 shadow-sm shadow-blue-500/20'
                    : 'bg-rose-950/60 hover:bg-rose-900 border-rose-800 text-rose-300'
                    }`}
                  title={isMicActive ? 'Silenciar Micrófono' : 'Activar Micrófono'}
                >
                  {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-rose-400" />}
                </button>

                <button
                  type="button"
                  onClick={onToggleCamera}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition cursor-pointer ${isCameraActive
                    ? 'bg-slate-800 hover:bg-slate-700 border-blue-500/50 text-blue-400 shadow-sm shadow-blue-500/20'
                    : 'bg-rose-950/60 hover:bg-rose-900 border-rose-800 text-rose-300'
                    }`}
                  title={isCameraActive ? 'Pausar Cámara' : 'Reanudar Cámara'}
                >
                  {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4 text-rose-400" />}
                </button>

                {/* Gestos Dropdown / Popover Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowGesturesMenu((prev) => !prev)}
                    className={`p-2.5 rounded-xl border flex items-center gap-1.5 transition cursor-pointer text-xs font-semibold ${
                      showGesturesMenu || currentActiveGesture
                        ? 'bg-amber-950/70 hover:bg-amber-900 border-amber-500/50 text-amber-300 shadow-md shadow-amber-950/30'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                    title="Menú de Gestos (Sonrisa, Sorpresa, Guiño, Ceño, Pucker, Neutral)"
                  >
                    <Smile className="w-4 h-4 text-amber-400" />
                    <span>Gestos</span>
                    {currentActiveGesture && (
                      <span className="text-xs">
                        {QUICK_GESTURES.find((g) => g.id === currentActiveGesture)?.emoji}
                      </span>
                    )}
                  </button>

                  {showGesturesMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowGesturesMenu(false)}
                      />
                      <div className="absolute left-0 bottom-full mb-2 w-72 sm:w-80 p-3 rounded-2xl bg-gradient-to-r from-amber-950/95 via-orange-950/90 to-amber-950/95 border border-amber-500/40 shadow-2xl backdrop-blur-xl z-40 space-y-2.5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Smile className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-amber-200">Gestos</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleGestureClick('neutral')}
                            className="text-[10px] text-amber-300 hover:text-white underline cursor-pointer"
                          >
                            Reset Neutral
                          </button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                          {QUICK_GESTURES.map((g) => {
                            const isActive = currentActiveGesture === g.id;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => handleGestureClick(g.id)}
                                className={`py-2 px-1 rounded-lg border text-[10px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                                  isActive
                                    ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-sm ring-1 ring-amber-400/50'
                                    : 'bg-black/40 hover:bg-amber-500/20 border-amber-500/20 text-neutral-200 hover:text-amber-200'
                                }`}
                              >
                                <span className="text-sm leading-none">{g.emoji}</span>
                                <span className="truncate max-w-full">{g.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Audio visualizer */}
              <div className="flex items-center">
                <AudioWaveform
                  volume={localFeatures.audioVolume}
                  isMuted={!isMicActive}
                  width={90}
                  height={24}
                  color="#ffe600"
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

            {/* Camera & Microphone Notices (Only show warning if mic permission was explicitly denied) */}
            {!hasMicPermission && !!micError && (
              <div className="mt-3 p-3.5 bg-rose-950/80 border border-rose-600 rounded-xl text-xs text-rose-200 flex flex-col gap-2 shadow-lg shadow-rose-950/50 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Permiso de micrófono no concedido</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  {micError}
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


          </div>
        </div>

        {/* Columna Derecha: Selección de Avatar, Alias y Acceso al Espacio Único */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="bg-[#0d0d12]/95 rounded-2xl border border-white/[0.08] p-5 md:p-7 shadow-2xl space-y-5">

            {/* AVISO: ERROR DE MICRÓFONO EN CASO DE DENEGACIÓN */}
            {!hasMicPermission && !!micError && (
              <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-600 text-rose-200 text-xs space-y-2.5 shadow-xl shadow-rose-950/50 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>Permiso de micrófono requerido</span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  {micError}
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

              {/* Paso 1: Selector de Avatar 3D con Pestañas (Predefinidos vs Mis Avatares) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-yellow-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow-sm shadow-yellow-500/30">1</span>
                    <span>Elige tu Avatar 3D</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAdminUser && customAvatars.length >= MAX_USER_AVATARS) {
                          alert(`Has alcanzado el límite máximo permitido de ${MAX_USER_AVATARS} avatares por cuenta. Elimina o edita uno de tus avatares existentes.`);
                          return;
                        }
                        setEditingAvatarForStudio(null);
                        setIsFaceStudioOpen(true);
                      }}
                      className="text-[11px] text-yellow-300 hover:text-yellow-200 font-black flex items-center gap-1 cursor-pointer bg-gradient-to-r from-yellow-500/20 to-blue-500/20 hover:from-yellow-500/30 hover:to-blue-500/30 px-2.5 py-1 rounded-lg border border-yellow-400/40 shadow-sm shadow-yellow-500/10 transition active:scale-95"
                      title="Crear Avatar Facial con 3D Masks"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>3D Masks</span>
                    </button>

                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={() => setIsAdminPanelOpen(true)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30 transition active:scale-95"
                        title="Gestionar Modelos 3D"
                      >
                        <Shield className="w-3 h-3" />
                        <span className="hidden sm:inline">Gestionar</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Selector de Pestañas: Modelos Predefinidos vs Mis Avatares */}
                <div className="flex items-center gap-1.5 p-1 mb-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setAvatarTab('predefined')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      avatarTab === 'predefined'
                        ? 'bg-yellow-400 text-slate-950 shadow-md font-black shadow-yellow-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>Modelos Predefinidos</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        avatarTab === 'predefined'
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {predefinedAvatars.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAvatarTab('custom')}
                    className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      avatarTab === 'custom'
                        ? 'bg-yellow-400 text-slate-950 shadow-md font-black shadow-yellow-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Mis Avatares</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        avatarTab === 'custom'
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isAdminUser ? customAvatars.length : `${customAvatars.length}/${MAX_USER_AVATARS}`}
                    </span>
                  </button>
                </div>

                {/* Contenido Pestaña 1: Modelos Predefinidos */}
                {avatarTab === 'predefined' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                    {predefinedAvatars.map((avatar) => {
                      const isSelected = avatar.id === selectedAvatarId;
                      return (
                        <div
                          key={avatar.id}
                          onClick={() => handleSelectAvatar(avatar.id)}
                          className={`group relative p-2 rounded-xl border text-left flex flex-col items-center gap-1 transition cursor-pointer ${
                            isSelected
                              ? 'bg-yellow-950/40 border-yellow-400 ring-2 ring-yellow-400/40 shadow-md shadow-yellow-500/20 scale-[1.02]'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-lg border flex items-center justify-center text-xl shadow-inner shrink-0 overflow-hidden"
                            style={{
                              background: `linear-gradient(135deg, ${avatar.themeColor}22, ${avatar.accentColor}33)`,
                              borderColor: `${avatar.themeColor}55`,
                            }}
                          >
                            {avatar.previewImage ? (
                              <img
                                src={avatar.previewImage}
                                alt={avatar.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              avatar.emoji || '🎭'
                            )}
                          </div>
                          <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                            {avatar.name}
                          </span>

                          {/* Selected Indicator Check */}
                          {isSelected && (
                            <div className="absolute top-1 left-1 w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center shadow">
                              <Check className="w-2.5 h-2.5 text-slate-950" />
                            </div>
                          )}

                          {/* Botón Admin: Renombrar Modelo */}
                          {isAdminUser && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameAvatar(avatar.id, avatar.name);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/90 hover:bg-cyan-600 text-slate-400 hover:text-white border border-slate-700 hover:border-cyan-400 flex items-center justify-center transition shadow-md z-10 cursor-pointer"
                              title={`Cambiar nombre de "${avatar.name}"`}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          )}

                          {/* Botón Admin: Volver a Editar con 3D Mask */}
                          {isAdminUser && (avatar.isCustom || avatar.isPublic || avatar.originalImage || avatar.debugParams) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCustomAvatar(avatar);
                              }}
                              className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-slate-900/90 hover:bg-emerald-600 text-slate-400 hover:text-white border border-slate-700 hover:border-emerald-400 flex items-center justify-center transition shadow-md z-10 cursor-pointer"
                              title={`Editar "${avatar.name}" en 3D Masks Studio`}
                            >
                              <Sliders className="w-2.5 h-2.5 text-emerald-400 group-hover:text-white" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Subir Modelo / Abrir Panel (Solo Admin) */}
                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={() => setIsAdminPanelOpen(true)}
                        title="Subir nuevo archivo de modelo 3D (.glb, .gltf, .vrm)"
                        className="relative p-2 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 text-left flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-lg border border-dashed border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                          <Plus className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-bold text-cyan-300 text-center leading-tight">
                          Subir 3D
                        </span>
                        <span className="text-[8px] font-mono text-cyan-400 px-1 py-0.2 bg-cyan-950/80 rounded border border-cyan-900">
                          Admin
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Contenido Pestaña 2: Mis Avatares (Creados con 3D Masks en LocalStorage) */}
                {avatarTab === 'custom' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                      {customAvatars.map((avatar) => {
                        const isSelected = avatar.id === selectedAvatarId;
                        return (
                          <div
                            key={avatar.id}
                            onClick={() => handleSelectAvatar(avatar.id)}
                            className={`group relative p-2 rounded-xl border text-left flex flex-col items-center gap-1 transition cursor-pointer ${
                              isSelected
                                ? 'bg-yellow-950/40 border-yellow-400 ring-2 ring-yellow-400/40 shadow-md shadow-yellow-500/20 scale-[1.02]'
                                : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                            }`}
                          >
                            {/* Botón X de eliminación rápida para cualquier usuario o admin */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomAvatar(avatar.id, avatar.name);
                              }}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/90 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 hover:border-rose-500 flex items-center justify-center transition shadow-md z-10 cursor-pointer"
                              title={`Eliminar avatar "${avatar.name}"`}
                            >
                              <X className="w-3 h-3" />
                            </button>

                            {/* Botón Admin: Renombrar Modelo */}
                            {isAdminUser && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameAvatar(avatar.id, avatar.name);
                                }}
                                className="absolute top-1 right-7 w-5 h-5 rounded-full bg-slate-900/90 hover:bg-yellow-500 hover:text-slate-950 text-slate-400 border border-slate-700 hover:border-yellow-400 flex items-center justify-center transition shadow-md z-10 cursor-pointer"
                                title={`Cambiar nombre de "${avatar.name}"`}
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            )}

                            {/* Botón: Volver a Editar con 3D Mask */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditCustomAvatar(avatar);
                              }}
                              className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-slate-900/90 hover:bg-blue-600 text-slate-400 hover:text-white border border-slate-700 hover:border-blue-400 flex items-center justify-center transition shadow-md z-10 cursor-pointer"
                              title={`Volver a editar "${avatar.name}" con 3D Mask`}
                            >
                              <Sliders className="w-2.5 h-2.5 text-blue-400 group-hover:text-white" />
                            </button>

                            <div
                              className="w-10 h-10 rounded-lg border flex items-center justify-center text-xl shadow-inner shrink-0 overflow-hidden"
                              style={{
                                background: `linear-gradient(135deg, ${avatar.themeColor}22, ${avatar.accentColor}33)`,
                                borderColor: `${avatar.themeColor}55`,
                              }}
                            >
                              {avatar.previewImage ? (
                                <img
                                  src={avatar.previewImage}
                                  alt={avatar.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                avatar.emoji || '🎭'
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                              {avatar.name}
                            </span>

                            {/* Selected Indicator Check */}
                            {isSelected && (
                              <div className="absolute top-1 left-1 w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center shadow">
                                <Check className="w-2.5 h-2.5 text-slate-950" />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Botón + Crear con 3D Masks (Siempre visible en Mis Avatares) */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAdminUser && customAvatars.length >= MAX_USER_AVATARS) {
                            alert(`Has alcanzado el límite máximo permitido de ${MAX_USER_AVATARS} avatares por cuenta. Elimina o edita uno de tus avatares existentes.`);
                            return;
                          }
                          setEditingAvatarForStudio(null);
                          setIsFaceStudioOpen(true);
                        }}
                        title={
                          !isAdminUser && customAvatars.length >= MAX_USER_AVATARS
                            ? `Límite alcanzado (${MAX_USER_AVATARS}/${MAX_USER_AVATARS} avatares). Elimina o edita uno existente.`
                            : 'Crear nuevo avatar 3D facial con 52 blendshapes desde foto'
                        }
                        className={`relative p-2 rounded-xl border border-dashed text-left flex flex-col items-center justify-center gap-1 cursor-pointer transition active:scale-95 shadow-md min-h-[86px] ${
                          !isAdminUser && customAvatars.length >= MAX_USER_AVATARS
                            ? 'border-amber-500/40 bg-amber-950/20 hover:bg-amber-950/30 shadow-amber-950/20'
                            : 'border-cyan-500/50 hover:border-cyan-400 bg-gradient-to-b from-cyan-950/30 to-indigo-950/30 hover:from-cyan-950/50 hover:to-indigo-950/50 shadow-cyan-950/20'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm shadow-md shrink-0 ${
                          !isAdminUser && customAvatars.length >= MAX_USER_AVATARS
                            ? 'bg-gradient-to-tr from-amber-600 to-yellow-500 text-slate-950'
                            : 'bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white'
                        }`}>
                          <Sparkles className="w-5 h-5" />
                        </div>
                        <span className={`text-[9px] font-bold text-center leading-tight ${
                          !isAdminUser && customAvatars.length >= MAX_USER_AVATARS ? 'text-amber-200' : 'text-cyan-200'
                        }`}>
                          {!isAdminUser && customAvatars.length >= MAX_USER_AVATARS ? 'Límite (4/4)' : '+ Crear Avatar'}
                        </span>
                        <span className={`text-[8px] font-mono px-1 py-0.2 rounded border ${
                          !isAdminUser && customAvatars.length >= MAX_USER_AVATARS
                            ? 'text-amber-300 bg-amber-900/60 border-amber-600/50'
                            : 'text-cyan-300 bg-cyan-900/60 border-cyan-600/50'
                        }`}>
                          {!isAdminUser && customAvatars.length >= MAX_USER_AVATARS ? 'Máx 4' : '3D Masks'}
                        </span>
                      </button>
                    </div>

                    {/* Estado vacío si no hay avatares personalizados */}
                    {customAvatars.length === 0 && (
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center">
                        <p className="text-xs text-neutral-300 font-semibold mb-1">
                          No tienes avatares 3D creados aún
                        </p>
                        <p className="text-[11px] text-neutral-400">
                          Haz clic en <strong className="text-cyan-300">&ldquo;+ Crear Avatar&rdquo;</strong> o en <strong className="text-cyan-300">&ldquo;3D Masks&rdquo;</strong> para generar tu modelo 3D con blendshapes desde una foto. Se guardará únicamente en tu navegador.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Paso 2: Nombre o Alias */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-yellow-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow-sm shadow-yellow-500/30">2</span>
                    <span>Tu Nombre o Alias</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomAnon}
                    className="text-[11px] font-semibold text-yellow-400 hover:text-yellow-300 flex items-center gap-1 transition cursor-pointer"
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 font-semibold transition"
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
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 hover:from-yellow-300 hover:to-amber-200 text-slate-950 font-black tracking-wide text-sm flex items-center justify-center gap-2 shadow-xl shadow-yellow-500/30 transition active:scale-[0.99] cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>INGRESAR AL ESPACIO EN VIVO AHORA</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        </div>

      </div>

      <LegalDisclaimerModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />

      {/* Admin Global Control Panel Modal */}
      {isAdminUser && (
        <AdminControlPanel
          room={{
            id: SINGLE_ROOM_ID,
            name: 'Espacio Principal en Vivo',
            adminId: authUser?.username || 'admin',
            isLocked: false,
            participants: [],
          }}
          currentUser={{
            id: authUser?.username || 'admin',
            name: authUser?.name || 'Administrador',
            avatarId: selectedAvatarId,
            role: 'admin',
            roomId: SINGLE_ROOM_ID,
            isMuted: false,
            isCameraActive: true,
          }}
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          onAdminMute={() => { }}
          onAdminKick={() => { }}
          onToggleLock={() => { }}
          onMuteAll={() => { }}
          onSelectAvatar={(id) => handleSelectAvatar(id)}
          onOpenFaceStudio={() => {
            setIsAdminPanelOpen(false);
            setIsFaceStudioOpen(true);
          }}
        />
      )}

      {/* 3D Masks Admin Studio Modal */}
      <FaceBlendshapeStudioModal
        isOpen={isFaceStudioOpen}
        onClose={() => {
          setIsFaceStudioOpen(false);
          setEditingAvatarForStudio(null);
        }}
        isAdmin={isAdminUser}
        editingAvatar={editingAvatarForStudio}
        onSelectAvatar={(avatarId: AvatarId) => {
          handleSelectAvatar(avatarId);
          setAvatarTab('custom');
          setIsFaceStudioOpen(false);
          setEditingAvatarForStudio(null);
        }}
      />
    </div>
  );
};
