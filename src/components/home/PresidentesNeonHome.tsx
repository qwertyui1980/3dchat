import React, { useState, useEffect, useRef, useCallback } from 'react';

interface PresidentesNeonHomeProps {
  onEnterSalon: () => void;
  onOpenLegal?: () => void;
}

interface Spark {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export const PresidentesNeonHome: React.FC<PresidentesNeonHomeProps> = ({
  onEnterSalon,
  onOpenLegal,
}) => {
  // Glitch malfunction state:
  // 'head1' (Red), 'head2' (White), 'head3' (Blue), 'r_letters' (R in PRESIDENTES and MUERTOS),
  // 'base' (Open yellow frame + rest of text), 'all' (Global electrical drop)
  const [glitchTarget, setGlitchTarget] = useState<'head1' | 'head2' | 'head3' | 'r_letters' | 'base' | 'all' | null>(null);

  // Canvas ref for interactive spark particle physics
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<Spark[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Spark burst on user click anywhere
  const triggerSparksAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const sparkColors = [
      '#ffd700', // Electric gold
      '#fff5a6', // Hot white/yellow
      '#ffffff', // Core incandescent white
      '#ff2a4b', // Neon red spark
      '#38bdf8', // Neon blue spark
      '#ff8800', // Amber spark
    ];

    const count = Math.floor(Math.random() * 20) + 28;
    const newSparks: Spark[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8.5 + 2.5;
      const maxLife = Math.random() * 26 + 18;
      newSparks.push({
        id: Math.random() + Date.now(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2.8,
        size: Math.random() * 3.0 + 1.2,
        color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        alpha: 1.0,
        life: 0,
        maxLife,
      });
    }

    sparksRef.current.push(...newSparks);

    // Reactive electrical shock/flicker on click:
    // Favors the letter R and figures as requested
    const roll = Math.random();
    if (roll < 0.35) setGlitchTarget('r_letters');
    else if (roll < 0.6) setGlitchTarget('head1');
    else if (roll < 0.8) setGlitchTarget('head3');
    else setGlitchTarget('head2');

    setTimeout(() => {
      setGlitchTarget(null);
    }, 150);
  }, []);

  // Canvas animation loop for sparks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let active = true;

    const resize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (!active || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const sparks = sparksRef.current;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.24; // Gravity
        s.vx *= 0.97; // Drag
        s.life++;
        s.alpha = Math.max(0, 1.0 - s.life / s.maxLife);

        if (s.alpha <= 0 || s.life >= s.maxLife) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = s.color;

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Trail streak
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size * 0.75;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * 2.2, s.y - s.vy * 2.2);
        ctx.stroke();

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      active = false;
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Random realistic neon malfunction generator (flicker, hum, voltage drops)
  // Specifically triggers faults in the 3 figures and the letter 'R's!
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerGlitchCycle = () => {
      // Random delay between 1.8s and 5.0s
      const delay = Math.random() * 3200 + 1800;

      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        // Probabilities targeting the user's specific request:
        // Faults in the 3 figures and in the letters R!
        const roll = Math.random();
        let target: 'head1' | 'head2' | 'head3' | 'r_letters' | 'base' | 'all';
        if (roll < 0.28) target = 'r_letters';   // Letters R flickering
        else if (roll < 0.52) target = 'head1';   // Figure 1 (Red)
        else if (roll < 0.74) target = 'head2';   // Figure 2 (White)
        else if (roll < 0.90) target = 'head3';   // Figure 3 (Blue)
        else if (roll < 0.96) target = 'base';    // Yellow open frame
        else target = 'all';                      // Full installation drop

        setGlitchTarget(target);

        // Realistic stutter duration (between 150ms and 400ms)
        const duration = Math.random() * 250 + 150;
        setTimeout(() => {
          if (isMounted) {
            setGlitchTarget(null);
            triggerGlitchCycle();
          }
        }, duration);
      }, delay);
    };

    triggerGlitchCycle();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const isHead1Glitched = glitchTarget === 'head1' || glitchTarget === 'all';
  const isHead2Glitched = glitchTarget === 'head2' || glitchTarget === 'all';
  const isHead3Glitched = glitchTarget === 'head3' || glitchTarget === 'all';
  const isRGlitched = glitchTarget === 'r_letters' || glitchTarget === 'all';
  const isBaseGlitched = glitchTarget === 'base' || glitchTarget === 'all';

  return (
    <div
      onClick={(e) => triggerSparksAt(e.clientX, e.clientY)}
      className="relative min-h-[100dvh] w-full bg-[#080b0e] flex flex-col items-center justify-center px-4 py-8 select-none overflow-hidden cursor-crosshair"
    >
      {/* Full-Page Authentic Black Brick Wall Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-opacity duration-700"
        style={{ backgroundImage: "url('/images/dark_brick_wall.jpg')" }}
      />
      {/* Atmospheric dark vignette and depth shading */}
      <div className="absolute inset-0 bg-radial from-transparent via-black/35 to-black/80 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75 pointer-events-none" />

      {/* Ambient photorealistic neon glow cast on the brick masonry */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[780px] h-[420px] bg-yellow-500/[0.09] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[370px] bg-cyan-500/[0.10] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-[540px] h-[270px] bg-blue-600/[0.08] rounded-full blur-[100px] pointer-events-none" />

      {/* Interactive Sparks Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-30"
      />

      {/* Main Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full">

        {/* Photorealistic Multi-Layer Neon Lamp Installation (Frameless) */}
        <div
          className="relative flex items-center justify-center max-w-[340px] sm:max-w-[500px] md:max-w-[620px] lg:max-w-[730px] w-full aspect-[1396/1063] px-2 filter drop-shadow-[0_0_24px_rgba(255,255,255,0.4)] drop-shadow-[0_0_50px_rgba(56,189,248,0.32)] transition-all duration-300"
        >
          {/* Layer 1: Base Sign (White Typography Tubes without R) */}
          <img
            src="/images/photoreal_neon_base.png"
            alt="Letrero Neón Base Sin Marco"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isBaseGlitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />

          {/* Layer 2: Letters 'R' in PRESIDENTES & MUERTOS (Flickering / Electrical Fault) */}
          <img
            src="/images/photoreal_neon_r.png"
            alt="Letras R Neón con Fallas"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isRGlitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />

          {/* Layer 3: Head 1 (Left - Glowing Red Neon Lamp) */}
          <img
            src="/images/photoreal_head_red.png"
            alt="Figura 1 Neón Rojo"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isHead1Glitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />

          {/* Layer 4: Head 2 (Center - Glowing White / Ice-Blue Neon Lamp) */}
          <img
            src="/images/photoreal_head_white.png"
            alt="Figura 2 Neón Blanco Hielo"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isHead2Glitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />

          {/* Layer 5: Head 3 (Right - Glowing Blue / Cyan Neon Lamp) */}
          <img
            src="/images/photoreal_head_blue.png"
            alt="Figura 3 Neón Azul Cian"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isHead3Glitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />
        </div>

        {/* Semantic Title for SEO and Screen Readers */}
        <h1 className="sr-only">
          Presidentes Muertos y Vivos
        </h1>

        {/* Botones de Acción */}
        <div className="flex flex-row items-center justify-center gap-3 sm:gap-5 mt-6 sm:mt-9 z-20">
          {/* Botón: Entrar al salón */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEnterSalon();
            }}
            className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-[#4f8bf9] hover:bg-[#3b82f6] text-[#07131e] font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
          >
            Entrar al salón
          </button>

          {/* Botón: Ver el show de esta noche (lleva a youtube.com) */}
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-transparent hover:bg-cyan-950/40 text-[#5eead4] hover:text-[#2dd4bf] border border-[#5eead4] hover:border-cyan-300 font-bold text-xs sm:text-sm tracking-wide shadow-sm hover:shadow-cyan-500/20 transition-all transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
          >
            Ver el show de esta noche
          </a>
        </div>

      </div>

      {/* Footer Discreto con Atribución y Licencia */}
      {onOpenLegal && (
        <div className="absolute bottom-3 text-center text-[10px] text-cyan-500/50 hover:text-cyan-300 transition flex items-center gap-2 z-20">
          <span>Apache 2.0</span>
          <span>•</span>
          <span>-</span>
          <span>•</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLegal();
            }}
            className="underline cursor-pointer hover:text-cyan-200"
          >
            Términos y Licencia
          </button>
        </div>
      )}
    </div>
  );
};
