/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AvatarId,
  FaceFeatures,
  RoomInfo,
  User,
  ChatMessage,
  RoomMediaState,
  VideoQueueItem,
  WhiteboardStroke,
  DynamicTrackingMode,
} from './types';
import {
  faceTrackerSingleton,
  INITIAL_FACE_FEATURES,
} from './services/mediapipeService';
import { audioServiceSingleton } from './services/audioService';
import { networkServiceSingleton } from './services/networkService';
import { avatarModelServiceSingleton } from './services/avatarModelService';
import { Header } from './components/common/Header';
import { Lobby } from './components/lobby/Lobby';
import { RoomView } from './components/room/RoomView';
import { Login, AuthenticatedUser } from './components/auth/Login';
import { Register } from './components/auth/Register';
import { UserProfileModal } from './components/profile/UserProfileModal';
import { dbServiceSingleton } from './services/dbService';
import { indexedDbService } from './services/db/indexedDbService';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { applyDynamicMode, normalizeTrackingMode, QuickGestureType } from './services/face3d/dynamicModeHelper';
import { INITIAL_ROOM_MEDIA_STATE } from './utils/youtube';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning';
  text: string;
}

const INITIAL_MEDIA_STATE: RoomMediaState = {
  ...INITIAL_ROOM_MEDIA_STATE,
};

