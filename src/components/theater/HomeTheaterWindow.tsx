import React, { useState, useRef, useEffect } from 'react';
import {
  Tv,
  X,
  Minus,
  ListPlus,
  GripHorizontal,
  Volume2,
  Volume1,
  VolumeX,
} from 'lucide-react';
import { RoomMediaState } from '../../types';
import { YouTubeSyncPlayer } from './YouTubeSyncPlayer';

interface HomeTheaterWindowProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenQueueModal: () => void;
  mediaState: RoomMediaState;
  currentUserRole?: 'admin' | 'participant';
  onTogglePlayback: (isPlaying: boolean, currentTime: number) => void;
  onSeek: (currentTime: number) => void;
  onVideoEnded: () => void;
  onSkip?: () => void;
}

export const HomeTheaterWindow: React.FC<HomeTheaterWindowProps> = ({
  isOpen,
  onClose,
  onOpenQueueModal,
  mediaState,
  currentUserRole = 'participant',
  onTogglePlayback,
  onSeek,
  onVideoEnded,
  onSkip,
}) => {
  // Dimensions: 16:9 strictly maintained for video area
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.min(680, window.innerWidth - 32);
    }
    return 640;
  });

  // Coordinates for dragging
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const initX = Math.max(16, (window.innerWidth - 640) / 2);
      const initY = 80;
      return { x: initX, y: initY };
    }
    return { x: 50, y: 80 };
  });

  // Volume & Mute state (local to user, remembered across visits)
  const [volume, setVolume] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('xstreamx_theater_volume');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
      }
    }
    return 80;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('xstreamx_theater_muted') === 'true';
    }
    return false;
  });

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      localStorage.setItem('xstreamx_theater_muted', 'false');
    }
    localStorage.setItem('xstreamx_theater_volume', newVol.toString());
  };

  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('xstreamx_theater_muted', next.toString());
      return next;
    });
  };

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initPosX: number; initPosY: number }>({
    startX: 0,
    startY: 0,
    initPosX: 0,
    initPosY: 0,
  });

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef<{ startX: number; initWidth: number }>({
    startX: 0,
    initWidth: 640,
  });

  // Calculate 16:9 video height
  const HEADER_HEIGHT = 46;
  const videoHeight = Math.round((width * 9) / 16);
  const totalHeight = videoHeight + HEADER_HEIGHT;

  // Window resize bounds check
  useEffect(() => {
    const handleWindowResize = () => {
      setWidth((prev) => Math.min(prev, Math.max(360, window.innerWidth - 32)));
      setPosition((prev) => ({
        x: Math.min(prev.x, Math.max(0, window.innerWidth - width - 16)),
        y: Math.min(prev.y, Math.max(0, window.innerHeight - totalHeight - 16)),
      }));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [width, totalHeight]);

  // Pointer drag logic
  const handlePointerDownHeader = (e: React.PointerEvent) => {
    // Ignore interactive element clicks (buttons, inputs)
    if ((e.target as HTMLElement).closest('button, input')) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initPosX: position.x,
      initPosY: position.y,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveHeader = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const maxX = Math.max(0, window.innerWidth - width - 12);
    const maxY = Math.max(0, window.innerHeight - totalHeight - 12);

    const nextX = Math.min(maxX, Math.max(12, dragStartRef.current.initPosX + deltaX));
    const nextY = Math.min(maxY, Math.max(12, dragStartRef.current.initPosY + deltaY));

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUpHeader = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Pointer resize logic (preserves strict 16:9 aspect ratio up to 1024px max)
  const handlePointerDownResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      startX: e.clientX,
      initWidth: width,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveResize = (e: React.PointerEvent) => {
    if (!isResizingRef.current) return;
    const deltaX = e.clientX - resizeStartRef.current.startX;
    const maxWidth = Math.min(1024, window.innerWidth - position.x - 16);
    const nextWidth = Math.min(maxWidth, Math.max(380, resizeStartRef.current.initWidth + deltaX));
    setWidth(nextWidth);
  };

  const handlePointerUpResize = (e: React.PointerEvent) => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  if (!isOpen) return null;

  const currentVideo = mediaState.currentVideo;
  const queueCount = mediaState.queue.length;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${totalHeight}px`,
        zIndex: 40,
      }}
      className="rounded-2xl bg-[#09090f]/95 backdrop-blur-2xl border border-white/[0.14] shadow-2xl flex flex-col overflow-hidden animate-fade-in group select-none ring-1 ring-cyan-500/20"
    >
      {/* Top Header Bar (Draggable Handle) */}
      <div
        onPointerDown={handlePointerDownHeader}
        onPointerMove={handlePointerMoveHeader}
        onPointerUp={handlePointerUpHeader}
        className="h-[46px] px-3.5 bg-[#0e0e18]/90 border-b border-white/[0.08] flex items-center justify-between cursor-move touch-none shrink-0"
      >
        {/* Left: TV Title & Grab indicator */}
        <div className="flex items-center gap-2 min-w-0 max-w-[65%]">
          <GripHorizontal className="w-4 h-4 text-neutral-500 shrink-0" />
          <div className="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center shrink-0">
            <Tv className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="min-w-0 truncate">
            <h4 className="text-xs font-bold text-neutral-100 truncate leading-tight">
              {currentVideo ? currentVideo.title : 'Home Theater'}
            </h4>
            {currentVideo && (
              <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                <span>Por:</span>
                <span className="text-cyan-300 font-semibold">{currentVideo.addedByUserName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Right: Volume Control, Queue Button, Minimize, and Close */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Local Volume Control Slider */}
          <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1 rounded text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer"
              title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : volume < 50 ? (
                <Volume1 className="w-3.5 h-3.5 text-cyan-300" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-14 sm:w-16 h-1 bg-white/20 accent-cyan-400 hover:accent-cyan-300 rounded-lg cursor-pointer"
              title={`Volumen: ${isMuted ? 'Silenciado' : `${volume}%`}`}
            />
            <span className="text-[10px] text-neutral-400 font-mono min-w-[24px] text-right hidden sm:inline">
              {isMuted ? '0%' : `${volume}%`}
            </span>
          </div>

          {/* Playlist / Queue Drawer Button */}
          <button
            type="button"
            onClick={onOpenQueueModal}
            className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-cyan-500/20 text-neutral-200 hover:text-cyan-300 border border-white/10 hover:border-cyan-500/40 text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Abrir cola de reproducción y agregar video"
          >
            <ListPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-bold">Playlist</span>
            {queueCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px]">
                {queueCount}
              </span>
            )}
          </button>

          {/* Minimize Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition active:scale-95 cursor-pointer"
            title="Minimizar (quedará flotando como icono de TV)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Close Window Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
            title="Cerrar ventana de cine"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Viewport Area (Strict 16:9 ratio) */}
      <div
        style={{ width: `${width}px`, height: `${videoHeight}px` }}
        className="relative bg-black flex-1 overflow-hidden"
      >
        <YouTubeSyncPlayer
          mediaState={mediaState}
          currentUserRole={currentUserRole}
          onTogglePlayback={onTogglePlayback}
          onSeek={onSeek}
          onVideoEnded={onVideoEnded}
          onSkip={onSkip}
          volume={volume}
          isMuted={isMuted}
        />
      </div>

      {/* Resize Handle in Bottom-Right Corner (Preserves 16:9 ratio, max 1024px) */}
      <div
        onPointerDown={handlePointerDownResize}
        onPointerMove={handlePointerMoveResize}
        onPointerUp={handlePointerUpResize}
        className="absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-nwse-resize text-neutral-500 hover:text-cyan-400 touch-none z-30 opacity-70 group-hover:opacity-100 transition-opacity"
        title="Arrastra para redimensionar (hasta 1024px con relación 16:9)"
      >
        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current">
          <path d="M8 2 L10 2 L10 10 L2 10 L2 8 L8 8 Z" />
          <path d="M5 5 L7 5 L7 7 L5 7 Z" />
        </svg>
      </div>
    </div>
  );
};
