import React, { useState } from 'react';
import { Users, Copy, Check, Link2, LogOut } from 'lucide-react';
import { RoomInfo, User } from '../../types';
import { AuthenticatedUser } from '../auth/Login';

interface HeaderProps {
  room: RoomInfo | null;
  currentUser: User | null;
  onToggleLock?: (locked: boolean) => void;
  isAdmin: boolean;
  authUser?: AuthenticatedUser | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  currentUser: _currentUser,
  authUser,
  onLogout,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);

  const getPublicShareUrl = () => {
    if (typeof window === 'undefined') return '';
    const roomSlug = room?.id ? encodeURIComponent(room.id) : 'main';
    return `${window.location.origin}/espacio/${roomSlug}`;
  };

  const handleCopyUrl = () => {
    const url = getPublicShareUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#08080c]/90 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand: Clean modern XSTREAMX */}
      <div className="flex items-center gap-1.5 min-w-0">
        <h1 className="text-lg sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-neutral-300 to-neutral-500 truncate">
          XSTREAMX
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {room && (
          <>
            {/* Public Link Input Bar */}
            <div className="flex items-center bg-[#121218] border border-white/[0.08] rounded-lg p-1 pl-2.5 gap-1.5 shadow-sm">
              <Link2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-semibold text-neutral-400 hidden sm:inline">Link:</span>
              <input
                type="text"
                readOnly
                value={getPublicShareUrl()}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="bg-[#08080a] text-cyan-300 font-mono text-[11px] px-2 py-0.5 rounded border border-white/[0.06] w-24 sm:w-36 lg:w-48 truncate select-all focus:outline-none focus:border-cyan-500"
                title="Enlace público para que otro ingrese al espacio"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                title="Copiar enlace público"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold transition shrink-0 cursor-pointer ${
                  copiedUrl
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-100 hover:bg-white text-neutral-950'
                }`}
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span className="hidden xs:inline">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span className="hidden xs:inline">Copiar</span>
                  </>
                )}
              </button>
            </div>

            {/* Participants Count Badge */}
            <div className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-[#121218] border border-white/[0.06] text-xs text-neutral-300">
              <Users className="w-3.5 h-3.5 text-neutral-400" />
              <span className="font-semibold">{room.participants.length}</span>
            </div>
          </>
        )}

        {/* User Session & Logout */}
        {authUser && (
          <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-slate-800">
            <span className="text-xs text-slate-300 font-semibold hidden lg:inline max-w-[100px] truncate">
              {authUser.name}
            </span>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Cerrar sesión"
                className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 text-xs font-medium transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Salir</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