export default function App() {
  // Authentication state
  const [authenticatedUser, setAuthenticatedUser] = useState<AuthenticatedUser | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('xstreamx_auth');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  // Ensure authenticated user carries their assigned avatarId from Supabase/Seed & sync avatars
  useEffect(() => {
    if (authenticatedUser?.username) {
      avatarModelServiceSingleton.syncUserCloudAvatars(authenticatedUser.username).catch(() => {});
      dbServiceSingleton.ensureSeedUsersInCloud().catch(() => {});
    }

    if (authenticatedUser && !authenticatedUser.avatarId) {
      let isMounted = true;
      dbServiceSingleton.getUser(authenticatedUser.username).then((acc) => {
        if (!isMounted || !acc) return;
        const assignedAvatar = acc.avatarId || (authenticatedUser.role === 'admin' ? 'lincoln_3d' : 'lincoln_3d');
        setAuthenticatedUser((prev) => (prev ? { ...prev, avatarId: assignedAvatar } : null));
        if (typeof window !== 'undefined') {
          const updated = { ...authenticatedUser, avatarId: assignedAvatar };
          sessionStorage.setItem('xstreamx_auth', JSON.stringify(updated));
          localStorage.setItem(`xstreamx_selected_avatar_${authenticatedUser.username.toLowerCase()}`, assignedAvatar);
        }
      }).catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [authenticatedUser?.username, authenticatedUser?.avatarId]);

  // Client Routing (/register, /, etc.) & Profile Modal
  const [currentPath, setCurrentPath] = useState<string>(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  const navigateTo = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== path) {
        window.history.pushState(null, '', path);
      }
    }
    setCurrentPath(path);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // App state
  const [isInRoom, setIsInRoom] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mediaState, setMediaState] = useState<RoomMediaState>(INITIAL_MEDIA_STATE);
  const [remoteStroke, setRemoteStroke] = useState<WhiteboardStroke | null>(null);
  const [remoteClearTimestamp, setRemoteClearTimestamp] = useState<number>(0);

  // Hardware states: Audio starts MUTED by default
  const [isMicActive, setIsMicActive] = useState(false);
  const [isAdminMuted, setIsAdminMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Tracking state
  const [localFeatures, setLocalFeatures] = useState<FaceFeatures>({
    ...INITIAL_FACE_FEATURES,
  });
  const [landmarks, setLandmarks] = useState<Array<{ x: number; y: number; z: number }> | null>(null);
  const [peerFeaturesMap, setPeerFeaturesMap] = useState<Map<string, FaceFeatures>>(new Map());

  // Dynamic tracking mode & calibration state
  const [trackingMode, setTrackingMode] = useState<DynamicTrackingMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xstreamx_tracking_mode') as DynamicTrackingMode;
      if (saved) return normalizeTrackingMode(saved);
    }
    return 'parafernalia';
  });
  const trackingModeRef = useRef<DynamicTrackingMode>(trackingMode);
  trackingModeRef.current = trackingMode;

  const [cameraOffsetX, setCameraOffsetX] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xstreamx_camera_offset_x');
      if (saved) return parseFloat(saved) || 0;
    }
    return 0;
  });
  const cameraOffsetXRef = useRef<number>(cameraOffsetX);
  cameraOffsetXRef.current = cameraOffsetX;

  const [cameraOffsetY, setCameraOffsetY] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xstreamx_camera_offset_y');
      if (saved) return parseFloat(saved) || 0;
    }
    return 0;
  });
  const cameraOffsetYRef = useRef<number>(cameraOffsetY);
  cameraOffsetYRef.current = cameraOffsetY;

  const [trackingSensitivity, setTrackingSensitivity] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xstreamx_tracking_sensitivity');
      if (saved) return parseFloat(saved) || 1.0;
    }
    return 1.0;
  });
  const trackingSensitivityRef = useRef<number>(trackingSensitivity);
  trackingSensitivityRef.current = trackingSensitivity;

  // Active Quick Gesture state (Smile, Surprise, Wink, Furrow, Pucker, Neutral)
  const [activeGesture, setActiveGesture] = useState<QuickGestureType | null>(null);
  const activeGestureRef = useRef<QuickGestureType | null>(null);
  activeGestureRef.current = activeGesture;

  const [isTrackingPipVisible, setIsTrackingPipVisible] = useState<boolean>(true);

  // Master tracking video element & camera stream
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isStartingCameraRef = useRef(false);

  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Toast notification helper
  const addToast = useCallback((text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const refreshAvailableCameras = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      return videoDevices;
    } catch (_) {
      return [];
    }
  }, []);

  // Microphone start helper that verifies permissions and establishes audio analysis
  const startMic = useCallback(async (startUnmuted: boolean = false) => {
    try {
      const audioStream = await audioServiceSingleton.start((volume) => {
        faceTrackerSingleton.setAudioVolume(volume);
        setLocalFeatures((prev) => {
          if (Math.abs(prev.audioVolume - volume) < 0.005 && volume === 0 && prev.audioVolume === 0) {
            return prev;
          }
          const updated: FaceFeatures = {
            ...prev,
            audioVolume: volume,
          };
          // Broadcast audio-driven lip sync if camera is inactive, no face detected, or in audio_only mode
          if (!cameraStreamRef.current || !prev.isFaceDetected || trackingModeRef.current === 'audio_only') {
            const active = applyDynamicMode(
              updated,
              trackingModeRef.current,
              trackingSensitivityRef.current,
              cameraOffsetXRef.current,
              cameraOffsetYRef.current,
              activeGestureRef.current
            );
            networkServiceSingleton.broadcastFaceData(active);
          }
          return updated;
        });
      });

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        networkServiceSingleton.setLocalAudioStream(audioStream);
        setHasMicPermission(true);
        setMicError(null);
        setIsMicActive(startUnmuted);
        audioServiceSingleton.setMute(!startUnmuted);
        return true;
      } else {
        setHasMicPermission(false);
        setMicError('No se pudo acceder al micrófono. Se requieren permisos de micrófono para ingresar al espacio.');
        return false;
      }
    } catch (audioErr: any) {
      console.warn('[App] Mic not available or permission denied:', audioErr);
      const errName = audioErr?.name || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setMicError('Permiso de micrófono denegado en el navegador. Es obligatorio permitir el acceso al micrófono para ingresar al espacio.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setMicError('No se detectó ningún micrófono en tu dispositivo.');
      } else {
        setMicError('No es posible acceder al micrófono. Por favor verifica tus permisos en el navegador.');
      }
      setHasMicPermission(false);
      return false;
    }
  }, []);

  // Camera start helper that reliably acquires stream and connects tracking
  const startCamera = useCallback(async (targetDeviceId?: string) => {
    if (isStartingCameraRef.current) {
      return false;
    }
    isStartingCameraRef.current = true;

    try {
      // 1. Release previous camera hardware lock
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }

      const devId = targetDeviceId || selectedCameraId;
      let stream: MediaStream | null = null;
      let lastErr: unknown = null;

      // First attempt: preferred resolution / deviceId
      try {
        const constraints: MediaStreamConstraints = {
          video: devId
            ? { deviceId: { ideal: devId } }
            : {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user',
            },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        lastErr = err1;
        // Fallback attempt: basic generic video constraint
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        } catch (err2) {
          lastErr = err2;
        }
      }

      if (!stream) {
        throw lastErr || new Error('No se pudo acceder a la cámara');
      }

      // Success! Clear error
      setCameraError(null);

      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setIsCameraActive(true);

      // Refresh camera devices list with actual device labels
      await refreshAvailableCameras();

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('[App] Master video autoplay error:', e);
        }

        // Start MediaPipe tracking loop
        faceTrackerSingleton.startTracking(
          videoRef.current,
          (features) => {
            setLocalFeatures((prev) => {
              const merged = { ...features, audioVolume: prev.audioVolume };
              const active = applyDynamicMode(
                merged,
                trackingModeRef.current,
                trackingSensitivityRef.current,
                cameraOffsetXRef.current,
                cameraOffsetYRef.current,
                activeGestureRef.current
              );
              networkServiceSingleton.broadcastFaceData(active);
              return merged;
            });
          },
          (lms) => {
            setLandmarks(lms);
          }
        );
      }
      return true;
    } catch (camErr: any) {
      console.warn('[App] Webcam not available or permission denied (audio-only lip-sync fallback enabled):', camErr);

      const errName = camErr?.name || '';
      const errMsg = (camErr?.message || '').toLowerCase();
      const isDeviceInUse =
        errName === 'NotReadableError' ||
        errMsg.includes('device in use') ||
        errMsg.includes('could not start') ||
        errMsg.includes('concurrent');

      if (isDeviceInUse) {
        const msg = 'Cámara en uso por otra app o pestaña. Puedes participar en modo solo voz.';
        setCameraError(msg);
      } else if (errName === 'NotAllowedError') {
        const msg = 'Permiso de cámara no concedido. Podrás participar en modo solo voz (Lip-Sync).';
        setCameraError(msg);
      } else {
        setCameraError('Cámara no disponible. Participando en modo solo voz.');
      }

      setIsCameraActive(false);
      setCameraStream(null);
      setLocalFeatures((prev) => ({
        ...INITIAL_FACE_FEATURES,
        audioVolume: prev.audioVolume,
      }));
      setLandmarks(null);
      await refreshAvailableCameras();
      return false;
    } finally {
      isStartingCameraRef.current = false;
    }
  }, [selectedCameraId, refreshAvailableCameras]);

  const handleSelectCamera = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    await startCamera(deviceId);
  }, [startCamera]);

  // Connect AudioService unlock to resume remote audio streams
  useEffect(() => {
    audioServiceSingleton.onAudioUnlocked = () => {
      networkServiceSingleton.resumeAllRemoteAudio();
    };
    return () => {
      audioServiceSingleton.onAudioUnlocked = undefined;
    };
  }, []);

  // Proactively initialize and verify microphone when entering the lobby
  // Ensures microphone hardware access is tested and ready, starting in a safe MUTED state
  useEffect(() => {
    let isCancelled = false;
    if (authenticatedUser && !isInRoom) {
      const stream = audioServiceSingleton.getStream();
      const hasLiveStream = stream && stream.getAudioTracks().some((t) => t.readyState === 'live');
      if (!hasLiveStream) {
        startMic()
          .then((ok) => {
            if (!isCancelled && ok) {
              console.log('[Lobby] Mic auto-initialized and ready (muted).');
            }
          })
          .catch((err) => {
            console.warn('[Lobby] Mic auto-init notice:', err);
          });
      }
    }
    return () => {
      isCancelled = true;
    };
  }, [authenticatedUser, isInRoom, startMic]);

  useEffect(() => {
    return () => {
      faceTrackerSingleton.stopTracking();
      audioServiceSingleton.stop();
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // Helper to preserve subpath when hosted on GitHub Pages (e.g. /presidents or /3dchat)
  const getBasePath = useCallback(() => {
    if (typeof window === 'undefined') return '';
    if (window.location.pathname.startsWith('/presidents')) return '/presidents';
    if (window.location.pathname.startsWith('/3dchat')) return '/3dchat';
    return '';
  }, []);

  // Centralized Room, Call & Hardware Teardown (Cancels call, stops camera & mic sharing)
  const terminateRoomAndMedia = useCallback((noticeMessage?: string) => {
    // 1. Fully release camera hardware lock and stop facial AI tracker
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      cameraStreamRef.current = null;
    }
    setCameraStream(null);
    setIsCameraActive(false);
    faceTrackerSingleton.stopTracking();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLandmarks(null);
    setLocalFeatures((prev) => ({
      ...INITIAL_FACE_FEATURES,
      audioVolume: 0,
    }));
    networkServiceSingleton.toggleCamera(false);

    // 2. Fully shut down microphone hardware sharing, audio processing, and lip-sync
    audioServiceSingleton.setMute(true);
    audioServiceSingleton.stop();
    setIsMicActive(false);
    setHasMicPermission(false);
    networkServiceSingleton.setLocalAudioStream(null);

    // 3. Hang up and cancel WebRTC room call, disconnect sockets/peer mesh
    networkServiceSingleton.cleanup();

    // 4. Exit fullscreen if active
    if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    // 5. Reset room state
    setIsInRoom(false);
    setRoom(null);
    setCurrentUser(null);
    setMessages([]);
    setMediaState(INITIAL_MEDIA_STATE);

    if (typeof window !== 'undefined') {
      const basePath = getBasePath();
      const targetHash = '#lobby';
      if (window.location.hash !== targetHash) {
        window.history.replaceState({ screen: 'lobby' }, '', `${basePath}/${targetHash}`);
      }
    }

    if (noticeMessage) {
      addToast(noticeMessage, 'info');
    }
  }, [addToast, getBasePath]);

  // 2. Set up Network Service listeners
  useEffect(() => {
    networkServiceSingleton.onRoomJoined = (joinedRoom, user) => {
      setRoom(joinedRoom);
      setCurrentUser(user);
      setIsInRoom(true);
      setMediaState(networkServiceSingleton.currentMediaState);
      addToast(`Bienvenido al espacio ${joinedRoom.id.toUpperCase()}`, 'success');
    };

    networkServiceSingleton.onUserJoined = (user, participants) => {
      setRoom((prev) => (prev ? { ...prev, participants } : null));
      audioServiceSingleton.playJoinSound();
      addToast(`${user.name} se ha unido al espacio`, 'info');
    };

    networkServiceSingleton.onUserLeft = (userId, participants) => {
      setRoom((prev) => (prev ? { ...prev, participants } : null));
      setPeerFeaturesMap((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
      addToast('Un participante ha salido del espacio', 'info');
    };

    networkServiceSingleton.onUserUpdated = (updatedUser) => {
      setRoom((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === updatedUser.id ? updatedUser : p
          ),
        };
      });
      setCurrentUser((prev) => (prev && prev.id === updatedUser.id ? updatedUser : prev));
    };

    networkServiceSingleton.onPeerFaceData = (userId, features) => {
      setPeerFeaturesMap((prev) => {
        const next = new Map(prev);
        next.set(userId, features);
        return next;
      });
    };

    networkServiceSingleton.onChatMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    networkServiceSingleton.onRoomLockChanged = (isLocked) => {
      setRoom((prev) => (prev ? { ...prev, isLocked } : null));
      addToast(
        isLocked
          ? 'El administrador ha bloqueado el acceso al espacio'
          : 'El administrador ha desbloqueado el espacio',
        'warning'
      );
    };

    networkServiceSingleton.onForceMute = (isMuted) => {
      setIsAdminMuted(isMuted);
      if (isMuted) {
        // Admin muted the participant: turn off local mic immediately
        setIsMicActive(false);
        audioServiceSingleton.setMute(true);
        networkServiceSingleton.toggleMute(true);
        setCurrentUser((prev) => (prev ? { ...prev, isMuted: true } : null));
        setRoom((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            isAllMuted: true,
            participants: prev.participants.map((p) =>
              p.id === networkServiceSingleton.currentUser?.id ? { ...p, isMuted: true } : p
            ),
          };
        });
        addToast(
          'El administrador ha silenciado los micrófonos de la sala. Tu micrófono ha sido cerrado y bloqueado.',
          'warning'
        );
      } else {
        setIsAdminMuted(false);
        setRoom((prev) => (prev ? { ...prev, isAllMuted: false } : prev));
        addToast(
          'El administrador ha desbloqueado los micrófonos. Ya puedes activar tu micrófono cuando lo desees.',
          'info'
        );
      }
    };

    networkServiceSingleton.onMediaStateChanged = (nextMedia) => {
      setMediaState(nextMedia);
    };

    networkServiceSingleton.onWhiteboardStroke = (stroke) => {
      setRemoteStroke(stroke);
    };

    networkServiceSingleton.onWhiteboardClear = () => {
      setRemoteClearTimestamp(Date.now());
    };

    networkServiceSingleton.onKicked = (reason) => {
      terminateRoomAndMedia(reason || 'Has sido expulsado del espacio por el administrador');
    };

    networkServiceSingleton.onRoomClosed = (reason) => {
      terminateRoomAndMedia(reason || 'El administrador ha abandonado el espacio. La sala se ha cerrado y la llamada ha finalizado.');
    };

    networkServiceSingleton.onError = (errMsg) => {
      addToast(errMsg, 'warning');
    };

    return () => {
      networkServiceSingleton.cleanup();
    };
  }, [addToast, terminateRoomAndMedia]);

  // Window / tab unload safety: release camera/mic and cancel call immediately
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
      }
      audioServiceSingleton.stop();
      networkServiceSingleton.cleanup();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Synchronize browser URL (#lobby, #espacio/nombre, /)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const basePath = getBasePath();

    if (!authenticatedUser) {
      const rootPath = `${basePath}/`;
      if (window.location.hash || window.location.pathname !== rootPath) {
        window.history.replaceState(null, '', rootPath);
      }
    } else if (isInRoom && room?.id) {
      const roomSlug = encodeURIComponent(room.id);
      const targetHash = `#espacio/${roomSlug}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState({ screen: 'room', roomId: room.id }, '', `${basePath}/${targetHash}`);
      }
    } else {
      const targetHash = '#lobby';
      if (window.location.hash !== targetHash) {
        window.history.replaceState({ screen: 'lobby' }, '', `${basePath}/${targetHash}`);
      }
    }
  }, [authenticatedUser, isInRoom, room?.id, getBasePath]);

  // Handle browser back / forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const hash = window.location.hash;
      if (hash === '#lobby' || hash === '' || !hash) {
        if (isInRoom) {
          terminateRoomAndMedia('Has regresado al lobby. Llamada finalizada y dispositivos liberados.');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isInRoom, terminateRoomAndMedia]);

  // Handle Login
  const handleLogin = (user: AuthenticatedUser) => {
    setAuthenticatedUser(user);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('xstreamx_auth', JSON.stringify(user));
      if (user.avatarId) {
        localStorage.setItem(`xstreamx_selected_avatar_${user.username.toLowerCase()}`, user.avatarId);
        localStorage.setItem('xstreamx_selected_avatar', user.avatarId);
      }
      const basePath = getBasePath();
      window.history.replaceState({ screen: 'lobby' }, '', `${basePath}/#lobby`);
    }
    if (user.username) {
      avatarModelServiceSingleton.syncUserCloudAvatars(user.username).catch(() => {});
    }
    addToast(`Sesión iniciada como ${user.name} (${user.role === 'admin' ? 'Admin' : 'Participante'})`, 'success');
  };

  // Handle Logout
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('xstreamx_auth');
      const basePath = getBasePath();
      window.history.replaceState(null, '', `${basePath}/`);
    }
    handleLeaveCall();
    setAuthenticatedUser(null);
    addToast('Sesión cerrada correctamente', 'info');
  };

  // Change dynamic tracking mode in real time
  const handleSelectTrackingMode = useCallback((mode: DynamicTrackingMode) => {
    setTrackingMode(mode);
    trackingModeRef.current = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('xstreamx_tracking_mode', mode);
    }
    networkServiceSingleton.updateTrackingMode(mode);
    setLocalFeatures((prev) => {
      const active = applyDynamicMode(
        prev,
        mode,
        trackingSensitivityRef.current,
        cameraOffsetXRef.current,
        cameraOffsetYRef.current,
        activeGestureRef.current
      );
      networkServiceSingleton.broadcastFaceData(active);
      return prev;
    });
  }, []);

  // Quick gesture trigger handler (broadcasts instant pose update to all call peers)
  const handleTriggerGesture = useCallback((gesture: QuickGestureType) => {
    setActiveGesture((prev) => {
      const next = (prev === gesture || gesture === 'neutral') ? null : gesture;
      activeGestureRef.current = next;
      setLocalFeatures((currentFeatures) => {
        const active = applyDynamicMode(
          currentFeatures,
          trackingModeRef.current,
          trackingSensitivityRef.current,
          cameraOffsetXRef.current,
          cameraOffsetYRef.current,
          next
        );
        networkServiceSingleton.broadcastFaceData(active);
        return currentFeatures;
      });
      return next;
    });
  }, []);

  // Handle joining room from lobby with all selected options preserved & activated
  const handleJoinRoom = async ({
    userName,
    roomId,
    avatarId,
    createAsAdmin,
    isMicActive: requestedMicActive = false,
    isCameraActive: requestedCameraActive = false,
    trackingMode: requestedTrackingMode = 'hybrid',
    cameraOffsetX: requestedOffsetX = 0,
    cameraOffsetY: requestedOffsetY = 0,
    trackingSensitivity: requestedSensitivity = 1.0,
    showTrackingPip: requestedTrackingPip = true,
  }: {
    userName: string;
    roomId: string;
    avatarId: AvatarId;
    createAsAdmin: boolean;
    isMicActive?: boolean;
    isCameraActive?: boolean;
    trackingMode?: DynamicTrackingMode;
    cameraOffsetX?: number;
    cameraOffsetY?: number;
    trackingSensitivity?: number;
    showTrackingPip?: boolean;
  }) => {
    // 1. Apply and respect selected microphone state from lobby
    if (requestedMicActive) {
      const activeStream = audioServiceSingleton.getStream();
      const hasLiveTracks =
        activeStream &&
        activeStream.getAudioTracks().some((t) => t.readyState === 'live');

      if (!hasLiveTracks) {
        const ok = await startMic(true);
        if (!ok) {
          addToast('No se pudo acceder al micrófono. Ingresando en modo silenciado.', 'warning');
        }
      }
      setIsMicActive(true);
      audioServiceSingleton.setMute(false);
      audioServiceSingleton.ensureResumed();
      networkServiceSingleton.toggleMute(false);
    } else {
      setIsMicActive(false);
      audioServiceSingleton.setMute(true);
      networkServiceSingleton.toggleMute(true);
    }

    // 2. Apply and respect selected camera state from lobby
    if (requestedCameraActive) {
      if (!cameraStreamRef.current || !cameraStreamRef.current.active) {
        await startCamera();
      } else {
        setIsCameraActive(true);
        networkServiceSingleton.toggleCamera(true);
        if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
      }
    } else if (!requestedCameraActive && cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraStream(null);
      setIsCameraActive(false);
      faceTrackerSingleton.stopTracking();
      networkServiceSingleton.toggleCamera(false);
    }

    // 3. Save tracking parameters & calibration preferences
    setTrackingMode(requestedTrackingMode);
    trackingModeRef.current = requestedTrackingMode;
    setCameraOffsetX(requestedOffsetX);
    cameraOffsetXRef.current = requestedOffsetX;
    setCameraOffsetY(requestedOffsetY);
    cameraOffsetYRef.current = requestedOffsetY;
    setTrackingSensitivity(requestedSensitivity);
    trackingSensitivityRef.current = requestedSensitivity;
    setIsTrackingPipVisible(requestedTrackingPip);

    // 4. Join network room with exact user options activated
    networkServiceSingleton.joinRoom(roomId, userName, avatarId, createAsAdmin, {
      isMuted: !requestedMicActive,
      isCameraActive: requestedCameraActive,
      trackingMode: requestedTrackingMode,
    });
  };

  // Toggle Microphone - Blocked if admin has muted all / user
  const handleToggleMic = async () => {
    if ((isAdminMuted || room?.isAllMuted) && currentUser?.role !== 'admin') {
      addToast(
        'El administrador ha silenciado los micrófonos de la sala. No puedes activar tu micrófono hasta que el administrador desactive esta opción.',
        'warning'
      );
      return;
    }
    const activeStream = audioServiceSingleton.getStream();
    const hasLiveTracks = activeStream && activeStream.getAudioTracks().some((t) => t.readyState === 'live');
    if (!hasMicPermission || !hasLiveTracks) {
      const granted = await startMic(true);
      if (!granted) return;
      setIsMicActive(true);
      audioServiceSingleton.ensureResumed();
      audioServiceSingleton.setMute(false);
      networkServiceSingleton.toggleMute(false);
      setCurrentUser((prev) => (prev ? { ...prev, isMuted: false } : null));
      setRoom((prev) => {
        if (!prev || !currentUser) return prev;
        return {
          ...prev,
          participants: prev.participants.map((p) =>
            p.id === currentUser.id ? { ...p, isMuted: false } : p
          ),
        };
      });
      return;
    }
    const nextState = !isMicActive;
    setIsMicActive(nextState);
    if (nextState) {
      audioServiceSingleton.ensureResumed();
    }
    audioServiceSingleton.setMute(!nextState);
    networkServiceSingleton.toggleMute(!nextState);
    setCurrentUser((prev) => (prev ? { ...prev, isMuted: !nextState } : null));
    setRoom((prev) => {
      if (!prev || !currentUser) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === currentUser.id ? { ...p, isMuted: !nextState } : p
        ),
      };
    });
  };

  // Toggle Camera / Face Detection (Safe toggle with complete hardware release)
  const handleToggleCamera = async () => {
    if (isCameraActive) {
      // 1. Cleanly disable camera and release hardware device lock
      setIsCameraActive(false);
      faceTrackerSingleton.stopTracking();
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      setCameraStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setLandmarks(null);
      setLocalFeatures((prev) => ({
        ...INITIAL_FACE_FEATURES,
        audioVolume: prev.audioVolume,
      }));
      networkServiceSingleton.toggleCamera(false);
    } else {
      // 2. User explicitly requested camera activation
      if (!isModelReady) {
        try {
          const loaded = await faceTrackerSingleton.initialize();
          setIsModelReady(loaded);
        } catch (e) {
          console.warn('[App] MediaPipe load on demand warning:', e);
        }
      }
      const success = await startCamera();
      if (success) {
        setIsCameraActive(true);
        networkServiceSingleton.toggleCamera(true);
      }
    }
  };

  // Select Avatar in real time
  const handleSelectAvatar = (avatarId: AvatarId) => {
    if (currentUser) {
      setCurrentUser((prev) => (prev ? { ...prev, avatarId } : null));
    }
    networkServiceSingleton.updateAvatar(avatarId);
  };

  // Chat message send
  const handleSendMessage = (text: string, reaction?: string) => {
    networkServiceSingleton.sendChatMessage(text, reaction);
  };

  // Admin controls
  const handleAdminMute = (targetUserId: string, state: boolean) => {
    networkServiceSingleton.adminMuteUser(targetUserId, state);
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === targetUserId ? { ...p, isMuted: state } : p
        ),
      };
    });
    addToast(state ? 'Participante silenciado' : 'Micrófono de participante reactivado', 'info');
  };

  const handleAdminKick = (targetUserId: string) => {
    networkServiceSingleton.adminKickUser(targetUserId);
    addToast('Participante expulsado del espacio', 'info');
  };

  const handleToggleLock = (locked: boolean) => {
    networkServiceSingleton.adminToggleLock(locked);
  };

  const handleMuteAll = () => {
    if (!room || !currentUser) return;
    const isCurrentlyAllMuted = !!room.isAllMuted;
    const targetMuteState = !isCurrentlyAllMuted;

    networkServiceSingleton.adminMuteAll(targetMuteState);
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        isAllMuted: targetMuteState,
        participants: prev.participants.map((p) =>
          p.role !== 'admin' && p.id !== currentUser.id
            ? { ...p, isMuted: targetMuteState }
            : p
        ),
      };
    });
    addToast(
      targetMuteState
        ? 'Todos los participantes han sido silenciados y sus micrófonos han sido bloqueados'
        : 'Micrófonos de la sala desbloqueados y reactivados',
      targetMuteState ? 'warning' : 'info'
    );
  };

  // Leave room (cancels call, turns off camera & mic sharing completely)
  const handleLeaveCall = () => {
    terminateRoomAndMedia('Has salido del espacio. Llamada finalizada y dispositivos liberados.');
  };

  // Media Theater Actions
  const handleAddMediaQueueItem = useCallback((item: VideoQueueItem) => {
    networkServiceSingleton.addMediaQueueItem(item);
  }, []);

  const handleRemoveMediaQueueItem = useCallback((itemId: string) => {
    networkServiceSingleton.removeMediaQueueItem(itemId);
  }, []);

  const handleSkipMedia = useCallback(() => {
    networkServiceSingleton.skipCurrentMedia();
  }, []);

  const handlePlayQueueItemNow = useCallback((itemId: string) => {
    networkServiceSingleton.playQueueItemNow(itemId);
  }, []);

  const handleToggleMediaPlayback = useCallback((isPlaying: boolean, currentTime: number) => {
    networkServiceSingleton.toggleMediaPlayback(isPlaying, currentTime);
  }, []);

  const handleSeekMedia = useCallback((currentTime: number) => {
    networkServiceSingleton.seekMedia(currentTime);
  }, []);

  const handleRequestMediaSync = useCallback(() => {
    networkServiceSingleton.requestMediaSync();
  }, []);

  const handleReorderMediaQueue = useCallback((newQueue: VideoQueueItem[]) => {
    networkServiceSingleton.reorderMediaQueue(newQueue);
  }, []);

  const handleBroadcastStroke = useCallback((stroke: WhiteboardStroke) => {
    networkServiceSingleton.broadcastWhiteboardStroke(stroke);
  }, []);

  const handleBroadcastClear = useCallback(() => {
    networkServiceSingleton.broadcastWhiteboardClear();
  }, []);

  return (
    <div className="flex flex-col h-full h-[100dvh] w-full max-w-full overflow-hidden bg-[#08080a] font-sans antialiased text-neutral-100">
      {/* Master Video for MediaPipe Detection (Kept inside viewport with low opacity to prevent GPU throttling) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '320px',
          height: '240px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -100,
        }}
      />

      {/* Floating Toast Notification Stack */}
      <div className="fixed top-3 sm:top-4 right-3 left-3 sm:left-auto sm:right-4 z-50 flex flex-col items-center sm:items-end gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto max-w-full sm:max-w-md flex items-center gap-2 px-3.5 py-2.5 rounded-xl shadow-2xl text-xs font-semibold backdrop-blur-md border animate-fade-in ${toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-600 text-emerald-200'
                : toast.type === 'warning'
                  ? 'bg-rose-950/90 border-rose-600 text-rose-200'
                  : 'bg-[#0a0d18]/95 border-yellow-500/50 text-yellow-200 shadow-[0_0_15px_rgba(250,204,21,0.2)]'
              }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-yellow-400 shrink-0" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* Screen Routing: Register (/register) -> Login (/) -> Lobby -> Active Room */}
      {currentPath === '/register' ? (
        <Register
          onRegisterSuccess={(newUser) => {
            handleLogin(newUser);
            navigateTo('/');
            addToast(`¡Bienvenido a XStreamX, ${newUser.name}! Tu perfil ha sido creado exitosamente.`, 'success');
          }}
          onNavigateLogin={() => navigateTo('/')}
        />
      ) : !authenticatedUser ? (
        <Login
          onLogin={handleLogin}
          onOpenRegister={() => navigateTo('/register')}
        />
      ) : !isInRoom || !room || !currentUser ? (
        <div className="flex-1 flex flex-col min-h-0">
          <Header
            room={null}
            currentUser={null}
            isAdmin={authenticatedUser.role === 'admin'}
            authUser={authenticatedUser}
            onLogout={handleLogout}
            onOpenProfile={() => setIsProfileModalOpen(true)}
          />
          <Lobby
            onJoinRoom={handleJoinRoom}
            localFeatures={localFeatures}
            isCameraActive={isCameraActive}
            isMicActive={isMicActive}
            onToggleCamera={handleToggleCamera}
            onToggleMic={handleToggleMic}
            isModelReady={isModelReady}
            authUser={authenticatedUser}
            landmarks={landmarks}
            onRequestCamera={startCamera}
            cameraError={cameraError}
            availableCameras={availableCameras}
            onSelectCamera={handleSelectCamera}
            hasMicPermission={hasMicPermission}
            micError={micError}
            onRequestMic={startMic}
            activeGesture={activeGesture}
            onTriggerGesture={handleTriggerGesture}
          />
        </div>
      ) : (
        <RoomView
          room={room}
          currentUser={currentUser}
          localFeatures={applyDynamicMode(
            localFeatures,
            trackingMode,
            trackingSensitivity,
            cameraOffsetX,
            cameraOffsetY,
            activeGesture
          )}
          peerFeaturesMap={peerFeaturesMap}
          trackingMode={trackingMode}
          onSelectTrackingMode={handleSelectTrackingMode}
          cameraOffsetX={cameraOffsetX}
          cameraOffsetY={cameraOffsetY}
          trackingSensitivity={trackingSensitivity}
          initialTrackingPip={isTrackingPipVisible}
          isMicActive={isMicActive}
          isCameraActive={isCameraActive}
          cameraStream={cameraStream}
          messages={messages}
          videoRef={videoRef}
          landmarks={landmarks}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onSelectAvatar={handleSelectAvatar}
          onSendMessage={handleSendMessage}
          onAdminMute={handleAdminMute}
          onAdminKick={handleAdminKick}
          onToggleLock={handleToggleLock}
          onMuteAll={handleMuteAll}
          onLeaveCall={handleLeaveCall}
          authUser={authenticatedUser}
          onLogout={handleLogout}
          activeGesture={activeGesture}
          onTriggerGesture={handleTriggerGesture}
          mediaState={mediaState}
          onAddMediaQueueItem={handleAddMediaQueueItem}
          onRemoveMediaQueueItem={handleRemoveMediaQueueItem}
          onSkipMedia={handleSkipMedia}
          onPlayQueueItemNow={handlePlayQueueItemNow}
          onReorderMediaQueue={handleReorderMediaQueue}
          onToggleMediaPlayback={handleToggleMediaPlayback}
          onSeekMedia={handleSeekMedia}
          onRequestMediaSync={handleRequestMediaSync}
          onBroadcastStroke={handleBroadcastStroke}
          onBroadcastClear={handleBroadcastClear}
          remoteStroke={remoteStroke}
          remoteClearTimestamp={remoteClearTimestamp}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
      )}

      {/* User Profile & Avatars Modal */}
      {authenticatedUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          authUser={authenticatedUser}
          onUserUpdated={(updated) => {
            setAuthenticatedUser(updated);
            sessionStorage.setItem('xstreamx_auth', JSON.stringify(updated));
            addToast('Perfil actualizado correctamente', 'success');
          }}
          onSelectAvatar={handleSelectAvatar}
          currentAvatarId={currentUser?.avatarId}
          onOpenRegister={() => navigateTo('/register')}
        />
      )}
    </div>
  );
}
