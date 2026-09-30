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
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);

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
  const demoIntervalRef = useRef<NodeJS.Timeout | number | null>(null);

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

  const stopDemoSimulation = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
  }, []);

  // Simulation mode fallback if no physical webcam
  const startDemoSimulation = useCallback(() => {
    if (demoIntervalRef.current) return;

    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.05;
      const simFeatures: FaceFeatures = {
        pitch: Math.sin(angle * 0.7) * 0.15,
        yaw: Math.cos(angle * 0.5) * 0.25,
        roll: Math.sin(angle * 0.3) * 0.1,
        eyeBlinkLeft: Math.random() < 0.03 ? 1 : 0,
        eyeBlinkRight: Math.random() < 0.03 ? 1 : 0,
        eyeWideLeft: 0,
        eyeWideRight: 0,
        gazeX: Math.cos(angle * 0.5) * 0.3,
        gazeY: Math.sin(angle * 0.4) * 0.2,
        browRaise: (Math.sin(angle * 0.8) + 1) * 0.2,
        browFurrow: 0,
        jawOpen: Math.max(0, Math.sin(angle * 1.5) * 0.3),
        mouthSmile: (Math.cos(angle * 0.4) + 1) * 0.3,
        mouthPucker: 0,
        mouthX: 0,
        audioVolume: 0,
        isFaceDetected: true,
      };
      setLocalFeatures(simFeatures);
      networkServiceSingleton.broadcastFaceData(simFeatures);
    }, 40);

    demoIntervalRef.current = interval;
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

      // Success! Stop simulation and clear any error
      stopDemoSimulation();
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
      console.warn('[App] Webcam not available or permission denied:', camErr);

      const errName = camErr?.name || '';
      const errMsg = (camErr?.message || '').toLowerCase();
      const isDeviceInUse =
        errName === 'NotReadableError' ||
        errMsg.includes('device in use') ||
        errMsg.includes('could not start') ||
        errMsg.includes('concurrent');

      if (isDeviceInUse) {
        const msg = 'Cámara en uso: Otra aplicación (Zoom, Teams, OBS, Discord) o pestaña tiene bloqueada la cámara web.';
        setCameraError(msg);
        addToast('Cámara ocupada por otra app o pestaña. Libérala y pulsa Reintentar.', 'warning');
      } else if (errName === 'NotAllowedError') {
        const msg = 'Permiso de cámara denegado en el navegador.';
        setCameraError(msg);
        addToast('Permiso de cámara denegado.', 'warning');
      } else {
        setCameraError('Cámara no disponible. Verifica la conexión o selecciona otra cámara.');
      }

      await refreshAvailableCameras();
      startDemoSimulation();
      return false;
    } finally {
      isStartingCameraRef.current = false;
    }
  }, [selectedCameraId, stopDemoSimulation, refreshAvailableCameras, addToast, startDemoSimulation]);

  const handleSelectCamera = useCallback(async (deviceId: string) => {
    setSelectedCameraId(deviceId);
    await startCamera(deviceId);
  }, [startCamera]);

  // 1. Initialize MediaPipe & Camera on mount
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
        console.warn('[App] MediaPipe load error, continuing with fallback:', e);
      }

      // Initialize Webcam
      await startCamera();

      // Initialize Microphone & Audio Analysis
      try {
        const audioStream = await audioServiceSingleton.start((volume) => {
          if (isMounted) {
            faceTrackerSingleton.setAudioVolume(volume);
            setLocalFeatures((prev) => ({
              ...prev,
              audioVolume: volume,
            }));
          }
        });

        if (audioStream) {
          networkServiceSingleton.setLocalAudioStream(audioStream);
        }
      } catch (audioErr) {
        console.warn('[App] Mic not available:', audioErr);
      }
    }

    initHardwareAndAI();

    return () => {
      isMounted = false;
      faceTrackerSingleton.stopTracking();
      audioServiceSingleton.stop();
      stopDemoSimulation();
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  // 2. Set up Network Service listeners
  useEffect(() => {
    networkServiceSingleton.onRoomJoined = (joinedRoom, user) => {
      setRoom(joinedRoom);
      setCurrentUser(user);
      setIsInRoom(true);
      addToast(`Bienvenido a la sala ${joinedRoom.id.toUpperCase()}`, 'success');
    };

    networkServiceSingleton.onUserJoined = (user, participants) => {
      setRoom((prev) => (prev ? { ...prev, participants } : null));
      addToast(`${user.name} se ha unido a la sala`, 'info');
    };

    networkServiceSingleton.onUserLeft = (userId, participants) => {
      setRoom((prev) => (prev ? { ...prev, participants } : null));
      setPeerFeaturesMap((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
      addToast('Un participante ha salido de la sala', 'info');
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
          ? 'El administrador ha bloqueado el acceso a la sala'
          : 'El administrador ha desbloqueado la sala',
        'warning'
      );
    };

    networkServiceSingleton.onForceMute = (isMuted) => {
      setIsMicActive(!isMuted);
      audioServiceSingleton.setMute(isMuted);
      addToast('El administrador ha silenciado tu micrófono', 'warning');
    };

    networkServiceSingleton.onKicked = (reason) => {
      setIsInRoom(false);
      setRoom(null);
      setCurrentUser(null);
      addToast(reason || 'Has sido expulsado de la sala por el administrador', 'warning');
    };

    networkServiceSingleton.onError = (errMsg) => {
      addToast(errMsg, 'warning');
    };

    return () => {
      networkServiceSingleton.cleanup();
    };
  }, [addToast]);

  // Handle Login
  const handleLogin = (user: AuthenticatedUser) => {
    setAuthenticatedUser(user);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('xstreamx_auth', JSON.stringify(user));
    }
    addToast(`Sesión iniciada como ${user.name} (${user.role === 'admin' ? 'Admin' : 'Participante'})`, 'success');
  };

  // Handle Logout
  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('xstreamx_auth');
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
  };

  const handleAdminKick = (targetUserId: string) => {
    networkServiceSingleton.adminKickUser(targetUserId);
  };

  const handleToggleLock = (locked: boolean) => {
    networkServiceSingleton.adminToggleLock(locked);
  };

  const handleMuteAll = () => {
    if (!room || !currentUser) return;
    room.participants.forEach((p) => {
      if (p.id !== currentUser.id) {
        networkServiceSingleton.adminMuteUser(p.id, true);
      }
    });
    addToast('Todos los participantes han sido silenciados', 'info');
  };

  // Leave room
  const handleLeaveCall = () => {
    networkServiceSingleton.cleanup();
    setIsInRoom(false);
    setRoom(null);
    setCurrentUser(null);
    setMessages([]);
    addToast('Has salido de la sala', 'info');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">
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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold backdrop-blur-md border animate-fade-in ${toast.type === 'success'
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
            cameraStream={cameraStream}
            landmarks={landmarks}
            onRequestCamera={startCamera}
            cameraError={cameraError}
            availableCameras={availableCameras}
            onSelectCamera={handleSelectCamera}
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
