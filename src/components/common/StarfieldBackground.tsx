import React, { useRef, useEffect } from 'react';

interface StarfieldBackgroundProps {
  speed?: number;
  starCount?: number;
  className?: string;
  opacity?: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
  pz: number;
  color: string;
  size: number;
  twinklePhase: number;
}

const STAR_COLORS = [
  'rgba(240, 246, 255, ', // Soft crisp white
  'rgba(56, 189, 248, ',  // Soft cyan
  'rgba(168, 85, 247, ',  // Subtle cosmic violet
  'rgba(99, 102, 241, ',  // Deep indigo
  'rgba(255, 255, 255, ', // Pure bright star
];

export const StarfieldBackground: React.FC<StarfieldBackgroundProps> = ({
  speed = 0.8,
  starCount = 200,
  className = '',
  opacity = 0.65,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    let centerX = width / 2;
    let centerY = height / 2;

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement.clientHeight || window.innerHeight;
      centerX = width / 2;
      centerY = height / 2;
    };

    window.addEventListener('resize', handleResize);

    // Initialize 3D Stars in cylindrical/spherical volume
    const stars: Star[] = [];
    const MAX_DEPTH = 1000;

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * MAX_DEPTH,
        pz: MAX_DEPTH,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        size: Math.random() * 1.5 + 0.5,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    const render = () => {
      // Clear with very subtle cosmic dark fade for graceful motion trails
      ctx.fillStyle = 'rgba(6, 6, 9, 0.45)';
      ctx.fillRect(0, 0, width, height);

      const fov = 280;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];

        // Save previous z for trail rendering
        star.pz = star.z;

        // Move star forward through space
        star.z -= speed;
        star.twinklePhase += 0.03;

        // Recycle star when it passes the camera or goes out of view
        if (star.z <= 1) {
          star.x = (Math.random() - 0.5) * width * 2;
          star.y = (Math.random() - 0.5) * height * 2;
          star.z = MAX_DEPTH;
          star.pz = MAX_DEPTH;
          continue;
        }

        // Project 3D coordinates to 2D screen space
        const k = fov / star.z;
        const px = star.x * k + centerX;
        const py = star.y * k + centerY;

        // If off-screen, reset to back
        if (px < -20 || px > width + 20 || py < -20 || py > height + 20) {
          star.z = MAX_DEPTH;
          star.pz = MAX_DEPTH;
          continue;
        }

        // Previous projected coordinates for subtle smooth velocity streak
        const pk = fov / star.pz;
        const prevPx = star.x * pk + centerX;
        const prevPy = star.y * pk + centerY;

        // Calculate opacity based on depth and gentle twinkling
        const depthRatio = 1 - star.z / MAX_DEPTH;
        const twinkle = Math.sin(star.twinklePhase) * 0.15 + 0.85;
        const starAlpha = Math.min(1, Math.max(0.1, depthRatio * 1.2 * twinkle)) * opacity;

        // Draw soft motion streak
        ctx.beginPath();
        ctx.strokeStyle = `${star.color}${starAlpha})`;
        ctx.lineWidth = Math.max(0.6, (1 - star.z / MAX_DEPTH) * star.size * 1.4);
        ctx.moveTo(prevPx, prevPy);
        ctx.lineTo(px, py);
        ctx.stroke();

        // Draw soft glowing head for nearby stars
        if (star.z < MAX_DEPTH * 0.6) {
          ctx.beginPath();
          ctx.fillStyle = `${star.color}${starAlpha * 1.2})`;
          const radius = Math.max(0.75, (1 - star.z / MAX_DEPTH) * star.size * 1.2);
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [speed, starCount, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none select-none z-0 ${className}`}
      style={{ background: 'transparent' }}
    />
  );
};
