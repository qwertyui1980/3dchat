import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Smile,
  MessageSquare,
  PhoneOff,
  Check,
} from 'lucide-react';
import { AvatarId } from '../../types';
import { AVATAR_LIST } from '../avatars/avatarConfigs';

interface CallControlsProps {
  isMicActive: boolean;
  isCameraActive: boolean;
  currentAvatarId: AvatarId;
  unreadChatCount: number;
  isChatOpen: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onSelectAvatar: (id: AvatarId) => void;
  onToggleChat: () => void;
  onLeaveCall: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMicActive,
  isCameraActive,
  currentAvatarId,
  unreadChatCount,
  isChatOpen,
  onToggleMic,
  onToggleCamera,
  onSelectAvatar,
  onToggleChat,
  onLeaveCall,
}) => {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  return (
    <div className="h-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-3 sm:px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left spacer to keep center controls centered */}
      <div className="w-8 sm:w-12 hidden xs:block" />

      {/* Center: Core Call Toggles (Mic, Camera, Avatar Switcher, Leave) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mic Toggle */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-lg cursor-pointer ${
            isMicActive
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-600'
              : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-600/30'
          }`}
          title={isMicActive ? 'Silenciar micrófono' : 'Activar micrófono'}
        >
          {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Camera / Face Tracking Toggle */}
        <button
          type="button"
          onClick={onToggleCamera}
          className={`p-3 sm:p-3.5 rounded-2xl border transition active:scale-95 shadow-lg cursor-pointer ${
            isCameraActive
              ? 'bg-slate-800/90 hover:bg-slate-700 text-slate-100 border-slate-600'
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
                : 'bg-slate-800/90 hover:bg-slate-700 text-cyan-300 border-slate-600'
            }`}
            title="Cambiar mi Avatar en vivo"
          >
            <Smile className="w-5 h-5" />
          </button>

          {showAvatarPicker && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowAvatarPicker(false)} />
              <div className="absolute -translate-x-1/2 left-1/2 bottom-full mb-3 w-[calc(100vw-32px)] max-w-xs rounded-2xl bg-slate-900 border border-slate-700 p-3 shadow-2xl z-30">
                <div className="text-xs font-bold text-slate-300 mb-2 px-1 flex items-center justify-between">
                  <span>Cambiar Avatar en Vivo</span>
                  <span className="text-[10px] text-cyan-400 font-mono">3D / WebGL</span>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                  {AVATAR_LIST.map((avatar) => {
                    const isSelected = avatar.id === currentAvatarId;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => {
                          onSelectAvatar(avatar.id);
                          setShowAvatarPicker(false);
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: avatar.themeColor }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{avatar.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{avatar.category}</p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
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
          onClick={onLeaveCall}
          className="p-3 sm:p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 transition active:scale-95 shadow-lg shadow-rose-600/30 cursor-pointer"
          title="Salir de la videollamada"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Chat Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleChat}
          className={`relative p-3 sm:p-3.5 rounded-2xl border transition cursor-pointer ${
            isChatOpen
              ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/25'
              : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title="Abrir chat de la sala"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadChatCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center border-2 border-slate-950 animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
