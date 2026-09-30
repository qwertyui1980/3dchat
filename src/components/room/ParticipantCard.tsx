import React, { useState } from 'react';
import { MicOff, Mic, Shield, UserX, VolumeX, Volume2, MoreVertical, Maximize2 } from 'lucide-react';
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
  const [showMenu, setShowMenu] = useState(false);
  const isSpeaking = (features.audioVolume > 0.12 || false) && !user.isMuted;

  return (
    <div
      className={`group relative w-[320px] h-[360px] shrink-0 rounded-2xl bg-slate-900/90 border transition-all duration-300 flex flex-col items-center justify-between overflow-hidden shadow-xl ${
        isFocusSpeaker
          ? 'border-indigo-500 ring-2 ring-indigo-500/20'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >

      {/* Avatar Canvas Rendering (Fixed 320x320 size) */}
      <div className="w-[320px] h-[320px] shrink-0 relative flex items-center justify-center">
        <AvatarCanvas
          avatarId={user.avatarId}
          features={features}
          userName=""
          isSpeaking={isSpeaking}
        />

        {/* Video Paused Overlay */}
        {!user.isCameraActive && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-slate-400">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <MicOff className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-xs font-semibold">Avatar en Pausa</span>
          </div>
        )}
      </div>

      {/* Top Bar inside Card */}
      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between z-10">
        {/* Role Badge */}
        <div className="flex items-center gap-1.5">
          {user.role === 'admin' ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider shadow">
              <Shield className="w-3 h-3 text-amber-400" />
              ADMIN
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/60 text-[10px] font-semibold uppercase">
              Participante
            </span>
          )}
          {isSelf && (
            <span className="px-1.5 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-700 text-[10px] font-bold">
              TÚ
            </span>
          )}
        </div>

        {/* Action buttons: Focus & Admin Menu */}
        <div className="flex items-center gap-1">
          {onFocusClick && (
            <button
              onClick={onFocusClick}
              title="Fijar en pantalla principal"
              className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition backdrop-blur-md opacity-0 group-hover:opacity-100"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Admin actions trigger (only for other users) */}
          {isAdmin && !isSelf && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                title="Acciones de administrador"
                className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition backdrop-blur-md"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {/* Admin Context Menu Dropdown */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-slate-900 border border-slate-700 p-1.5 shadow-2xl z-30 text-xs">
                    <button
                      onClick={() => {
                        onAdminMute?.(user.id, !user.isMuted);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-slate-200 hover:bg-slate-800 transition"
                    >
                      {user.isMuted ? (
                        <>
                          <Volume2 className="w-4 h-4 text-emerald-400" />
                          <span>Desmutear audio</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-4 h-4 text-amber-400" />
                          <span>Silenciar usuario</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        onAdminKick?.(user.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-rose-400 hover:bg-rose-950/50 transition font-medium"
                    >
                      <UserX className="w-4 h-4" />
                      <span>Expulsar de sala</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar: Name & Animated Audio Waveform */}
      <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between z-10 gap-2">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800/80 text-xs text-white max-w-[55%]">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isSpeaking
                ? 'bg-cyan-400 animate-ping'
                : features.isFaceDetected
                ? 'bg-emerald-400'
                : 'bg-slate-500'
            }`}
          />
          <span className="font-semibold truncate">{user.name}</span>
        </div>

        {/* Right side: Real-time Audio Waveform graphic & Mic button status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <AudioWaveform
            volume={features.audioVolume || 0}
            isMuted={user.isMuted}
            color={
              user.avatarId === 'face_cap'
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
          <div
            className={`p-1.5 rounded-lg border backdrop-blur-md ${
              user.isMuted
                ? 'bg-rose-950/80 border-rose-800 text-rose-400'
                : isSpeaking
                ? 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
            }`}
            title={user.isMuted ? 'Micrófono silenciado' : 'Micrófono activo'}
          >
            {user.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>
    </div>
  );
};
