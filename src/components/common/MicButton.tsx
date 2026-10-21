import React, { useRef, useEffect } from 'react';
import { MicOff, Lock } from 'lucide-react';

interface MicButtonProps {
  isActive: boolean;
  volume?: number;
  isAdminLocked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick: () => void;
  className?: string;
}

const BAR_COUNT = 4;
const BAR_COLORS_ACTIVE = ['#60a5fa', '#818cf8', '#a78bfa', '#60a5fa'];
const BAR_COLORS_IDLE   = ['#334155', '#3b4d6b', '#334155', '#3b4d6b'];
const BAR_COLORS_MUTED  = ['#881337', '#9f1239', '#881337', '#9f1239'];

export const MicButton: React.FC<MicButtonProps> = ({
  isActive,
  volume = 0,
  isAdminLocked = false,
  size = 'md',
  onClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const volRef    = useRef<number>(volume);
  const activeRef = useRef<boolean>(isActive);

  useEffect(() => { volRef.current    = volume;   }, [volume]);
  useEffect(() => { activeRef.current = isActive; }, [isActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const barW = Math.max(3, Math.floor(W / (BAR_COUNT * 2 - 1)));
    const gap  = barW;

    const heights: number[] = Array(BAR_COUNT).fill(0.15);
    const targets: number[] = Array(BAR_COUNT).fill(0.15);
    let seedPhase = 0;

    const render = () => {
      ctx.clearRect(0, 0, W, H);
      const vol    = volRef.current;
      const active = activeRef.current;
      seedPhase += active ? 0.08 + vol * 0.22 : 0.035;

      for (let i = 0; i < BAR_COUNT; i++) {
        if (!active) {
          targets[i] = 0.12 + Math.sin(seedPhase + i * 0.9) * 0.06;
        } else if (vol < 0.04) {
          targets[i] = 0.18 + Math.sin(seedPhase * 0.7 + i * 1.2) * 0.12;
        } else {
          const stagger = Math.sin(seedPhase + i * (Math.PI / BAR_COUNT));
          const rand    = Math.sin(seedPhase * 1.3 + i * 2.5) * 0.5 + 0.5;
          targets[i]    = 0.2 + vol * 0.75 * (stagger * 0.6 + rand * 0.4);
        }
        heights[i] += (targets[i] - heights[i]) * (active && vol > 0.04 ? 0.45 : 0.15);
        heights[i]  = Math.max(0.08, Math.min(1, heights[i]));
      }

      const colors = !active ? BAR_COLORS_MUTED : vol < 0.01 ? BAR_COLORS_IDLE : BAR_COLORS_ACTIVE;
      const totalW = BAR_COUNT * barW + (BAR_COUNT - 1) * gap;
      const startX = (W - totalW) / 2;

      for (let i = 0; i < BAR_COUNT; i++) {
        const barH  = heights[i] * H;
        const x     = startX + i * (barW + gap);
        const y     = (H - barH) / 2;
        const alpha = active ? (0.55 + heights[i] * 0.45) : 0.35;

        ctx.globalAlpha = alpha;
        if (active && vol > 0.04) {
          ctx.shadowColor = colors[i];
          ctx.shadowBlur  = 4 + vol * 6;
        }
        ctx.fillStyle = colors[i];
        const radius  = Math.min(barW / 2, 3);
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, radius);
        ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const sizeMap = {
    sm: { btn: 'p-2.5',          canvas: 28, icon: 'w-4 h-4' },
    md: { btn: 'p-3 sm:p-3.5',   canvas: 36, icon: 'w-5 h-5' },
    lg: { btn: 'p-4',            canvas: 44, icon: 'w-6 h-6' },
  };
  const s = sizeMap[size];

  const isSpeaking = isActive && volume > 0.08;
  const glowSize   = isSpeaking ? Math.round(8 + volume * 20) : 0;
  const glowOpacity = isSpeaking ? Math.min(0.9, 0.3 + volume * 0.7) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isAdminLocked}
      title={
        isAdminLocked
          ? 'Micrófonos silenciados por el administrador'
          : isActive
          ? 'Silenciar micrófono'
          : 'Activar micrófono'
      }
      className={[
        'relative flex items-center justify-center rounded-2xl border transition-all duration-200 select-none',
        'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        s.btn,
        isAdminLocked
          ? 'bg-neutral-900/90 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
          : isActive
          ? 'bg-blue-600/90 hover:bg-blue-500 text-white border-blue-400 cursor-pointer'
          : 'bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border-rose-800/60 cursor-pointer',
        className,
      ].join(' ')}
      style={{
        boxShadow: isAdminLocked
          ? 'none'
          : isActive
          ? `0 0 ${glowSize}px rgba(59,130,246,${glowOpacity}), 0 0 12px rgba(59,130,246,0.2)`
          : '0 0 10px rgba(244,63,94,0.25)',
      }}
    >
      {/* Outer speaking ring – X Spaces style */}
      {isSpeaking && (
        <span
          className="absolute rounded-2xl border-2 border-blue-400/70 pointer-events-none animate-ping"
          style={{
            inset: `-${4 + Math.round(volume * 6)}px`,
            animationDuration: `${Math.max(0.5, 1.2 - volume * 0.7)}s`,
            opacity: Math.min(0.7, 0.2 + volume * 0.5),
          }}
        />
      )}

      {/* Canvas bar equaliser while active, MicOff icon while muted */}
      {isActive ? (
        <canvas
          ref={canvasRef}
          width={s.canvas}
          height={s.canvas}
          className="block"
          aria-hidden="true"
        />
      ) : (
        <MicOff className={`${s.icon} text-rose-400`} />
      )}

      {/* Admin lock badge */}
      {isAdminLocked && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-600 rounded-full flex items-center justify-center shadow-md">
          <Lock className="w-2.5 h-2.5 text-white" />
        </span>
      )}
    </button>
  );
};
