import React, { useState, useEffect, useRef } from 'react';
import {
  RoomInfo,
  User,
  FaceFeatures,
  ChatMessage,
  ViewLayoutMode,
  AvatarId,
  RoomMediaState,
  VideoQueueItem,
  WhiteboardStroke,
  DynamicTrackingMode,
} from '../../types';
import { Header } from '../common/Header';
import { ParticipantCard } from './ParticipantCard';
import { CallControls } from './CallControls';
import { ChatSidebar } from './ChatSidebar';
import { CameraPreviewPip } from './CameraPreviewPip';
import { AuthenticatedUser } from '../auth/Login';
import { StarfieldBackground } from '../common/StarfieldBackground';
import { HomeTheaterWindow } from '../theater/HomeTheaterWindow';
import { TvFloatingLauncher } from '../theater/TvFloatingLauncher';
import { QueueModal } from '../theater/QueueModal';
import { WhiteboardPanel } from '../whiteboard/WhiteboardPanel';
import { AdminControlPanel } from './AdminControlPanel';
import { Maximize2, Minimize2, Sliders } from 'lucide-react';
import { QuickGestureType } from '../../services/face3d/dynamicModeHelper';

interface RoomViewProps {
  room: RoomInfo;
  currentUser: User;
  localFeatures: FaceFeatures;
  peerFeaturesMap: Map<string, FaceFeatures>;
  isMicActive: boolean;
  isCameraActive: boolean;
  cameraStream?: MediaStream | null;
  messages: ChatMessage[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
  trackingMode?: DynamicTrackingMode;
  onSelectTrackingMode?: (mode: DynamicTrackingMode) => void;
  cameraOffsetX?: number;
  cameraOffsetY?: number;
  trackingSensitivity?: number;
  initialTrackingPip?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSelectAvatar: (id: AvatarId) => void;
  onSendMessage: (text: string, reaction?: string) => void;
  onAdminMute: (userId: string, state: boolean) => void;
  onAdminKick: (userId: string) => void;
  onToggleLock: (locked: boolean) => void;
  onMuteAll: () => void;
  onLeaveCall: () => void;
  authUser?: AuthenticatedUser | null;
  onLogout?: () => void;
  mediaState: RoomMediaState;
  onAddMediaQueueItem: (item: VideoQueueItem) => void;
  onRemoveMediaQueueItem: (itemId: string) => void;
  onSkipMedia: () => void;
  onPlayQueueItemNow?: (itemId: string) => void;
  onReorderMediaQueue?: (newQueue: VideoQueueItem[]) => void;
  onToggleMediaPlayback: (isPlaying: boolean, currentTime: number) => void;
  onSeekMedia: (currentTime: number) => void;
  onRequestMediaSync?: () => void;
  onBroadcastStroke?: (stroke: WhiteboardStroke) => void;
  onBroadcastClear?: () => void;
  remoteStroke?: WhiteboardStroke | null;
  remoteClearTimestamp?: number;
  activeGesture?: QuickGestureType | null;
  onTriggerGesture?: (gesture: QuickGestureType) => void;
  onOpenProfile?: () => void;
}

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  currentUser,
  localFeatures,
  peerFeaturesMap,
  isMicActive,
  isCameraActive,
  cameraStream,
  messages,
  videoRef,
  landmarks,
  trackingMode = 'hybrid',
  onSelectTrackingMode,
  cameraOffsetX = 0,
  cameraOffsetY = 0,
  trackingSensitivity = 1.0,
  initialTrackingPip = true,
  onToggleMic,
  onToggleCamera,
  onSelectAvatar,
  onSendMessage,
  onAdminMute,
  onAdminKick,
  onToggleLock,
  onMuteAll,
  onLeaveCall,
  authUser,
  onLogout,
  onOpenProfile,
  mediaState,
  onAddMediaQueueItem,
  onRemoveMediaQueueItem,
  onSkipMedia,
  onPlayQueueItemNow,
  onReorderMediaQueue,
  onToggleMediaPlayback,
  onSeekMedia,
  onRequestMediaSync,
  onBroadcastStroke,
  onBroadcastClear,
  remoteStroke,
  remoteClearTimestamp,
  activeGesture,
  onTriggerGesture,
}) => {
  const [viewMode] = useState<ViewLayoutMode>('grid');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTrackingPipVisible, setIsTrackingPipVisible] = useState(() => initialTrackingPip ?? true);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(messages.length);

  // Participant Card Dynamic Sizing (120px to 480px, maintaining strict 1:1 proportion)
  const [cardSize, setCardSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xstreamx_participant_card_size');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 120 && parsed <= 480) return parsed;
      }
    }
    return 280;
  });

  const handleCardSizeChange = (val: number) => {
    const clamped = Math.max(120, Math.min(480, Math.round(val)));
    setCardSize(clamped);
    if (typeof window !== 'undefined') {
      localStorage.setItem('xstreamx_participant_card_size', clamped.toString());
    }
  };

  // Home Theater & Cue Modal States
  const [isTheaterOpen, setIsTheaterOpen] = useState(() => !!(mediaState.currentVideo && mediaState.isPlaying));
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);

  // Automatically open theater for all members whenever an active video starts or changes
  const prevIsPlayingRef = useRef(mediaState.isPlaying);
  useEffect(() => {
    if (mediaState.currentVideo && mediaState.isPlaying && !prevIsPlayingRef.current) {
      setIsTheaterOpen(true);
    }
    prevIsPlayingRef.current = mediaState.isPlaying;
  }, [mediaState.currentVideo?.id, mediaState.isPlaying]);

  const isAdmin = currentUser.role === 'admin';
  const unreadCount = Math.max(0, messages.length - lastReadMessageCount);

  // Queue and turn calculations
  const isUserPlayingNow = mediaState.currentVideo?.addedByUserId === currentUser.id;
  const userQueueIdx = mediaState.queue.findIndex((it) => it.addedByUserId === currentUser.id);
  const userTurnNumber = userQueueIdx !== -1 ? userQueueIdx + 1 : null;
  const hasActiveMedia = !!mediaState.currentVideo || mediaState.queue.length > 0;

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      if (!prev) {
        setLastReadMessageCount(messages.length);
      }
      return !prev;
    });
  };

  // Combine current user with room participants to ensure self is present without duplicates
  const allParticipants = React.useMemo(() => {
    const list: User[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    if (currentUser) {
      seenIds.add(currentUser.id);
      if (currentUser.name) seenNames.add(currentUser.name.trim().toLowerCase());
      list.push(currentUser);
    }

    for (const p of room.participants) {
      if (!p || !p.id) continue;
      const cleanName = (p.name || '').trim().toLowerCase();
      // Skip if it represents currentUser by ID or by name
      if (currentUser && (p.id === currentUser.id || (cleanName && cleanName === currentUser.name.trim().toLowerCase()))) {
        continue;
      }
      if (!seenIds.has(p.id) && (!cleanName || !seenNames.has(cleanName))) {
        seenIds.add(p.id);
        if (cleanName) seenNames.add(cleanName);
        list.push(p);
      }
    }
    return list;
  }, [room.participants, currentUser]);

  // Check if all non-admin participants are muted
  const isAllMuted = React.useMemo(() => {
    if (room.isAllMuted) return true;
    const otherParticipants = allParticipants.filter((p) => p.id !== currentUser.id && p.role !== 'admin');
    if (otherParticipants.length === 0) return false;
    return otherParticipants.every((p) => p.isMuted);
  }, [room.isAllMuted, allParticipants, currentUser.id]);

  return (
    <div className="relative flex flex-col h-full h-[100dvh] w-full max-w-full overflow-hidden bg-[#050508] text-neutral-100 select-none">
      {/* Discreet, smooth cosmic starfield travel background */}
      <StarfieldBackground speed={0.7} starCount={175} opacity={0.55} />

      {/* Top Bar Header (Hidden in Fullscreen mode) */}
      {!isFullscreen && (
        <Header
          room={room}
          currentUser={currentUser}
          onToggleLock={onToggleLock}
          isAdmin={isAdmin}
          authUser={authUser}
          onLogout={onLogout}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          onOpenProfile={onOpenProfile}
        />
      )}

      {/* Main Video Call Stage Layout */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden z-10">
        
        {/* Floating Participant Card Sizing Slider (120px to 480px, maintaining strict 1:1 ratio) */}
        <div className="absolute top-2.5 right-3 sm:right-5 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0a0d14]/90 backdrop-blur-md border border-yellow-500/20 shadow-xl text-xs select-none">
          <Sliders className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span className="text-neutral-300 text-[11px] font-medium hidden sm:inline">Ventanas:</span>
          <input
            type="range"
            min={120}
            max={480}
            step={10}
            value={cardSize}
            onChange={(e) => handleCardSizeChange(Number(e.target.value))}
            className="w-16 sm:w-28 h-1.5 accent-yellow-400 bg-neutral-800 rounded-lg cursor-pointer"
            title={`Dimensionar ventanas de participantes: ${cardSize}px (Mínimo: 120px, Máximo: 480px)`}
          />
          <span className="font-mono text-yellow-300 text-[11px] min-w-[36px] text-right font-bold">
            {cardSize}px
          </span>
          {cardSize !== 280 && (
            <button
              type="button"
              onClick={() => handleCardSizeChange(280)}
              className="text-[10px] text-neutral-400 hover:text-yellow-300 transition cursor-pointer ml-0.5"
              title="Restablecer tamaño predeterminado (280px)"
            >
              ↺
            </button>
          )}
        </div>

        {/* Participant Avatars Viewport */}
        <div className="flex-1 p-2 sm:p-5 overflow-y-auto flex flex-col justify-center">
          
          {/* GRID / MOSAIC VIEW */}
          <div className="w-full flex-1 flex flex-wrap gap-2.5 sm:gap-4 items-center justify-center overflow-y-auto p-1 sm:p-2">
            {allParticipants.map((participant) => {
              const isSelf = participant.id === currentUser.id;
              const features = isSelf ? localFeatures : peerFeaturesMap.get(participant.id) || localFeatures;

              return (
                <ParticipantCard
                  key={participant.id}
                  user={participant}
                  features={features}
                  isSelf={isSelf}
                  isAdmin={isAdmin}
                  cameraOffsetX={isSelf ? cameraOffsetX : 0}
                  cameraOffsetY={isSelf ? cameraOffsetY : 0}
                  trackingMode={isSelf ? trackingMode : participant.trackingMode}
                  onAdminMute={onAdminMute}
                  onAdminKick={onAdminKick}
                  cardSize={cardSize}
                />
              );
            })}
          </div>

        </div>

        {/* Collaborative Whiteboard Canvas - Resizable & Draggable Window */}
        <WhiteboardPanel
          isOpen={isWhiteboardOpen}
          onClose={() => setIsWhiteboardOpen(false)}
          currentUser={currentUser}
          onBroadcastStroke={onBroadcastStroke}
          onBroadcastClear={onBroadcastClear}
          remoteStroke={remoteStroke}
          remoteClearTimestamp={remoteClearTimestamp}
        />

        {/* Live Chat Sidebar */}
        <ChatSidebar
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          currentUser={currentUser}
          onSendMessage={onSendMessage}
        />

      </div>

      {/* Floating Camera Preview PIP (MediaPipe Webcam & Landmark Mesh) */}
      {isTrackingPipVisible && (
        <CameraPreviewPip
          videoRef={videoRef}
          cameraStream={cameraStream}
          features={localFeatures}
          landmarks={landmarks}
          isCameraActive={isCameraActive}
          avatarId={currentUser.avatarId}
        />
      )}

      {/* Synchronized Home Theater Window (Draggable & Resizable 16:9 up to 1024px) */}
      <HomeTheaterWindow
        isOpen={isTheaterOpen}
        onClose={() => setIsTheaterOpen(false)}
        onOpenQueueModal={() => setIsQueueModalOpen(true)}
        mediaState={mediaState}
        currentUserRole={currentUser.role}
        onTogglePlayback={onToggleMediaPlayback}
        onSeek={onSeekMedia}
        onVideoEnded={onSkipMedia}
        onSkip={onSkipMedia}
        onAddVideo={onAddMediaQueueItem}
      />

      {/* Floating TV Launcher Widget (when theater is minimized or closed) */}
      <TvFloatingLauncher
        isVisible={!isTheaterOpen && hasActiveMedia}
        onOpen={() => setIsTheaterOpen(true)}
        mediaState={mediaState}
      />

      {/* YouTube Cue / Playlist Modal with Personal Turn indicator & Item Reordering */}
      <QueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        mediaState={mediaState}
        currentUser={currentUser}
        onAddVideo={onAddMediaQueueItem}
        onRemoveVideo={onRemoveMediaQueueItem}
        onSkipVideo={onSkipMedia}
        onPlayNow={onPlayQueueItemNow}
        onReorderQueue={onReorderMediaQueue}
        onRequestSync={onRequestMediaSync}
      />

      {/* Dedicated Admin Control Panel Modal */}
      {isAdmin && (
        <AdminControlPanel
          room={room}
          currentUser={currentUser}
          isOpen={isAdminPanelOpen}
          onClose={() => setIsAdminPanelOpen(false)}
          onAdminMute={onAdminMute}
          onAdminKick={onAdminKick}
          onToggleLock={onToggleLock}
          onMuteAll={onMuteAll}
          onSelectAvatar={onSelectAvatar}
        />
      )}

      {/* Bottom Controls Bar (Hidden in Fullscreen mode) */}
      {!isFullscreen && (
        <CallControls
          isMicActive={isMicActive}
          isCameraActive={isCameraActive}
          currentAvatarId={currentUser.avatarId}
          trackingMode={trackingMode}
          onSelectTrackingMode={onSelectTrackingMode}
          unreadChatCount={unreadCount}
          isChatOpen={isChatOpen}
          isAdmin={isAdmin}
          onMuteAll={onMuteAll}
          isAllMuted={isAllMuted}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onSelectAvatar={onSelectAvatar}
          onToggleChat={handleToggleChat}
          onLeaveCall={onLeaveCall}
          onOpenTheater={() => setIsTheaterOpen((prev) => !prev)}
          isTheaterOpen={isTheaterOpen}
          onToggleTrackingPip={() => setIsTrackingPipVisible((prev) => !prev)}
          isTrackingPipOpen={isTrackingPipVisible}
          onToggleWhiteboard={() => setIsWhiteboardOpen((prev) => !prev)}
          isWhiteboardOpen={isWhiteboardOpen}
          onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          activeGesture={activeGesture}
          onTriggerGesture={onTriggerGesture}
        />
      )}
    </div>
  );
};
