import React, { useRef, useEffect } from 'react';

interface AudioWaveformProps {
  volume?: number; // 0 to 1
  audioVolume?: number; // fallback alias
  isMuted?: boolean;
  color?: string;
  height?: number;
  width?: number;
  className?: string;
  showStatusText?: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  volume,
  audioVolume,
  isMuted = false,
  color = '#22d3ee',
  height = 24,
  width = 80,
  className = '',
  showStatusText = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef<number>(0);
  const smoothVolRef = useRef<number>(0);

  // Compute effective volume safely
  const effectiveVolume = Math.max(
    0,
    Math.min(1, typeof volume === 'number' ? volume : typeof audioVolume === 'number' ? audioVolume : 0)
  );

  const volTargetRef = useRef<number>(effectiveVolume);
  const isMutedRef = useRef<boolean>(isMuted);

  // Keep refs in sync without breaking the animation loop
  useEffect(() => {
    volTargetRef.current = effectiveVolume;
    isMutedRef.current = isMuted;
  }, [effectiveVolume, isMuted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // High-precision smooth volume interpolation
      const target = isMutedRef.current ? 0 : volTargetRef.current;
      smoothVolRef.current += (target - smoothVolRef.current) * 0.3;
      const curVol = smoothVolRef.current;

      ctx.clearRect(0, 0, width, height);
      const midY = height / 2;

      if (isMutedRef.current) {
        // Muted state: Flat red line with dashed center
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(4, midY);
        ctx.lineTo(width - 4, midY);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (curVol < 0.02) {
        // Idle ambient state: Subtle calm breathing ripple
        phaseRef.current += 0.05;
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let x = 4; x <= width - 4; x += 2) {
          const normX = (x - 4) / (width - 8);
          const taper = Math.sin(normX * Math.PI);
          const y = midY + Math.sin(x * 0.12 + phaseRef.current) * 2 * taper;
          if (x === 4) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // Active speaking state: Multi-harmonic energetic soundwave strictly inside widget
        phaseRef.current += 0.18 + curVol * 0.45;
        const maxAmp = midY - 3;
        const amplitude = Math.min(maxAmp, 3 + curVol * maxAmp * 1.2);

        // Primary waveform glow
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 4 + curVol * 8;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;

        ctx.beginPath();
        for (let x = 4; x <= width - 4; x += 1.5) {
          const normX = (x - 4) / (width - 8);
          const taper = Math.sin(normX * Math.PI); // Windowing to pinch edges to zero
          const y =
            midY +
            (Math.sin(normX * 14 + phaseRef.current) * 0.65 +
              Math.sin(normX * 28 - phaseRef.current * 1.4) * 0.35) *
              amplitude *
              taper;

          if (x === 4) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Secondary subtle harmonic overtone
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 4; x <= width - 4; x += 2) {
          const normX = (x - 4) / (width - 8);
          const taper = Math.sin(normX * Math.PI);
          const y =
            midY -
            Math.sin(normX * 18 - phaseRef.current * 0.9) *
              (amplitude * 0.6) *
              taper;

          if (x === 4) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [width, height, color]);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="relative rounded-lg bg-slate-950/90 px-1.5 py-1 border border-slate-800 flex items-center shadow-inner overflow-hidden">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="block"
        />
      </div>
      {showStatusText && (
        <span className="text-[10px] font-mono text-slate-400">
          {isMuted ? 'MUTE' : effectiveVolume > 0.05 ? `${Math.round(effectiveVolume * 100)}%` : 'SILENCIO'}
        </span>
      )}
    </div>
  );
};
