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
} from './types';
import {
  faceTrackerSingleton,
  INITIAL_FACE_FEATURES,
} from './services/mediapipeService';
import { audioServiceSingleton } from './services/audioService';
import { networkServiceSingleton } from './services/networkService';
import { Header } from './components/common/Header';
import { Lobby } from './components/lobby/Lobby';
import { RoomView } from './components/room/RoomView';
import { Login, AuthenticatedUser } from './components/auth/Login';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning';
  text: string;
}

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

  // App state
  const [isInRoom, setIsInRoom] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Hardware states
  const [isMicActive, setIsMicActive] = useState(true);
  const [isAdminMuted, setIsAdminMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Tracking state
  const [localFeatures, setLocalFeatures] = useState<FaceFeatures>({
    ...INITIAL_FACE_FEATURES,
  });
  const [landmarks, setLandmarks] = useState<Array<{ x: number; y: number; z: number }> | null>(null);
  const [peerFeaturesMap, setPeerFeaturesMap] = useState<Map<string, FaceFeatures>>(new Map());

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
  const startMic = useCallback(async () => {
    try {
      const audioStream = await audioServiceSingleton.start((volume) => {
        faceTrackerSingleton.setAudioVolume(volume);
        setLocalFeatures((prev) => {
          const updated: FaceFeatures = {
            ...prev,
            audioVolume: volume,
          };
          // Broadcast audio-driven lip sync if camera is inactive or no face detected
          if (!cameraStreamRef.current || !prev.isFaceDetected) {
            networkServiceSingleton.broadcastFaceData(updated);
          }
          return updated;
        });
      });

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        networkServiceSingleton.setLocalAudioStream(audioStream);
        setHasMicPermission(true);
        setMicError(null);
        setIsMicActive(true);
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
            setLocalFeatures(features);
            networkServiceSingleton.broadcastFaceData(features);
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

  // 1. Initialize MediaPipe, Camera & Microphone on mount
  useEffect(() => {
    let isMounted = true;

    async function initHardwareAndAI() {
      // Initialize MediaPipe FaceLandmarker
      try {
        const loaded = await faceTrackerSingleton.initialize();
        if (isMounted) {
          setIsModelReady(loaded);
        }
      } catch (e) {
        console.warn('[App] MediaPipe load error, continuing with audio-only fallback:', e);
      }

      // Initialize Webcam (optional, audio lip-sync fallback if denied)
      await startCamera();

      // Initialize Microphone (mandatory to enter room)
      await startMic();
    }

    initHardwareAndAI();

    return () => {
      isMounted = false;
      faceTrackerSingleton.stopTracking();
      audioServiceSingleton.stop();
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [startCamera, startMic]);

  // 2. Set up Network Service listeners
  useEffect(() => {
    networkServiceSingleton.onRoomJoined = (joinedRoom, user) => {
      setRoom(joinedRoom);
      setCurrentUser(user);
      setIsInRoom(true);
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
      setIsMicActive(!isMuted);
      setIsAdminMuted(isMuted);
      audioServiceSingleton.setMute(isMuted);
      addToast(
        isMuted
          ? 'El administrador ha silenciado tu micrófono. No puedes desmutearte hasta que el administrador lo autorice.'
          : 'El administrador ha reactivado tu micrófono',
        isMuted ? 'warning' : 'success'
      );
    };

    networkServiceSingleton.onKicked = (reason) => {
      setIsInRoom(false);
      setRoom(null);
      setCurrentUser(null);
      addToast(reason || 'Has sido expulsado del espacio por el administrador', 'warning');
    };

    networkServiceSingleton.onError = (errMsg) => {
      addToast(errMsg, 'warning');
    };

    return () => {
      networkServiceSingleton.cleanup();
    };
  }, [addToast]);

  // Helper to preserve subpath when hosted on GitHub Pages (e.g. /3dchat)
  const getBasePath = () => {
    if (typeof window === 'undefined') return '';
    return window.location.pathname.startsWith('/3dchat') ? '/3dchat' : '';
  };

  // Synchronize browser URL (/lobby, /espacio/nombre, /)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const basePath = getBasePath();

    if (!authenticatedUser) {
      const rootPath = basePath ? `${basePath}/` : '/';
      const curPath = window.location.pathname;
      if (curPath !== rootPath && curPath !== basePath && curPath !== '/' && curPath !== '') {
        window.history.replaceState(null, '', rootPath);
      }
    } else if (isInRoom && room?.id) {
      const roomSlug = encodeURIComponent(room.id);
      const targetPath = `${basePath}/espacio/${roomSlug}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ screen: 'room', roomId: room.id }, '', targetPath);
      }
    } else {
      const targetPath = `${basePath}/lobby`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ screen: 'lobby' }, '', targetPath);
      }
    }
  }, [authenticatedUser, isInRoom, room?.id]);

  // Handle browser back / forward buttons
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const basePath = getBasePath();

    const handlePopState = () => {
      const path = window.location.pathname;
      if (
        path === `${basePath}/lobby` ||
        path === `${basePath}/` ||
        path === basePath ||
        path === '/lobby' ||
        path === '/'
      ) {
        if (isInRoom) {
          networkServiceSingleton.cleanup();
          setIsInRoom(false);
          setRoom(null);
          setCurrentUser(null);
          setMessages([]);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isInRoom]);

  // Handle Login
  const handleLogin = (user: AuthenticatedUser) => {
    setAuthenticatedUser(user);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('xstreamx_auth', JSON.stringify(user));
      const basePath = getBasePath();
      window.history.pushState({ screen: 'lobby' }, '', `${basePath}/lobby`);
    }
    addToast(`Sesión iniciada como ${user.name} (${user.role === 'admin' ? 'Admin' : 'Participante'})`, 'success');
  };

  // Handle Logout
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('xstreamx_auth');
      const basePath = getBasePath();
      window.history.replaceState(null, '', basePath ? `${basePath}/` : '/');
    }
    handleLeaveCall();
    setAuthenticatedUser(null);
    addToast('Sesión cerrada correctamente', 'info');
  };

  // Handle joining room from lobby
  const handleJoinRoom = ({
    userName,
    roomId,
    avatarId,
    createAsAdmin,
  }: {
    userName: string;
    roomId: string;
    avatarId: AvatarId;
    createAsAdmin: boolean;
  }) => {
    networkServiceSingleton.joinRoom(roomId, userName, avatarId, createAsAdmin);
  };

  // Toggle Microphone
  const handleToggleMic = () => {
    if (isAdminMuted && authenticatedUser?.role !== 'admin') {
      addToast(
        'Has sido silenciado por el administrador. Solo el administrador puede reactivar tu micrófono.',
        'warning'
      );
      return;
    }
    if (!hasMicPermission) {
      startMic();
      return;
    }
    const nextState = !isMicActive;
    setIsMicActive(nextState);
    audioServiceSingleton.setMute(!nextState);
    networkServiceSingleton.toggleMute(!nextState);
  };

  // Toggle Camera / Face Detection
  const handleToggleCamera = async () => {
    const nextState = !isCameraActive;
    setIsCameraActive(nextState);

    if (!nextState) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
    } else {
      if (cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().length > 0) {
        cameraStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = true;
        });
      } else {
        await startCamera();
      }
    }
    networkServiceSingleton.toggleCamera(nextState);
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
    const otherParticipants = room.participants.filter(
      (p) => p.id !== currentUser.id && p.role !== 'admin'
    );
    const isCurrentlyAllMuted =
      otherParticipants.length > 0 && otherParticipants.every((p) => p.isMuted);
    const targetMuteState = !isCurrentlyAllMuted;

    networkServiceSingleton.adminMuteAll(targetMuteState);
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        participants: prev.participants.map((p) =>
          p.role !== 'admin' && p.id !== currentUser.id
            ? { ...p, isMuted: targetMuteState }
            : p
        ),
      };
    });
    addToast(
      targetMuteState
        ? 'Todos los participantes han sido silenciados por el administrador'
        : 'Micrófonos de los participantes reactivados',
      'info'
    );
  };

  // Leave room
  const handleLeaveCall = () => {
    networkServiceSingleton.cleanup();
    setIsInRoom(false);
    setRoom(null);
    setCurrentUser(null);
    setMessages([]);
    if (typeof window !== 'undefined') {
      const basePath = getBasePath();
      const targetPath = `${basePath}/lobby`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ screen: 'lobby' }, '', targetPath);
      }
    }
    addToast('Has salido del espacio', 'info');
  };

  return (
    <div className="flex flex-col h-full h-[100dvh] w-full max-w-full overflow-hidden bg-[#08080a] font-sans antialiased text-neutral-100">
      {/* Off-screen Master Video for MediaPipe Detection (Always active, never display:none) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '640px',
          height: '480px',
          opacity: 0,
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
                  : 'bg-slate-900/90 border-cyan-700 text-cyan-200'
              }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'warning' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-cyan-400 shrink-0" />}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>

      {/* Screen Routing: Login -> Lobby -> Active Room */}
      {!authenticatedUser ? (
        <Login onLogin={handleLogin} />
      ) : !isInRoom || !room || !currentUser ? (
        <div className="flex-1 flex flex-col min-h-0">
          <Header
            room={null}
            currentUser={null}
            isAdmin={authenticatedUser.role === 'admin'}
            authUser={authenticatedUser}
            onLogout={handleLogout}
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
          />
        </div>
      ) : (
        <RoomView
          room={room}
          currentUser={currentUser}
          localFeatures={localFeatures}
          peerFeaturesMap={peerFeaturesMap}
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
        />
      )}
    </div>
  );
}
