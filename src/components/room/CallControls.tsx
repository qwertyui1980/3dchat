import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Smile,
  MessageSquare,
  PhoneOff,
  Check,
  Tv,
  ListVideo,
  PenTool,
  Shield,
  X,
} from 'lucide-react';
import { AvatarId, AvatarDefinition } from '../../types';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';

interface CallControlsProps {
  isMicActive: boolean;
  isCameraActive: boolean;
  currentAvatarId: AvatarId;
  unreadChatCount: number;
  isChatOpen: boolean;
  isAdmin?: boolean;
  onMuteAll?: () => void;
  isAllMuted?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSelectAvatar: (id: AvatarId) => void;
  onToggleChat: () => void;
  onLeaveCall: () => void;
  onOpenTheater?: () => void;
  onOpenPlaylist?: () => void;
  isTheaterOpen?: boolean;
  isPlaylistOpen?: boolean;
  userTurnNumber?: number | null;
  isUserPlayingNow?: boolean;
  hasActiveMedia?: boolean;
  queueCount?: number;
  onToggleWhiteboard?: () => void;
  isWhiteboardOpen?: boolean;
  onOpenAdminPanel?: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMicActive,
  isCameraActive,
  currentAvatarId,
  unreadChatCount,
  isChatOpen,
  isAdmin = false,
  onMuteAll,
  isAllMuted = false,
  onToggleMic,
  onToggleCamera,
  onSelectAvatar,
  onToggleChat,
  onLeaveCall,
  onOpenTheater,
  onOpenPlaylist,
  isTheaterOpen = false,
  isPlaylistOpen = false,
  userTurnNumber = null,
  isUserPlayingNow = false,
  hasActiveMedia = false,
  queueCount = 0,
  onToggleWhiteboard,
  isWhiteboardOpen = false,
  onOpenAdminPanel,
}) => {
  const [showAvatarPicker, setShowAvatarPicker] = React.useState(false);
  const [avatars, setAvatars] = useState<AvatarDefinition[]>(() =>
    isAdmin
      ? avatarModelServiceSingleton.getAllAvatars()
      : avatarModelServiceSingleton.getActiveAvatars()
  );

  useEffect(() => {
    const unsub = avatarModelServiceSingleton.subscribe(() => {
      setAvatars(
        isAdmin
          ? avatarModelServiceSingleton.getAllAvatars()
          : avatarModelServiceSingleton.getActiveAvatars()
      );
    });
    return unsub;
  }, [isAdmin]);

  const handleDeleteModel = (e: React.MouseEvent, avatarId: string) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este modelo 3D de la plataforma?')) {
      avatarModelServiceSingleton.deleteModel(avatarId);
    }
  };

  return (
    <div className="h-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-[#08080c]/95 backdrop-blur-xl border-t border-white/[0.06] px-3 sm:px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left side: Admin Mute All Button & Admin Panel or Spacer */}
      <div className="flex items-center gap-2 min-w-[32px] sm:min-w-[48px]">
        {isAdmin && onMuteAll && (
          <button
            type="button"
            onClick={onMuteAll}
            className={`px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border transition active:scale-95 shadow-md flex items-center gap-1.5 cursor-pointer font-bold ${
              isAllMuted
                ? 'bg-rose-600 hover:bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-600/30 ring-1 ring-rose-400/50'
                : 'bg-[#121218] hover:bg-[#181822] border-amber-500/40 text-amber-300'
            }`}
            title={isAllMuted ? 'Reactivar micrófonos de todos' : 'Mutear a todos los participantes'}
          >
            <MicOff className={`w-4 h-4 ${isAllMuted ? 'text-white' : 'text-amber-400'}`} />
            <span className="text-[11px] font-black uppercase tracking-wider hidden sm:inline">
              {isAllMuted ? 'Desmutear Todos' : 'Mutear Todos'}
            </span>
          </button>
        )}

        {isAdmin && onOpenAdminPanel && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md font-bold text-[11px] uppercase tracking-wider"
            title="Abrir Panel de Control del Administrador"
          >
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Panel Admin</span>
          </button>
        )}
      </div>

      {/* Center: Core Call Toggles (Mic, Camera, Avatar Switcher, Leave) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-lg cursor-pointer ${
            isMicActive
              ? 'bg-[#121218] hover:bg-[#181822] text-neutral-100 border-white/[0.08]'
              : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
          }`}
          title={isMicActive ? 'Silenciar mi micrófono' : 'Activar mi micrófono'}
        >
          {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera / Face Tracking Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-lg cursor-pointer ${
            isCameraActive
              ? 'bg-[#121218] hover:bg-[#181822] text-neutral-100 border-white/[0.08]'
              : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
          }`}
          title={isCameraActive ? 'Pausar captura de rostro' : 'Activar captura de rostro'}
        >
          {isCameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Avatar Quick Switcher Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
            className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-lg cursor-pointer ${
              showAvatarPicker
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-cyan-500/25'
                : 'bg-[#121218] hover:bg-[#181822] text-cyan-300 border-white/[0.08]'
            }`}
            title="Cambiar mi Avatar en vivo"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showAvatarPicker && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowAvatarPicker(false)} />
              <div className="absolute -translate-x-1/2 left-1/2 bottom-full mb-3 w-[calc(100vw-32px)] max-w-sm rounded-2xl bg-[#0e0e14] border border-white/[0.1] p-3 shadow-2xl z-30">
                <div className="text-xs font-bold text-neutral-300 mb-2 px-1 flex items-center justify-between">
                  <span>Cambiar Avatar en Vivo</span>
                  {isAdmin && (
                    <span className="text-[10px] text-amber-400 font-mono">
                      (Admin: X para eliminar)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {avatars.map((avatar) => {
                    const isSelected = avatar.id === currentAvatarId;
                    return (
                      <div
                        key={avatar.id}
                        onClick={() => {
                          onSelectAvatar(avatar.id);
                          setShowAvatarPicker(false);
                        }}
                        className={`group relative flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                            : 'bg-[#14141c] border-white/[0.06] hover:border-white/[0.12] text-neutral-300'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: avatar.themeColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{avatar.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{avatar.category}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}

                        {/* Admin 1-Click Delete Button ('X') */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteModel(e, avatar.id)}
                            className="p-1 rounded-md bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-300 transition opacity-80 hover:opacity-100 shrink-0 cursor-pointer"
                            title="Eliminar este modelo de la plataforma con 1 clic"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Leave Call Button */}
        <button
          type="button"
          onClick={onLeaveCall}
          className="p-3 sm:p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 transition active:scale-95 shadow-lg shadow-rose-600/30 cursor-pointer"
          title="Salir de la videollamada"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Screen & Playlist & Chat Buttons */}
      <div className="flex items-center gap-2">
        {/* 1. Dedicated Button: Re-open Theater Video Screen */}
        {onOpenTheater && (
          <button
            type="button"
            onClick={onOpenTheater}
            className={`relative p-2.5 sm:py-3 sm:px-3 rounded-2xl border transition active:scale-95 flex items-center gap-2 cursor-pointer ${
              isTheaterOpen
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/25'
                : hasActiveMedia
                ? 'bg-gradient-to-r from-[#141424] to-[#10101c] hover:bg-[#1a1a2e] text-cyan-300 border-cyan-500/40 shadow-sm animate-pulse'
                : 'bg-[#121218] hover:bg-[#181822] text-neutral-200 border-white/[0.08]'
            }`}
            title={isTheaterOpen ? 'Pantalla de Cine activa (clic para ocultar)' : 'Abrir pantalla de Cine'}
          >
            <Tv className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold hidden sm:inline">Pantalla</span>
            {hasActiveMedia && !isTheaterOpen && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
            )}
          </button>
        )}

        {/* 2. Dedicated Button: Open Synchronized Cue Playlist */}
        {onOpenPlaylist && (
          <button
            type="button"
            onClick={onOpenPlaylist}
            className={`relative p-2.5 sm:py-3 sm:px-3.5 rounded-2xl border transition active:scale-95 flex items-center gap-2 cursor-pointer ${
              isPlaylistOpen
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/25'
                : 'bg-[#121218] hover:bg-[#181822] text-cyan-300 hover:text-white border-white/[0.08]'
            }`}
            title="Abrir Playlist compartida y ver tu turno"
          >
            <ListVideo className="w-5 h-5 shrink-0 text-cyan-400" />
            <span className="text-xs font-bold hidden sm:inline">Playlist</span>

            {/* Turn or Queue Badge */}
            {isUserPlayingNow ? (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[9px] uppercase tracking-wider animate-pulse">
                Tu video
              </span>
            ) : userTurnNumber ? (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] shadow-sm">
                Turno #{userTurnNumber}
              </span>
            ) : queueCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px]">
                {queueCount}
              </span>
            ) : null}
          </button>
        )}

        {/* Pizarra / Canvas Whiteboard Button */}
        {onToggleWhiteboard && (
          <button
            type="button"
            onClick={onToggleWhiteboard}
            className={`relative p-2.5 sm:py-3 sm:px-3 rounded-2xl border transition active:scale-95 flex items-center gap-2 cursor-pointer ${
              isWhiteboardOpen
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/25'
                : 'bg-[#121218] hover:bg-[#181822] text-amber-300 hover:text-white border-white/[0.08]'
            }`}
            title={isWhiteboardOpen ? 'Pizarra activa (clic para ocultar)' : 'Abrir pizarra colaborativa'}
          >
            <PenTool className="w-5 h-5 shrink-0 text-amber-400" />
            <span className="text-xs font-bold hidden sm:inline">Pizarra</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleChat}
          className={`relative p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer ${
            isChatOpen
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/25'
              : 'bg-[#121218] hover:bg-[#181822] text-neutral-200 border-white/[0.08]'
          }`}
          title="Abrir chat del espacio"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center border-2 border-[#08080c] animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
