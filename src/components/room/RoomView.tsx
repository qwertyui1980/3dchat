import React, { useState, useEffect } from 'react';
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
  onToggleMediaPlayback: (isPlaying: boolean, currentTime: number) => void;
  onSeekMedia: (currentTime: number) => void;
  onRequestMediaSync?: () => void;
  onBroadcastStroke?: (stroke: WhiteboardStroke) => void;
  onBroadcastClear?: () => void;
  remoteStroke?: WhiteboardStroke | null;
  remoteClearTimestamp?: number;
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
  mediaState,
  onAddMediaQueueItem,
  onRemoveMediaQueueItem,
  onSkipMedia,
  onToggleMediaPlayback,
  onSeekMedia,
  onRequestMediaSync,
  onBroadcastStroke,
  onBroadcastClear,
  remoteStroke,
  remoteClearTimestamp,
}) => {
  const [viewMode] = useState<ViewLayoutMode>('grid');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(messages.length);

  // Home Theater & Cue Modal States
  const [isTheaterOpen, setIsTheaterOpen] = useState(() => !!mediaState.currentVideo);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);

  // Automatically open theater for all members whenever an active video starts or changes
  useEffect(() => {
    if (mediaState.currentVideo) {
      setIsTheaterOpen(true);
    }
  }, [mediaState.currentVideo?.id]);

  const isAdmin = currentUser.role === 'admin';
  const unreadCount = Math.max(0, messages.length - lastReadMessageCount);

  // Queue and turn calculations
  const isUserPlayingNow = mediaState.currentVideo?.addedByUserId === currentUser.id;
  const userQueueIdx = mediaState.queue.findIndex((it) => it.addedByUserId === currentUser.id);
  const userTurnNumber = userQueueIdx !== -1 ? userQueueIdx + 1 : null;
  const hasActiveMedia = !!mediaState.currentVideo || mediaState.queue.length > 0;

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

      {/* Top Bar Header */}
      <Header
        room={room}
        currentUser={currentUser}
        onToggleLock={onToggleLock}
        isAdmin={isAdmin}
        authUser={authUser}
        onLogout={onLogout}
      />

      {/* Main Video Call Stage Layout */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden z-10">
        
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
                  onAdminMute={onAdminMute}
                  onAdminKick={onAdminKick}
                />
              );
            })}
          </div>

        </div>

        {/* Collaborative Whiteboard Canvas - Placed beside the chat */}
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
      <CameraPreviewPip
        videoRef={videoRef}
        cameraStream={cameraStream}
        features={localFeatures}
        landmarks={landmarks}
        isCameraActive={isCameraActive}
        avatarId={currentUser.avatarId}
      />

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
      />

      {/* Floating TV Launcher Widget (when theater is minimized or closed) */}
      <TvFloatingLauncher
        isVisible={!isTheaterOpen && hasActiveMedia}
        onOpen={() => setIsTheaterOpen(true)}
        mediaState={mediaState}
      />

      {/* YouTube Cue / Playlist Modal with Personal Turn indicator */}
      <QueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
        mediaState={mediaState}
        currentUser={currentUser}
        onAddVideo={onAddMediaQueueItem}
        onRemoveVideo={onRemoveMediaQueueItem}
        onSkipVideo={onSkipMedia}
        onRequestSync={onRequestMediaSync}
      />

      {/* Bottom Controls Bar */}
      <CallControls
        isMicActive={isMicActive}
        isCameraActive={isCameraActive}
        currentAvatarId={currentUser.avatarId}
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
        onOpenPlaylist={() => setIsQueueModalOpen(true)}
        isTheaterOpen={isTheaterOpen}
        isPlaylistOpen={isQueueModalOpen}
        userTurnNumber={userTurnNumber}
        isUserPlayingNow={isUserPlayingNow}
        hasActiveMedia={hasActiveMedia}
        queueCount={mediaState.queue.length}
        onToggleWhiteboard={() => setIsWhiteboardOpen((prev) => !prev)}
        isWhiteboardOpen={isWhiteboardOpen}
      />
    </div>
  );
};
