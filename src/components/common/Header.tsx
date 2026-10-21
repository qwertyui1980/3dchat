import { LogOut, Maximize2, Minimize2, Sparkles, Sliders } from 'lucide-react';
import { RoomInfo, User } from '../../types';
import { AuthenticatedUser } from '../auth/Login';

import { PresidentesMuertosNeonLogo } from './PresidentesMuertosNeonLogo';

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
  onOpenFaces?: () => void;
  onOpenDiagnostics?: () => void;
  cardSize?: number;
  onCardSizeChange?: (size: number) => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  currentUser: _currentUser,
  authUser,
  onLogout,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenProfile,
  onOpenFaces,
  onOpenDiagnostics: _onOpenDiagnostics,
  cardSize,
  onCardSizeChange,
}) => {

  return (
    <header className="h-12 sm:h-16 px-2 sm:px-6 bg-[#08080c]/90 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand: Logo Oficial PRESIDENTES MUERTOS Neón (33% menos brillante) */}
      <a
        href="#lobby"
        className="flex items-center gap-2 group transition-opacity hover:opacity-90 shrink-0 py-0.5"
        title="Presidentes Muertos"
      >
        <PresidentesMuertosNeonLogo className="h-7 sm:h-9 md:h-10 w-auto" showBrickBackground={false} />
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_6px_#ffe600] animate-pulse hidden sm:inline-block shrink-0" />
      </a>

      {/* Right Controls */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Participant Windows Sizing Slider (Header) */}
        {cardSize !== undefined && onCardSizeChange && (
          <div className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-1 rounded-xl bg-white/[0.04] border border-yellow-500/20 text-xs select-none">
            <Sliders className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="text-neutral-300 text-[11px] font-medium hidden sm:inline">Ventanas:</span>
            <input
              type="range"
              min={120}
              max={480}
              step={10}
              value={cardSize}
              onChange={(e) => onCardSizeChange(Number(e.target.value))}
              className="w-12 sm:w-24 h-1.5 accent-yellow-400 bg-neutral-800 rounded-lg cursor-pointer"
              title={`Dimensionar ventanas de participantes: ${cardSize}px`}
            />
            <span className="font-mono text-yellow-300 text-[10px] sm:text-[11px] min-w-[32px] sm:min-w-[36px] text-right font-bold">
              {cardSize}px
            </span>
            {cardSize !== 280 && (
              <button
                type="button"
                onClick={() => onCardSizeChange(280)}
                className="text-[10px] text-neutral-400 hover:text-yellow-300 transition cursor-pointer ml-0.5"
                title="Restablecer tamaño predeterminado (280px)"
              >
                ↺
              </button>
            )}
          </div>
        )}

        {/* 3D Masks Studio Direct Link (/3dchat/faces) - Solo para Admin */}
        {onOpenFaces && authUser?.role === 'admin' && (
          <button
            type="button"
            onClick={onOpenFaces}
            title="Abrir aplicación 3D Masks (/3dchat/faces)"
            className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-[#0e1626] hover:bg-[#132238] text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 text-xs font-semibold shadow-sm shadow-cyan-950/40 transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] hidden sm:inline">3D Masks</span>
          </button>
        )}

        {/* Fullscreen Toggle Button */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa (Ocultar barras)'}
            className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-[#121218] hover:bg-[#1c1c28] text-neutral-300 hover:text-yellow-300 border border-white/[0.08] hover:border-yellow-500/40 text-xs font-medium transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline text-[11px]">{isFullscreen ? 'Salir Full' : 'Pantalla Full'}</span>
          </button>
        )}

        {/* User Session, Profile & Logout */}
        {authUser && (
          <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2 border-l border-white/[0.08]">
            {onOpenProfile ? (
              <button
                type="button"
                onClick={onOpenProfile}
                title="Ver y editar perfil / avatares"
                className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-lg bg-[#121218] hover:bg-yellow-950/40 border border-white/[0.08] hover:border-yellow-500/40 text-neutral-200 hover:text-yellow-300 text-xs font-semibold transition cursor-pointer"
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
                className="flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700 text-xs font-medium transition cursor-pointer"
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
