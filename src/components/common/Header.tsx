import React from 'react';
import { Users, LogOut, Maximize2, Minimize2 } from 'lucide-react';
import { RoomInfo, User } from '../../types';
import { AuthenticatedUser } from '../auth/Login';

interface HeaderProps {
  room: RoomInfo | null;
  currentUser: User | null;
  onToggleLock?: (locked: boolean) => void;
  isAdmin: boolean;
  authUser?: AuthenticatedUser | null;
  onLogout?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  currentUser: _currentUser,
  authUser,
  onLogout,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenProfile,
}) => {

  return (
    <header className="h-14 sm:h-16 px-3 sm:px-6 bg-[#08080c]/90 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand: Clean modern XSTREAMX with neon glow */}
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-lg sm:text-xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 truncate">
          XSTREAMX
        </h1>
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#ffe600] animate-pulse hidden sm:inline-block" />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {room && (
          <>
            {/* Participants Count Badge */}
            <div className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-[#10141f] border border-blue-500/30 text-xs text-blue-200 shadow-sm shadow-blue-500/10">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold">{room.participants.length}</span>
            </div>
          </>
        )}

        {/* Fullscreen Toggle Button */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa (Ocultar barras)'}
            className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg bg-[#121218] hover:bg-[#1c1c28] text-neutral-300 hover:text-yellow-300 border border-white/[0.08] hover:border-yellow-500/40 text-xs font-medium transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline text-[11px]">{isFullscreen ? 'Salir Full' : 'Pantalla Full'}</span>
          </button>
        )}

        {/* User Session, Profile & Logout */}
        {authUser && (
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-white/[0.08]">
            {onOpenProfile ? (
              <button
                type="button"
                onClick={onOpenProfile}
                title="Ver y editar perfil / avatares"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121218] hover:bg-yellow-950/40 border border-white/[0.08] hover:border-yellow-500/40 text-neutral-200 hover:text-yellow-300 text-xs font-semibold transition cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full bg-yellow-400/20 text-yellow-300 flex items-center justify-center text-[10px] font-bold">
                  {authUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline max-w-[110px] truncate">{authUser.name}</span>
                <span className="text-[9px] uppercase px-1 rounded bg-yellow-950/80 text-yellow-300 border border-yellow-500/30 font-mono font-bold">
                  {authUser.role === 'admin' ? 'Admin' : 'Perfil'}
                </span>
              </button>
            ) : (
              <span className="text-xs text-slate-300 font-semibold hidden lg:inline max-w-[100px] truncate">
                {authUser.name}
              </span>
            )}

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
