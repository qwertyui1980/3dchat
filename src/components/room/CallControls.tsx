import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  PhoneOff,
  Check,
  Tv,
  ScanFace,
  PenTool,
  Shield,
  X,
  Maximize2,
  Minimize2,
  Layers,
  Radio,
  Sparkles,
} from 'lucide-react';
import { AvatarId, DynamicTrackingMode } from '../../types';
import { TRACKING_MODES_CONFIG, normalizeTrackingMode, OFFICIAL_TRACKING_MODES } from '../../services/face3d/dynamicModeHelper';

interface CallControlsProps {
  isMicActive: boolean;
  isCameraActive: boolean;
  currentAvatarId: AvatarId;
  trackingMode?: DynamicTrackingMode;
  onSelectTrackingMode?: (mode: DynamicTrackingMode) => void;
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
  isTheaterOpen?: boolean;
  onToggleTrackingPip?: () => void;
  isTrackingPipOpen?: boolean;
  onToggleWhiteboard?: () => void;
  isWhiteboardOpen?: boolean;
  onOpenAdminPanel?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMicActive,
  isCameraActive,
  currentAvatarId,
  trackingMode = 'hybrid',
  onSelectTrackingMode,
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
  isTheaterOpen = false,
  onToggleTrackingPip,
  isTrackingPipOpen = true,
  onToggleWhiteboard,
  isWhiteboardOpen = false,
  onOpenAdminPanel,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const [showModePicker, setShowModePicker] = React.useState(false);

