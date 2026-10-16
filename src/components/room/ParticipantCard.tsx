import React, { useState, useRef } from 'react';
import { Shield, Mic, MicOff, X, Maximize2, GripHorizontal } from 'lucide-react';
import { User, FaceFeatures, DynamicTrackingMode } from '../../types';
import { AvatarCanvas } from '../avatars/AvatarCanvas';
import { AudioWaveform } from '../common/AudioWaveform';
import { normalizeTrackingMode } from '../../services/face3d/dynamicModeHelper';

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

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        touchAction: 'none',
      }}
      className={`group relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] shrink-0 rounded-2xl bg-[#08080c] border transition-shadow duration-200 overflow-hidden shadow-2xl select-none ${
        isDragging ? 'z-40 ring-2 ring-cyan-400 shadow-cyan-950/60 cursor-grabbing' : 'cursor-grab'
      } ${
        isFocusSpeaker
          ? 'border-cyan-500/80 ring-1 ring-cyan-500/30'
          : 'border-white/[0.08] hover:border-white/[0.20]'
      }`}
    >
      {/* Avatar Canvas Rendering */}
      <AvatarCanvas
        avatarId={user.avatarId}
        features={effectiveFeatures}
        userName=""
        isSpeaking={isSpeaking}
        cameraOffsetX={isSelf ? cameraOffsetX : 0}
        cameraOffsetY={isSelf ? cameraOffsetY : 0}
        trackingMode={activeMode}
        className="w-full h-full"
      />

      {/* Top Bar inside Card */}
      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 gap-1.5">
        {/* Left: Mode / Voice status badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeMode === 'gestures' ? (
            <span
              className="px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/40 text-[10px] font-mono"
              title="Modo Reconocimiento de Gestos • Visión 100% Cámara"
            >
              Gestos
            </span>
          ) : activeMode === 'lipsync' ? (
            <span
              className="px-1.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/40 text-[10px] font-mono"
              title="Modo Lip Sync • Máscara estática y boca por audio"
            >
              Lip Sync
            </span>
          ) : (
            <span
              className="px-1.5 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-800/40 text-[10px] font-mono"
              title="Modo Parafernalia • Ritmo de voz, gestos y zoom dinámico"
            >
              Parafernalia
            </span>
          )}
        </div>

        {/* Right: Name Badge & Admin Direct Controls (Mic & X) */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-[70%] justify-end">
          {/* User Name Badge in Top-Right */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#08080c]/90 backdrop-blur-md border border-white/[0.08] text-xs text-white shadow-md truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                user.isMuted
                  ? 'bg-rose-500'
                  : isSpeaking
                  ? 'bg-cyan-400 animate-ping'
                  : features.isFaceDetected
                  ? 'bg-emerald-400'
                  : 'bg-neutral-500'
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

      {/* Bottom Bar: Real-time Audio Waveform graphic */}
      <div className="absolute bottom-2.5 right-2.5 z-10 pointer-events-none">
        <div className="flex items-center px-2 py-1 rounded-lg bg-[#08080c]/85 backdrop-blur-md border border-white/[0.06] shadow-md">
          <AudioWaveform
            volume={features.audioVolume || 0}
            isMuted={user.isMuted}
            color={
              user.isMuted
                ? '#f43f5e'
                : user.avatarId === 'face_cap'
                ? '#38bdf8'
                : user.avatarId === 'bot_9000'
                ? '#10b981'
                : user.avatarId === 'fox_sensei'
                ? '#f97316'
                : '#22d3ee'
            }
            width={68}
            height={22}
          />
        </div>
      </div>
    </div>
  );
};
