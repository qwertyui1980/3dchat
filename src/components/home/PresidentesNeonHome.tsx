import React, { useState, useEffect } from 'react';

interface PresidentesNeonHomeProps {
  onEnterSalon: () => void;
  onOpenLegal?: () => void;
}

export const PresidentesNeonHome: React.FC<PresidentesNeonHomeProps> = ({
  onEnterSalon,
  onOpenLegal,
}) => {
  // Glitch malfunction state for the neon sign
  const [glitchActive, setGlitchActive] = useState<boolean>(false);

  // Random realistic neon malfunction/flicker generator
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerGlitchCycle = () => {
      // Random wait between 2.5s and 6.5s
      const delay = Math.random() * 4000 + 2500;

      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        setGlitchActive(true);

        // Realistic stutter duration (between 160ms and 400ms)
        const duration = Math.random() * 240 + 160;
        setTimeout(() => {
          if (isMounted) {
            setGlitchActive(false);
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[400px] bg-yellow-500/[0.07] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[360px] bg-cyan-500/[0.08] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-[520px] h-[260px] bg-blue-600/[0.06] rounded-full blur-[100px] pointer-events-none" />

      {/* Main Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full">

        {/* Authentic Neon Sign — Separated from background with full transparency and neon glow */}
        <div
          className={`relative transition-all duration-100 flex items-center justify-center max-w-[340px] sm:max-w-[500px] md:max-w-[620px] lg:max-w-[700px] w-full px-2 ${
            glitchActive ? 'neon-flickering' : 'animate-neon-hum'
          }`}
        >
          <img
            src="/images/presidentes_neon_clean.png"
            alt="Presidentes Muertos y Vivos — Letrero de Neón Oficial"
            className="w-full h-auto object-contain select-none pointer-events-none filter drop-shadow-[0_0_20px_rgba(250,204,21,0.45)] drop-shadow-[0_0_45px_rgba(56,189,248,0.22)] hover:drop-shadow-[0_0_35px_rgba(250,204,21,0.7)] transition-all duration-300"
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
