import React, { useState, useRef } from 'react';
import { Shield, Mic, MicOff, X, Maximize2, GripHorizontal } from 'lucide-react';
import { User, FaceFeatures, DynamicTrackingMode } from '../../types';
import { AvatarCanvas } from '../avatars/AvatarCanvas';
import { AudioWaveform } from '../common/AudioWaveform';
import { normalizeTrackingMode } from '../../services/face3d/dynamicModeHelper';
import { networkServiceSingleton } from '../../services/networkService';

interface ParticipantCardProps {
  user: User;
  features: FaceFeatures;
  isSelf: boolean;
  isAdmin: boolean;
  isFocusSpeaker?: boolean;
  cameraOffsetX?: number;
  cameraOffsetY?: number;
  trackingMode?: DynamicTrackingMode;
  onFocusClick?: () => void;
  onAdminMute?: (userId: string, state: boolean) => void;
  onAdminKick?: (userId: string) => void;
  cardSize?: number;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  user,
  features,
  isSelf,
  isAdmin,
  isFocusSpeaker = false,
  cameraOffsetX = 0,
  cameraOffsetY = 0,
  trackingMode,
  onFocusClick,
  onAdminMute,
  onAdminKick,
  cardSize = 280,
}) => {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only allow drag if not clicking buttons or interactive elements
    if ((e.target as HTMLElement).closest('button, input, a')) return;

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: offset.x,
      initY: offset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setOffset({
      x: dragStartRef.current.initX + dx,
      y: dragStartRef.current.initY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const activeMode = normalizeTrackingMode(isSelf ? (trackingMode || 'parafernalia') : (user.trackingMode || 'parafernalia'));
  const isSpeaking = (features.audioVolume > 0.18 || false) && !user.isMuted && activeMode !== 'gestures';
  const effectiveFeatures = React.useMemo(() => {
    if (user.isMuted || activeMode === 'gestures') {
      return { ...features, audioVolume: 0 };
    }
    return features;
  }, [features, user.isMuted, activeMode]);

  // Request remote 3D model automatically if participant is using a custom avatar not yet in local storage
  React.useEffect(() => {
    if (!isSelf && user.avatarId) {
      networkServiceSingleton.checkAndFetchMissingAvatar(user);
    }
  }, [isSelf, user.avatarId, user.id]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        touchAction: 'none',
        width: `${cardSize}px`,
        height: `${cardSize}px`,
        aspectRatio: '1 / 1',
      }}
      className={`group relative shrink-0 rounded-2xl bg-[#08080c] border transition-[shadow,border-color] duration-200 overflow-hidden shadow-2xl select-none ${
        isDragging ? 'z-40 ring-2 ring-yellow-400 shadow-yellow-950/60 cursor-grabbing' : 'cursor-grab'
      } ${
        isFocusSpeaker
          ? 'border-yellow-400 ring-2 ring-yellow-400/40 shadow-lg shadow-yellow-500/20'
          : 'border-white/[0.08] hover:border-blue-500/40'
      }`}
    >
      {/* Avatar Canvas Rendering */}
      <AvatarCanvas
        avatarId={user.avatarId}
        userId={user.id}
        features={effectiveFeatures}
        userName=""
        isSpeaking={isSpeaking}
        cameraOffsetX={isSelf ? cameraOffsetX : 0}
        cameraOffsetY={isSelf ? cameraOffsetY : 0}
        trackingMode={activeMode}
        className="w-full h-full"
      />

      {/* Top Bar inside Card */}
      <div className="absolute top-2 inset-x-2 sm:top-2.5 sm:inset-x-2.5 flex items-center justify-between z-10 gap-1">
        {/* Left: Mode / Voice status badge (visible on widths >= 160px) */}
        {cardSize >= 160 ? (
          <div className="flex items-center gap-1.5 shrink-0">
            {activeMode === 'gestures' ? (
              <span
                className="px-1.5 py-0.5 rounded-md bg-blue-950/80 text-blue-300 border border-blue-500/40 text-[10px] font-mono shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                title="Modo Reconocimiento de Gestos • Visión 100% Cámara"
              >
                Gestos
              </span>
            ) : activeMode === 'lipsync' ? (
              <span
                className="px-1.5 py-0.5 rounded-md bg-rose-950/80 text-rose-300 border border-rose-500/40 text-[10px] font-mono shadow-[0_0_8px_rgba(244,63,94,0.3)]"
                title="Modo Lip Sync • Máscara estática y boca por audio"
              >
                Lip Sync
              </span>
            ) : (
              <span
                className="px-1.5 py-0.5 rounded-md bg-yellow-950/80 text-yellow-300 border border-yellow-500/40 text-[10px] font-mono shadow-[0_0_8px_rgba(250,204,21,0.3)]"
                title="Modo Parafernalia • Ritmo de voz, gestos y zoom dinámico"
              >
                Parafernalia
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Right: Name Badge & Admin Direct Controls (Mic & X) */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-[70%] justify-end">
          {/* User Name Badge in Top-Right */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#08080c]/90 backdrop-blur-md border border-white/[0.08] text-xs text-white shadow-md truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                user.isMuted
                  ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                  : isSpeaking
                  ? 'bg-yellow-400 animate-ping shadow-[0_0_6px_#ffe600]'
                  : features.isFaceDetected
                  ? 'bg-blue-400 shadow-[0_0_6px_#60a5fa]'
                  : 'bg-neutral-600'
              }`}
            />
            <span className="font-semibold truncate text-[11px] sm:text-xs">{user.name}</span>
          </div>

          {/* Admin Direct Mute Button for this user */}
          {isAdmin && !isSelf && onAdminMute && (
            <button
              type="button"
              onClick={() => onAdminMute(user.id, !user.isMuted)}
              title={user.isMuted ? 'Desmutear participante' : 'Silenciar micrófono de este participante'}
              className={`p-1.5 rounded-lg border backdrop-blur-md transition active:scale-95 cursor-pointer shrink-0 ${
                user.isMuted
                  ? 'bg-rose-950/80 border-rose-600/70 text-rose-300 hover:bg-rose-900 shadow-md shadow-rose-950/30'
                  : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-300 hover:text-rose-300 hover:border-rose-700 hover:bg-neutral-800'
              }`}
            >
              {user.isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Admin Direct Kick/Remove Button (X) */}
          {isAdmin && !isSelf && onAdminKick && (
            <button
              type="button"
              onClick={() => onAdminKick(user.id)}
              title="Expulsar a este participante del espacio"
              className="p-1.5 rounded-lg bg-neutral-900/90 hover:bg-rose-950/80 text-neutral-400 hover:text-rose-300 border border-neutral-700/80 hover:border-rose-700/80 transition active:scale-95 backdrop-blur-md cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Focus Speaker Button */}
          {onFocusClick && (
            <button
              type="button"
              onClick={onFocusClick}
              title="Fijar en pantalla principal"
              className="p-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition backdrop-blur-md opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Bar: Real-time Audio Waveform graphic (visible when width >= 180px) */}
      {cardSize >= 180 && (
        <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
          <div className="flex items-center px-2 py-1 rounded-lg bg-[#08080c]/85 backdrop-blur-md border border-white/[0.06] shadow-md">
            <AudioWaveform
              volume={features.audioVolume || 0}
              isMuted={user.isMuted}
              color={user.isMuted ? '#f43f5e' : '#ffe600'}
              width={68}
              height={22}
            />
          </div>
        </div>
      )}
    </div>
  );
};
