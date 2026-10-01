import React from 'react';
import { Shield, Mic, MicOff, X, Maximize2 } from 'lucide-react';
import { User, FaceFeatures } from '../../types';
import { AvatarCanvas } from '../avatars/AvatarCanvas';
import { AudioWaveform } from '../common/AudioWaveform';

interface ParticipantCardProps {
  user: User;
  features: FaceFeatures;
  isSelf: boolean;
  isAdmin: boolean;
  isFocusSpeaker?: boolean;
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
  onFocusClick,
  onAdminMute,
  onAdminKick,
}) => {
  const isSpeaking = (features.audioVolume > 0.12 || false) && !user.isMuted;
  const effectiveFeatures = React.useMemo(() => {
    if (user.isMuted) {
      return { ...features, audioVolume: 0 };
    }
    return features;
  }, [features, user.isMuted]);

  return (
    <div
      className={`group relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] shrink-0 rounded-2xl bg-[#08080c] border transition-all duration-300 overflow-hidden shadow-2xl ${
        isFocusSpeaker
          ? 'border-cyan-500/80 ring-1 ring-cyan-500/30'
          : 'border-white/[0.08] hover:border-white/[0.16]'
      }`}
    >
      {/* Avatar Canvas Rendering */}
      <AvatarCanvas
        avatarId={user.avatarId}
        features={effectiveFeatures}
        userName=""
        isSpeaking={isSpeaking}
        className="w-full h-full"
      />

      {/* Top Bar inside Card */}
      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10 gap-1.5">
        {/* Left: Role & Voice status badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          {user.role === 'admin' ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider shadow-sm">
              <Shield className="w-3 h-3 text-amber-400" />
              ADMIN
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md bg-neutral-900/80 text-neutral-400 border border-neutral-800 text-[10px] font-medium uppercase">
              Participante
            </span>
          )}
          {!user.isCameraActive && (
            <span
              className="px-1.5 py-0.5 rounded-md bg-neutral-900/80 text-sky-400 border border-sky-900/40 text-[10px] font-mono"
              title="Cámara desactivada • Animación de boca por voz (Lip-Sync)"
            >
              Solo Voz
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
