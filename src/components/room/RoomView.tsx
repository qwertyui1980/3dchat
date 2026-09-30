import React, { useState } from 'react';
import { RoomInfo, User, FaceFeatures, ChatMessage, ViewLayoutMode, AvatarId } from '../../types';
import { Header } from '../common/Header';
import { ParticipantCard } from './ParticipantCard';
import { CallControls } from './CallControls';
import { ChatSidebar } from './ChatSidebar';
import { CameraPreviewPip } from './CameraPreviewPip';
import { AuthenticatedUser } from '../auth/Login';

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
}) => {
  const [viewMode] = useState<ViewLayoutMode>('grid');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(messages.length);

  const isAdmin = currentUser.role === 'admin';
  const unreadCount = Math.max(0, messages.length - lastReadMessageCount);

  const handleToggleChat = () => {
    setIsChatOpen((prev) => {
      if (!prev) {
        setLastReadMessageCount(messages.length);
      }
      return !prev;
    });
  };

  // Combine current user with room participants to ensure self is present
  const allParticipants = React.useMemo(() => {
    const list = [...room.participants];
    if (!list.find((p) => p.id === currentUser.id)) {
      list.unshift(currentUser);
    }
    return list;
  }, [room.participants, currentUser]);

  return (
    <div className="flex flex-col h-full h-[100dvh] w-full max-w-full overflow-hidden bg-slate-950 text-slate-100 select-none">
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
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        
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

      {/* Bottom Controls Bar (Cleaned without Cuadrícula or Panel Moderador) */}
      <CallControls
        isMicActive={isMicActive}
        isCameraActive={isCameraActive}
        currentAvatarId={currentUser.avatarId}
        unreadChatCount={unreadCount}
        isChatOpen={isChatOpen}
        onToggleMic={onToggleMic}
        onToggleCamera={onToggleCamera}
        onSelectAvatar={onSelectAvatar}
        onToggleChat={handleToggleChat}
        onLeaveCall={onLeaveCall}
      />
    </div>
  );
};
