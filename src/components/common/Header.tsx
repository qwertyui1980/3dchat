import React from 'react';
import { Users, LogOut } from 'lucide-react';
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