  return (
    <div className="h-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-[#08080c]/95 backdrop-blur-xl border-t border-white/[0.06] px-3 sm:px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left side: Admin Controls or Spacer */}
      <div className="flex items-center gap-2 min-w-[32px] sm:min-w-[48px]">
        {isAdmin && onMuteAll && (
          <button
            type="button"
            onClick={onMuteAll}
            className={`px-3 py-2.5 rounded-2xl border transition active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer text-xs font-semibold ${
              isAllMuted
                ? 'bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border-rose-800/60'
                : 'bg-[#121218] hover:bg-[#181822] text-neutral-200 border-white/[0.08]'
            }`}
            title={isAllMuted ? 'Reactivar micrófonos de todos' : 'Mutear a todos los participantes'}
          >
            <MicOff className={`w-4 h-4 ${isAllMuted ? 'text-rose-400' : 'text-neutral-400'}`} />
            <span className="hidden sm:inline">
              {isAllMuted ? 'Desmutear Todos' : 'Mutear Todos'}
            </span>
          </button>
        )}

        {isAdmin && onOpenAdminPanel && (
          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="px-3 py-2.5 rounded-2xl bg-[#121218] hover:bg-[#181822] border border-white/[0.08] text-neutral-200 hover:text-white transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-semibold"
            title="Abrir Panel de Control del Administrador"
          >
            <Shield className="w-4 h-4 text-neutral-400" />
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
          className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-sm cursor-pointer ${
            isMicActive
              ? 'bg-[#121218] hover:bg-[#181822] text-neutral-100 border-white/[0.08]'
              : 'bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border-rose-800/60'
          }`}
          title={isMicActive ? 'Silenciar mi micrófono' : 'Activar mi micrófono'}
        >
          {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5 text-rose-400" />}
        </button>

        {/* Camera / Face Tracking Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-sm cursor-pointer ${
            isCameraActive
              ? 'bg-[#121218] hover:bg-[#181822] text-neutral-100 border-white/[0.08]'
              : 'bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border-rose-800/60'
          }`}
          title={isCameraActive ? 'Pausar captura de rostro' : 'Activar captura de rostro'}
        >
          {isCameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5 text-rose-400" />}
        </button>

        {/* Dynamic Mode Quick Switcher Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowModePicker(!showModePicker)}
            className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-sm cursor-pointer flex items-center gap-1.5 ${
              showModePicker
                ? 'bg-[#20202c] text-white border-white/[0.22]'
                : normalizeTrackingMode(trackingMode) === 'gestures'
                ? 'bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border-emerald-500/40'
                : normalizeTrackingMode(trackingMode) === 'lipsync'
                ? 'bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border-amber-500/40'
                : 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border-cyan-500/40'
            }`}
            title="Cambiar Modo Dinámico: Parafernalia / Gestos / Lip Sync"
          >
            {normalizeTrackingMode(trackingMode) === 'gestures' ? (
              <ScanFace className="w-5 h-5 text-emerald-400" />
            ) : normalizeTrackingMode(trackingMode) === 'lipsync' ? (
              <Radio className="w-5 h-5 text-amber-400" />
            ) : (
              <Sparkles className="w-5 h-5 text-cyan-400" />
            )}
            <span className="hidden xl:inline text-xs font-semibold">
              {normalizeTrackingMode(trackingMode) === 'gestures' ? 'Gestos' : normalizeTrackingMode(trackingMode) === 'lipsync' ? 'Lip Sync' : 'Parafernalia'}
            </span>
          </button>

          {showModePicker && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowModePicker(false)} />
              <div className="absolute -translate-x-1/2 left-1/2 bottom-full mb-3 w-[calc(100vw-32px)] max-w-xs rounded-2xl bg-[#0e0e14] border border-white/[0.1] p-3 shadow-2xl z-30 space-y-2">
                <div className="text-xs font-bold text-neutral-300 px-1 flex items-center justify-between">
                  <span>Modos de Animación</span>
                </div>
                <div className="space-y-1.5">
                  {OFFICIAL_TRACKING_MODES.map((mode) => {
                    const cfg = TRACKING_MODES_CONFIG[mode];
                    const isSelected = normalizeTrackingMode(trackingMode) === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          if (onSelectTrackingMode) onSelectTrackingMode(mode);
                          setShowModePicker(false);
                        }}
                        className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md'
                            : 'bg-[#14141c] border-white/[0.06] hover:border-white/[0.12] text-neutral-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                            style={{
                              backgroundColor: `${cfg.color}15`,
                              borderColor: `${cfg.color}40`,
                              color: cfg.color,
                            }}
                          >
                            {mode === 'gestures' ? (
                              <ScanFace className="w-4 h-4" />
                            ) : mode === 'lipsync' ? (
                              <Radio className="w-4 h-4" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{cfg.label}</p>
                            <p className="text-[10px] text-neutral-400 leading-tight">{cfg.sublabel}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                      </button>
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
          onClick={() => {
            if (window.confirm('¿Estás seguro de que deseas salir del espacio?')) {
              onLeaveCall();
            }
          }}
          className="p-3 sm:p-3.5 rounded-2xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition active:scale-95 shadow-sm cursor-pointer"
          title="Salir del espacio"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Screen & Tracking & Pizarra & Chat Buttons */}
      <div className="flex items-center gap-2">
        {/* 1. Dedicated Button: Re-open Theater Video Screen */}
        {onOpenTheater && (
          <button
            type="button"
            onClick={onOpenTheater}
            className={`relative p-2.5 sm:py-3 sm:px-3 rounded-2xl border transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isTheaterOpen
                ? 'bg-[#20202c] text-white border-white/[0.22]'
                : 'bg-[#121218] hover:bg-[#181822] text-neutral-200 border-white/[0.08]'
            }`}
            title={isTheaterOpen ? 'Ocultar video' : 'Abrir video'}
          >
            <Tv className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold hidden sm:inline">Video</span>
          </button>
        )}

        {/* 2. Dedicated Button: Toggle Tracking PIP Panel (Next to Pantalla) */}
        {onToggleTrackingPip && (
          <button
            type="button"
            onClick={onToggleTrackingPip}
            className={`relative p-2.5 sm:py-3 sm:px-3 rounded-2xl border transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isTrackingPipOpen
                ? 'bg-[#20202c] text-white border-white/[0.22]'
                : 'bg-[#121218] hover:bg-[#181822] text-neutral-200 border-white/[0.08]'
            }`}
            title={isTrackingPipOpen ? 'Ocultar visor de tracking' : 'Mostrar visor de tracking'}
          >
            <ScanFace className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold hidden sm:inline">Tracking</span>
          </button>
        )}

        {/* 3. Dedicated Button: Toggle Whiteboard */}
        {onToggleWhiteboard && (
          <button
            type="button"
            onClick={onToggleWhiteboard}
            className={`relative p-2.5 sm:py-3 sm:px-3 rounded-2xl border transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isWhiteboardOpen
                ? 'bg-[#20202c] text-white border-white/[0.22]'
                : 'bg-[#121218] hover:bg-[#181822] text-neutral-200 border-white/[0.08]'
            }`}
            title={isWhiteboardOpen ? 'Cerrar Pizarra colaborativa' : 'Abrir Pizarra colaborativa'}
          >
            <PenTool className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold hidden sm:inline">Pizarra</span>
          </button>
        )}

        {/* 4. Chat Button */}
        <button
          type="button"
          onClick={onToggleChat}
          className={`relative p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer shadow-sm ${
            isChatOpen
              ? 'bg-[#20202c] text-white border-white/[0.22]'
              : 'bg-[#121218] hover:bg-[#181822] text-neutral-200 border-white/[0.08]'
          }`}
          title="Abrir chat del espacio"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white font-bold text-[9px] flex items-center justify-center border border-[#08080c]">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
