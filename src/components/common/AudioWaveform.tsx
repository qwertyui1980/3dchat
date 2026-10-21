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

function drawRoundedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  volume,
  audioVolume,
  isMuted = false,
  color = '#ffe600',
  height = 22,
  width = 68,
  className = '',
  showStatusText = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute effective volume safely (0 to 1)
  const effectiveVolume = Math.max(
    0,
    Math.min(1, typeof volume === 'number' ? volume : typeof audioVolume === 'number' ? audioVolume : 0)
  );

  const volTargetRef = useRef<number>(effectiveVolume);
  const isMutedRef = useRef<boolean>(isMuted);

  useEffect(() => {
    volTargetRef.current = effectiveVolume;
    isMutedRef.current = isMuted;
  }, [effectiveVolume, isMuted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High-DPI setup for crisp retina rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Dynamic number of bars based on available width
    const numBars = Math.max(7, Math.min(13, Math.floor(width / 7.5)));
    const barWidth = 3;
    const totalBarsWidth = numBars * barWidth;
    const gap = (width - 8 - totalBarsWidth) / (numBars - 1);
    const startX = 4;
    const midY = height / 2;
    const maxBarHeight = height - 4;
    const minBarHeight = 2.5;

    // Pre-calculate natural acoustic harmonic weights (peaking in vocal formant zone)
    const acousticWeights = new Float32Array(numBars);
    for (let i = 0; i < numBars; i++) {
      const normX = i / (numBars - 1); // 0 to 1
      // Bell-shaped curve centered around 0.45 (voice resonance)
      const dist = (normX - 0.45) * 2.2;
      acousticWeights[i] = Math.max(0.4, Math.exp(-dist * dist * 1.5));
    }

    const currentBarHeights = new Float32Array(numBars).fill(minBarHeight);
    let animId: number;
    let time = 0;

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const muted = isMutedRef.current;
      const targetVol = muted ? 0 : volTargetRef.current;
      time += 0.08;

      if (muted) {
        // Sleek muted state: clean minimal red status line with soft pill backdrop
        ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
        drawRoundedBar(ctx, 4, midY - 3, width - 8, 6, 3);

        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 4;
        drawRoundedBar(ctx, 8, midY - 1, width - 16, 2, 1);
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      const isSilent = targetVol < 0.02;

      for (let i = 0; i < numBars; i++) {
        let targetH = minBarHeight;

        if (!isSilent) {
          // Acoustic harmonic excitation
          const weight = acousticWeights[i];
          const harmonic =
            Math.sin(time * 2.4 + i * 1.1) * 0.25 +
            Math.cos(time * 3.8 - i * 0.7) * 0.20;
          const energy = Math.max(0, targetVol * (weight + harmonic * targetVol));
          targetH = Math.min(
            maxBarHeight,
            minBarHeight + energy * (maxBarHeight - minBarHeight)
          );
        } else {
          // Idle breathing micro-pulse so user knows mic is active
          const idleRipple = Math.sin(time * 0.5 + i * 0.6) * 0.6;
          targetH = Math.max(2.0, minBarHeight + idleRipple);
        }

        // Snappy attack, smooth decay
        if (targetH > currentBarHeights[i]) {
          currentBarHeights[i] += (targetH - currentBarHeights[i]) * 0.60;
        } else {
          currentBarHeights[i] += (targetH - currentBarHeights[i]) * 0.18;
        }

        const barH = currentBarHeights[i];
        const barX = startX + i * (barWidth + gap);
        const barY = midY - barH / 2;

        if (isSilent) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.45)'; // Slate 400 soft resting
          ctx.shadowBlur = 0;
        } else {
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = Math.min(8, 2 + targetVol * 8);
        }

        drawRoundedBar(ctx, barX, barY, barWidth, barH, barWidth / 2);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [width, height, color]);

  return (
    <div className={`inline-flex items-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block"
      />
      {showStatusText && (
        <span className="text-[10px] font-mono text-slate-400 ml-1.5">
          {isMuted ? 'MUTE' : effectiveVolume > 0.05 ? `${Math.round(effectiveVolume * 100)}%` : 'ACTIVO'}
        </span>
      )}
    </div>
  );
};
