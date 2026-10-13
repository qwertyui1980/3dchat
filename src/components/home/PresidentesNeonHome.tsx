import React, { useState, useEffect, useRef } from 'react';

interface PresidentesNeonHomeProps {
  onEnterSalon: () => void;
  onOpenLegal?: () => void;
}

// Letters in the title — spaces are kept as non-glitchable
const TITLE_CHARS = 'Presidentes Muertos'.split('');

export const PresidentesNeonHome: React.FC<PresidentesNeonHomeProps> = ({
  onEnterSalon,
  onOpenLegal,
}) => {
  // Glitch malfunction state for the neon sign (puppets)
  const [glitchTarget, setGlitchTarget] = useState<'head1' | 'head2' | 'head3' | 'all' | 'mouths' | null>(null);

  // Per-letter glitch set — which letter indices are currently dead/dim
  const [deadLetters, setDeadLetters] = useState<Set<number>>(new Set());
  const deadLettersTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Random neon malfunction/flicker generator
  useEffect(() => {
    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const triggerGlitchCycle = () => {
      // Random wait between 2.2s and 6.5s
      const delay = Math.random() * 4300 + 2200;

      timeoutId = setTimeout(() => {
        if (!isMounted) return;

        // Choose what part flickers/malfunctions
        const roll = Math.random();
        let target: 'head1' | 'head2' | 'head3' | 'all' | 'mouths';
        if (roll < 0.28) target = 'head1';
        else if (roll < 0.56) target = 'head2';
        else if (roll < 0.82) target = 'head3';
        else if (roll < 0.93) target = 'all';
        else target = 'mouths';

        setGlitchTarget(target);

        // Realistic stutter duration (between 180ms and 450ms)
        const duration = Math.random() * 270 + 180;
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

  // Per-letter random illumination glitch loop
  useEffect(() => {
    let mounted = true;

    const triggerLetterFault = () => {
      // Random delay between 1.5s and 5.5s
      const delay = Math.random() * 4000 + 1500;
      deadLettersTimeoutRef.current = setTimeout(() => {
        if (!mounted) return;

        // Pick 1–3 non-space letter indices
        const eligibleIndices = TITLE_CHARS
          .map((ch, i) => (ch !== ' ' ? i : -1))
          .filter((i) => i >= 0);

        const count = Math.floor(Math.random() * 3) + 1;
        const chosen = new Set<number>();
        while (chosen.size < count && chosen.size < eligibleIndices.length) {
          chosen.add(eligibleIndices[Math.floor(Math.random() * eligibleIndices.length)]);
        }

        setDeadLetters(chosen);

        // Duration of the dead/dim phase: 100ms–500ms
        const duration = Math.random() * 400 + 100;
        setTimeout(() => {
          if (mounted) {
            setDeadLetters(new Set());
            triggerLetterFault();
          }
        }, duration);
      }, delay);
    };

    triggerLetterFault();

    return () => {
      mounted = false;
      if (deadLettersTimeoutRef.current) clearTimeout(deadLettersTimeoutRef.current);
    };
  }, []);

  const isHead1Glitched = glitchTarget === 'head1' || glitchTarget === 'all';
  const isHead2Glitched = glitchTarget === 'head2' || glitchTarget === 'all';
  const isHead3Glitched = glitchTarget === 'head3' || glitchTarget === 'all';
  const isMouthsGlitched = glitchTarget === 'mouths' || glitchTarget === 'all';

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#0a141b] flex flex-col items-center justify-center px-4 py-8 select-none overflow-hidden">
      {/* Dark atmospheric ambient background glows */}
      <div className="absolute inset-0 bg-radial from-[#102431]/60 via-[#0a141b] to-[#070e14] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-cyan-500/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-blue-600/[0.05] rounded-full blur-[100px] pointer-events-none" />

      {/* Main Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full">

        {/* 3 Neon Figures Row */}
        <div className="flex items-center justify-center gap-3 sm:gap-8 md:gap-14 w-full">

          {/* FIGURA 1 (Izquierda: Orejas redondas, raya y pliegue) */}
          <div
            className={`transition-all duration-100 ${isHead1Glitched ? 'neon-flickering' : 'animate-neon-hum'
              }`}
          >
            <svg
              viewBox="0 0 160 210"
              className="w-24 sm:w-36 md:w-44 h-auto overflow-visible neon-glow-cyan"
            >
              {/* Contorno de Cabeza */}
              <path
                d="M 46 80 C 46 44 60 28 80 28 C 100 28 114 44 114 80 C 114 116 102 144 80 144 C 58 144 46 116 46 80 Z"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Oreja Izquierda */}
              <path
                d="M 46 80 C 22 80 22 118 46 118"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Oreja Derecha */}
              <path
                d="M 114 80 C 138 80 138 118 114 118"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Raya de cabello superior izquierda */}
              <path
                d="M 68 29 C 76 44 80 50 82 56"
                stroke="#38bdf8"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Arruga horizontal en la frente */}
              <path
                d="M 58 64 Q 80 60 102 64"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Cejas */}
              <path
                d="M 52 82 Q 62 76 72 81"
                stroke="#38bdf8"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 88 81 Q 98 76 108 82"
                stroke="#38bdf8"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Ojos y pupilas */}
              <path
                d="M 52 95 Q 62 86 72 95 Q 62 104 52 95 Z"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="62" cy="95" r="3.2" fill="#38bdf8" />
              <path
                d="M 88 95 Q 98 86 108 95 Q 98 104 88 95 Z"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="98" cy="95" r="3.2" fill="#38bdf8" />
              {/* Nariz */}
              <path
                d="M 80 92 L 80 116 L 73 118"
                stroke="#38bdf8"
                strokeWidth="2.1"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Pliegue de mentón */}
              <path
                d="M 66 140 Q 80 144 94 140"
                stroke="#38bdf8"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
              {/* Boca Azul Neón */}
              <path
                d="M 65 128 Q 80 134 95 128 Q 80 138 65 128 Z"
                fill="#3b82f6"
                stroke="#60a5fa"
                strokeWidth="1.6"
                className={`transition-opacity ${isMouthsGlitched ? 'opacity-20' : 'neon-glow-blue'}`}
              />
              {/* Cuello y Hombros */}
              <path
                d="M 64 142 L 64 172 C 64 190 28 202 6 206"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 96 142 L 96 172 C 96 190 132 202 154 206"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* FIGURA 2 (Centro: Cabeza oval, casquete y gran sonrisa) */}
          <div
            className={`transition-all duration-100 ${isHead2Glitched ? 'neon-flickering' : 'animate-neon-hum'
              }`}
          >
            <svg
              viewBox="0 0 160 210"
              className="w-24 sm:w-36 md:w-44 h-auto overflow-visible neon-glow-cyan"
            >
              {/* Contorno de Cabeza */}
              <path
                d="M 50 80 C 50 40 62 26 80 26 C 98 26 110 40 110 80 C 110 118 98 144 80 144 C 62 144 50 118 50 80 Z"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Línea de casquete / cabello */}
              <path
                d="M 54 50 C 60 36 70 32 80 32 C 90 32 100 36 106 50"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Orejas */}
              <path
                d="M 50 84 C 36 84 36 114 50 114"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 110 84 C 124 84 124 114 110 114"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Cejas */}
              <path
                d="M 54 81 Q 63 76 72 80"
                stroke="#38bdf8"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 88 80 Q 97 76 106 81"
                stroke="#38bdf8"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Ojos y pupilas */}
              <path
                d="M 54 94 Q 63 85 72 94 Q 63 103 54 94 Z"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="63" cy="94" r="3.2" fill="#38bdf8" />
              <path
                d="M 88 94 Q 97 85 106 94 Q 97 103 88 94 Z"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="97" cy="94" r="3.2" fill="#38bdf8" />
              {/* Nariz */}
              <path
                d="M 80 91 L 80 118 L 74 120"
                stroke="#38bdf8"
                strokeWidth="2.1"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Gran Sonrisa Creciente Azul Neón */}
              <path
                d="M 56 128 Q 80 162 104 128 Q 80 148 56 128 Z"
                fill="#3b82f6"
                stroke="#60a5fa"
                strokeWidth="1.6"
                className={`transition-opacity ${isMouthsGlitched ? 'opacity-20' : 'neon-glow-blue'}`}
              />
              {/* Cuello y Hombros */}
              <path
                d="M 66 142 L 66 172 C 66 190 32 202 8 206"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 94 142 L 94 172 C 94 190 128 202 152 206"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* FIGURA 3 (Derecha: 3 ondas en frente, mueca / sonrisa inclinada) */}
          <div
            className={`transition-all duration-100 ${isHead3Glitched ? 'neon-flickering' : 'animate-neon-hum'
              }`}
          >
            <svg
              viewBox="0 0 160 210"
              className="w-24 sm:w-36 md:w-44 h-auto overflow-visible neon-glow-cyan"
            >
              {/* Contorno de Cabeza */}
              <path
                d="M 48 80 C 48 42 60 26 80 26 C 100 26 112 42 112 80 C 112 118 100 144 80 144 C 60 144 48 118 48 80 Z"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 3 Ondas de cabello / arrugas en la frente */}
              <path
                d="M 58 38 Q 80 28 102 38"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 56 48 Q 80 38 104 48"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 54 58 Q 80 48 106 58"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Arruga inferior */}
              <path
                d="M 60 70 Q 80 66 100 70"
                stroke="#38bdf8"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
              {/* Orejas */}
              <path
                d="M 48 82 C 26 82 26 116 48 116"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 112 82 C 134 82 134 116 112 116"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Cejas */}
              <path
                d="M 52 81 Q 62 76 72 81"
                stroke="#38bdf8"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M 88 81 Q 98 76 108 81"
                stroke="#38bdf8"
                strokeWidth="2.2"
                fill="none"
                strokeLinecap="round"
              />
              {/* Ojos y pupilas */}
              <path
                d="M 52 94 Q 62 85 72 94 Q 62 103 52 94 Z"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="62" cy="94" r="3.2" fill="#38bdf8" />
              <path
                d="M 88 94 Q 98 85 108 94 Q 98 103 88 94 Z"
                stroke="#38bdf8"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="98" cy="94" r="3.2" fill="#38bdf8" />
              {/* Nariz */}
              <path
                d="M 80 91 L 80 117 L 73 119"
                stroke="#38bdf8"
                strokeWidth="2.1"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Mueca / Sonrisa inclinada hacia la derecha */}
              <path
                d="M 64 136 Q 80 144 100 130 Q 80 136 64 136 Z"
                fill="#3b82f6"
                stroke="#60a5fa"
                strokeWidth="1.6"
                className={`transition-opacity ${isMouthsGlitched ? 'opacity-20' : 'neon-glow-blue'}`}
              />
              {/* Cuello y Hombros */}
              <path
                d="M 64 142 L 64 172 C 64 190 28 202 6 206"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 96 142 L 96 172 C 96 190 132 202 154 206"
                stroke="#38bdf8"
                strokeWidth="2.3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

        </div>



        {/* Título Principal: Presidentes Muertos — letters glitch individually */}
        <h1 className="neon-text-title text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mt-2 sm:mt-3 text-center select-none">
          {TITLE_CHARS.map((char, i) =>
            char === ' ' ? (
              <span key={i}>&nbsp;</span>
            ) : (
              <span
                key={i}
                className="inline-block transition-all duration-75"
                style={deadLetters.has(i) ? {
                  opacity: Math.random() > 0.5 ? 0.07 : 0.25,
                  textShadow: 'none',
                  filter: 'none',
                  color: '#1e3a5f',
                } : undefined}
              >
                {char}
              </span>
            )
          )}
        </h1>
        {/* Subtítulo: ...y vivos. */}
        <h3 className="neon-text-club text-sm sm:text-base md:text-xl font-bold tracking-wider mt-7 sm:mt-10 uppercase">
          ...y vivos.
        </h3>
        {/* Botones de Acción */}
        <div className="flex flex-row items-center justify-center gap-3 sm:gap-5 mt-7 sm:mt-10">
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
