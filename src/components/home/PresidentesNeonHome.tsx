import React, { useState, useEffect } from 'react';

interface PresidentesNeonHomeProps {
  onEnterSalon: () => void;
  onOpenLegal?: () => void;
}

export const PresidentesNeonHome: React.FC<PresidentesNeonHomeProps> = ({
  onEnterSalon,
  onOpenLegal,
}) => {
  // Glitch malfunction state for individual neon segments
  const [glitchTarget, setGlitchTarget] = useState<'head1' | 'head2' | 'head3' | 'base' | 'all' | null>(null);

  // Random realistic neon malfunction generator (flicker, hum, voltage drop)
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerGlitchCycle = () => {
      // Random wait between 2.2s and 5.8s
      const delay = Math.random() * 3600 + 2200;

      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        // Choose which element malfunctions
        const roll = Math.random();
        let target: 'head1' | 'head2' | 'head3' | 'base' | 'all';
        if (roll < 0.28) target = 'head1';        // Red head
        else if (roll < 0.56) target = 'head2';   // White head
        else if (roll < 0.82) target = 'head3';   // Blue head
        else if (roll < 0.92) target = 'base';    // Yellow frame and letters
        else target = 'all';                      // Whole neon installation

        setGlitchTarget(target);

        // Realistic stutter duration (between 160ms and 420ms)
        const duration = Math.random() * 260 + 160;
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
  const isBaseGlitched = glitchTarget === 'base' || glitchTarget === 'all';

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#080b0e] flex flex-col items-center justify-center px-4 py-8 select-none overflow-hidden">
      {/* Full-Page Authentic Black Brick Wall Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-opacity duration-700"
        style={{ backgroundImage: "url('/images/dark_brick_wall.jpg')" }}
      />
      {/* Atmospheric dark vignette and depth shading */}
      <div className="absolute inset-0 bg-radial from-transparent via-black/35 to-black/80 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75 pointer-events-none" />

      {/* Ambient neon glow cast on the brick masonry */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[400px] bg-yellow-500/[0.08] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[360px] bg-cyan-500/[0.09] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[260px] bg-blue-600/[0.07] rounded-full blur-[100px] pointer-events-none" />

      {/* Main Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full">

        {/* Multi-Layer Authentic Neon Sign with Independent Segment Glitching */}
        <div
          className="relative flex items-center justify-center max-w-[340px] sm:max-w-[500px] md:max-w-[620px] lg:max-w-[720px] w-full aspect-[1433/1090] px-2 filter drop-shadow-[0_0_24px_rgba(250,204,21,0.45)] drop-shadow-[0_0_48px_rgba(56,189,248,0.25)] transition-all duration-300"
        >
          {/* Layer 1: Base Sign (Outer Yellow Frame + 3D Letter Bodies + Yellow Contour + Y VIVOS.) */}
          <img
            src="/images/neon_sign_base.png"
            alt="Letrero Neón Base"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isBaseGlitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />

          {/* Layer 2: Head 1 (Left - Glowing Red Neon) */}
          <img
            src="/images/neon_head_red.png"
            alt="Figura 1 Neón Rojo"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isHead1Glitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />

          {/* Layer 3: Head 2 (Center - Glowing White / Ice-Blue Neon) */}
          <img
            src="/images/neon_head_white.png"
            alt="Figura 2 Neón Blanco"
            className={`absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-all duration-75 ${
              isHead2Glitched ? 'neon-flickering' : 'animate-neon-hum'
            }`}
            draggable={false}
          />

          {/* Layer 4: Head 3 (Right - Glowing Blue / Cyan Neon) */}
          <img
            src="/images/neon_head_blue.png"
            alt="Figura 3 Neón Azul"
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
        <div className="flex flex-row items-center justify-center gap-3 sm:gap-5 mt-6 sm:mt-9">
          {/* Botón: Entrar al salón */}
          <button
            type="button"
            onClick={onEnterSalon}
            className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-full bg-[#4f8bf9] hover:bg-[#3b82f6] text-[#07131e] font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
          >
            Entrar al salón
          </button>

          {/* Botón: Ver el show de esta noche (lleva a youtube.com) */}
          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 sm:px-7 py-2.5 sm:py-3 rounded-full bg-transparent hover:bg-cyan-950/40 text-[#5eead4] hover:text-[#2dd4bf] border border-[#5eead4] hover:border-cyan-300 font-bold text-xs sm:text-sm tracking-wide shadow-sm hover:shadow-cyan-500/20 transition-all transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
          >
            Ver el show de esta noche
          </a>
        </div>

      </div>

      {/* Footer Discreto con Atribución y Licencia */}
      {onOpenLegal && (
        <div className="absolute bottom-3 text-center text-[10px] text-cyan-500/50 hover:text-cyan-300 transition flex items-center gap-2">
          <span>Apache 2.0</span>
          <span>•</span>
          <span>-</span>
          <span>•</span>
          <button
            type="button"
            onClick={onOpenLegal}
            className="underline cursor-pointer hover:text-cyan-200"
          >
            Términos y Licencia
          </button>
        </div>
      )}
    </div>
  );
};
