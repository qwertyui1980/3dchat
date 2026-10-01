import React, { useState, useRef, useEffect } from 'react';
import { Tv, Play, List } from 'lucide-react';
import { RoomMediaState } from '../../types';

interface TvFloatingLauncherProps {
  isVisible: boolean;
  onOpen: () => void;
  mediaState: RoomMediaState;
}

export const TvFloatingLauncher: React.FC<TvFloatingLauncherProps> = ({
  isVisible,
  onOpen,
  mediaState,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number }>(() => ({
    x: 20,
    y: 85,
  }));

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 20,
    initY: 85,
  });

  const currentVideo = mediaState.currentVideo;
  const isPlaying = mediaState.isPlaying && !!currentVideo;
  const queueCount = mediaState.queue.length;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const maxX = Math.max(10, window.innerWidth - 80);
    const maxY = Math.max(10, window.innerHeight - 80);

    const nextX = Math.min(maxX, Math.max(10, dragStartRef.current.initX + deltaX));
    const nextY = Math.min(maxY, Math.max(10, dragStartRef.current.initY + deltaY));

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      const movedDistance = Math.hypot(
        e.clientX - dragStartRef.current.startX,
        e.clientY - dragStartRef.current.startY
      );
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}

      // If clicked without significant drag, trigger onOpen
      if (movedDistance < 6) {
        onOpen();
      }
    }
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 35,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="group touch-none select-none cursor-grab active:cursor-grabbing animate-bounce-subtle"
    >
      <div
        className={`relative flex items-center gap-2 p-2.5 sm:p-3 rounded-2xl bg-[#0d0d16]/90 backdrop-blur-xl border transition-all duration-300 shadow-2xl hover:scale-105 active:scale-95 ${
          isPlaying
            ? 'border-cyan-500/60 shadow-cyan-500/20 ring-1 ring-cyan-500/30'
            : 'border-white/10 hover:border-white/20'
        }`}
        title="Abrir pantalla Home Theater sincronizada"
      >
        {/* Glow indicator circle */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
              isPlaying
                ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-white/10 text-neutral-300 group-hover:text-white'
            }`}
          >
            <Tv className="w-5 h-5" />
          </div>

          {/* Equalizer audio pulse animation when video is active */}
          {isPlaying && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 border border-slate-950" />
            </span>
          )}
        </div>

        {/* Text and Title snippet (expands on hover) */}
        <div className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-out whitespace-nowrap pr-1">
          <p className="text-[11px] font-bold text-white leading-tight truncate">
            {currentVideo ? currentVideo.title : 'Ver Home Theater'}
          </p>
          <p className="text-[10px] text-cyan-400 font-medium">
            {isPlaying ? 'Reproduciendo en vivo' : 'En pausa'}
          </p>
        </div>

        {/* Queue badge counter */}
        {queueCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] shadow-sm">
            +{queueCount}
          </span>
        )}
      </div>
    </div>
  );
};
