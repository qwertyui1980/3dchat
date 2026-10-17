import React, { useEffect, useRef } from 'react';
import { getAssetUrl } from '../../utils/assetUrl';

interface PresidentesNeonHomeProps {
  onEnterSalon: () => void;
  onOpenLegal?: () => void;
}

export const PresidentesNeonHome: React.FC<PresidentesNeonHomeProps> = ({
  onEnterSalon,
  onOpenLegal,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Exact neon flicker animation algorithm from "HomeAnima.html"
  // Features synchronized light spill modulation on the wall (spRed, spWht)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    let isMounted = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const safeTimeout = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        if (isMounted) fn();
      }, delay);
      timeouts.push(id);
      return id;
    };

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));

    const setOpacity = (...els: (SVGElement | null)[]) => (l: number) => {
      els.forEach((e) => {
        if (e) e.style.opacity = String(l);
      });
    };
    const setStroke = (el: SVGElement) => (l: number) => {
      el.style.strokeOpacity = String(l);
    };

    const red = svg.querySelector<SVGGElement>('#figRed');
    const white = svg.querySelector<SVGGElement>('#figWht');
    const blue = svg.querySelector<SVGGElement>('#figBlu');
    const spRed = svg.querySelector<SVGEllipseElement>('#spRed');
    const spWht = svg.querySelector<SVGEllipseElement>('#spWht');
    const Rs = Array.from(svg.querySelectorAll<SVGTSpanElement>('.r'));

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      if (red) red.style.opacity = '1';
      if (white) white.style.opacity = '1';
      if (blue) blue.style.opacity = '1';
      if (spRed) spRed.style.opacity = '1';
      if (spWht) spWht.style.opacity = '1';
      Rs.forEach((r) => {
        r.style.strokeOpacity = '1';
      });
      return;
    }

    // Ráfaga de parpadeos: apaga/enciende rápido y termina encendido
    function burst(set: (l: number) => void, n: number, done?: () => void) {
      let i = 0;
      function step() {
        if (!isMounted) return;
        if (i >= n) {
          set(1);
          done?.();
          return;
        }
        set(i % 2 === 0 ? rand(0.04, 0.3) : rand(0.65, 1));
        i++;
        safeTimeout(step, rand(30, 150));
      }
      step();
    }

    // Ciclo de neón: espera aleatoria -> ráfaga -> repite
    function neon(
      set: (l: number) => void,
      {
        minWait,
        maxWait,
        minBurst = 2,
        maxBurst = 7,
        dead = 0,
      }: {
        minWait: number;
        maxWait: number;
        minBurst?: number;
        maxBurst?: number;
        dead?: number;
      }
    ) {
      set(0.05);
      const loop = () => {
        if (!isMounted) return;
        safeTimeout(() => {
          if (!isMounted) return;
          if (Math.random() < dead) {
            // Tubo "fallando": se apaga un momento y vuelve con ráfaga larga
            set(0.05);
            safeTimeout(() => burst(set, randInt(6, 10), loop), rand(500, 1400));
          } else {
            burst(set, randInt(minBurst, maxBurst) * 2, loop);
          }
        }, rand(minWait, maxWait));
      };
      // Encendido inicial
      safeTimeout(() => burst(set, randInt(6, 10), loop), rand(300, 1400));
    }

    // Azul: siempre encendida
    if (blue) blue.style.opacity = '1';

    // Roja: falla seguido (controla la figura roja y su resplandor derramado en la pared)
    if (red) {
      neon(setOpacity(red, spRed), { minWait: 1500, maxWait: 4000, minBurst: 2, maxBurst: 6 });
    }

    // Blanca: otros tiempos, más espaciados y con apagón ocasional
    if (white) {
      neon(setOpacity(white, spWht), { minWait: 3500, maxWait: 8000, minBurst: 1, maxBurst: 4, dead: 0.3 });
    }

    // Letras R: cada una al azar e independiente
    Rs.forEach((r) => {
      neon(setStroke(r), { minWait: 1200, maxWait: 6000, minBurst: 1, maxBurst: 5, dead: 0.2 });
    });

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full bg-[#050508] flex flex-col items-center justify-center px-4 py-8 select-none overflow-hidden">
      {/* Full-Page Authentic Black Brick Wall Background (Preserved as requested) */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none transition-opacity duration-700"
        style={{ backgroundImage: `url('${getAssetUrl('images/dark_brick_wall.jpg')}')` }}
      />
      {/* Atmospheric dark vignette and depth shading */}
      <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/85 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

      {/* Main Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center max-w-4xl w-full">

        {/* Vector SVG Neon Sign with Complete Physical Construction: Dead Tubes, Clips, Caps, and Spill Lighting */}
        <div className="relative flex items-center justify-center w-full max-w-[340px] sm:max-w-[540px] md:max-w-[680px] lg:max-w-[850px] filter drop-shadow-[0_0_24px_rgba(255,232,26,0.28)] drop-shadow-[0_0_55px_rgba(31,107,255,0.22)]">
          <svg
            ref={svgRef}
            viewBox="0 0 900 720"
            role="img"
            aria-label="Letrero de neón: Presidentes muertos y vivos"
            className="w-full h-auto max-h-[74vh] overflow-visible select-none"
            style={{
              shapeRendering: 'geometricPrecision',
            }}
          >
            <defs>
              <style>{`
                .p-neon-svg * { fill: none; stroke-linecap: round; stroke-linejoin: round; }
                .p-neon-svg .tube { stroke-width: 4.5; }
                .p-neon-svg .core { stroke-width: 1.6; }
                .p-neon-svg .red  { stroke: #ff1f35; }  .p-neon-svg .core-red  { stroke: #ffd2d6; }
                .p-neon-svg .wht  { stroke: #dfe9ff; }  .p-neon-svg .core-wht  { stroke: #ffffff; }
                .p-neon-svg .blu  { stroke: #1f6bff; }  .p-neon-svg .core-blu  { stroke: #c4e1ff; }
                .p-neon-svg .eye-dot { stroke-width: 4; }
                .p-neon-svg text { font-family: "Oswald", "Bebas Neue", Impact, sans-serif; font-weight: 500; stroke: #ffe81a; stroke-width: 3; }
                .p-neon-svg .sign-text { stroke: #ffe81a; }
                .p-neon-svg .fig, .p-neon-svg .sign-text { transition: none; }
                /* Tubos apagados (pintados de negro) que unen los elementos */
                .p-neon-svg .dead { stroke: #14141b; stroke-width: 6; }
                .p-neon-svg .dead-hi { stroke: rgba(255,255,255,.2); stroke-width: 1.4; }
                .p-neon-svg .cable { stroke: #0b0b0f; stroke-width: 4; }
                .p-neon-svg .cap { fill: #23232b; stroke: #6b6b78; stroke-width: 1.5; }
                .p-neon-svg .box { fill: #17171d; stroke: #4a4a56; stroke-width: 2; }
                .p-neon-svg .clip circle { fill: #2b2b33; stroke: #8a8a96; stroke-width: 1.5; }
                .p-neon-svg .clip path { stroke: #8a8a96; stroke-width: 1; }
                /* Luz que el neón derrama sobre la pared */
                .p-neon-svg #spRed { fill: url(#sRed); stroke: none; }
                .p-neon-svg #spWht { fill: url(#sWht); stroke: none; }
                .p-neon-svg #spBlu { fill: url(#sBlu); stroke: none; }
                .p-neon-svg #spYel { fill: url(#sYel); stroke: none; }
              `}</style>

              {/* Brillo de neón: varios desenfoques sumados */}
              <filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b2" />
                <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="b3" />
                <feMerge>
                  <feMergeNode in="b3" />
                  <feMergeNode in="b3" />
                  <feMergeNode in="b2" />
                  <feMergeNode in="b2" />
                  <feMergeNode in="b1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Rostro común */}
              <g id="face">
                <ellipse cx="0" cy="0" rx="55" ry="80" />
                <path d="M-55,-5 C-82,-14 -86,38 -52,32" />
                <path d="M55,-5 C82,-14 86,38 52,32" />
                <ellipse cx="-24" cy="-8" rx="12" ry="6.5" />
                <ellipse cx="24" cy="-8" rx="12" ry="6.5" />
                <circle className="eye-dot" cx="-24" cy="-8" r="1.5" />
                <circle className="eye-dot" cx="24" cy="-8" r="1.5" />
                <path d="M-38,-24 L-12,-22 M12,-22 L38,-24" />
                <path d="M0,-6 L-7,34 L9,37" />
                <path d="M-18,58 Q0,66 18,58" />
                <path d="M-28,76 C-30,125 -45,145 -135,162" />
                <path d="M28,76 C30,125 45,145 135,162" />
              </g>
              <path id="hairRed" d="M-55,-5 C-62,-85 -8,-100 32,-88 C62,-72 57,-22 55,-5 M-22,-88 C8,-65 20,-35 22,-8" />
              <path id="capBlue" d="M-55,-22 C-58,-100 58,-100 55,-22 M-55,-24 L55,-24 M-55,-45 C-20,-52 20,-52 55,-45" />

              <linearGradient id="acr" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity=".07" />
                <stop offset="1" stopColor="#fff" stopOpacity=".015" />
              </linearGradient>

              {/* Clips de fijación a la pared */}
              <g id="clip">
                <circle r="4.5" />
                <path d="M-2.5,0H2.5M0,-2.5V2.5" />
              </g>

              {/* Tubos de puente negros entre electrodos */}
              <g id="links">
                <path d="M35,337 C35,385 42,408 66,430" />
                <path d="M305,337 Q310,353 315,337" />
                <path d="M585,337 Q590,353 595,337" />
                <path d="M865,337 C876,375 850,425 822,466" />
                <path d="M72,495 V523 M722,495 V523" />
              </g>

              {/* Luz de neón sobre la pared (la roja y la blanca parpadean con su figura) */}
              <radialGradient id="sRed">
                <stop offset="0" stopColor="#ff1f35" stopOpacity=".4" />
                <stop offset="1" stopColor="#ff1f35" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sWht">
                <stop offset="0" stopColor="#b4c8ff" stopOpacity=".34" />
                <stop offset="1" stopColor="#b4c8ff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sBlu">
                <stop offset="0" stopColor="#1f6bff" stopOpacity=".4" />
                <stop offset="1" stopColor="#1f6bff" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="sYel">
                <stop offset="0" stopColor="#ffd400" stopOpacity=".28" />
                <stop offset="1" stopColor="#ffd400" stopOpacity="0" />
              </radialGradient>
            </defs>

            <g className="p-neon-svg">
              {/* Luz derramada sobre la pared */}
              <ellipse id="spRed" cx="170" cy="220" rx="220" ry="240" />
              <ellipse id="spWht" cx="450" cy="220" rx="220" ry="240" />
              <ellipse id="spBlu" cx="730" cy="220" rx="220" ry="240" />
              <ellipse id="spYel" cx="430" cy="570" rx="520" ry="280" />

              {/* Tubos de unión apagados y cableado */}
              <use href="#links" className="dead" />
              <use href="#links" className="dead-hi" transform="translate(-1.2 -1.2)" />

              {/* Figura roja */}
              <g id="figRed" className="fig" filter="url(#neon-glow)">
                <g transform="translate(170 175)">
                  <g className="tube red">
                    <use href="#face" />
                    <use href="#hairRed" />
                  </g>
                  <g className="core core-red">
                    <use href="#face" />
                    <use href="#hairRed" />
                  </g>
                </g>
              </g>

              {/* Figura blanca */}
              <g id="figWht" className="fig" filter="url(#neon-glow)">
                <g transform="translate(450 175)">
                  <g className="tube wht">
                    <use href="#face" />
                  </g>
                  <g className="core core-wht">
                    <use href="#face" />
                  </g>
                </g>
              </g>

              {/* Figura azul (siempre encendida) */}
              <g id="figBlu" className="fig" filter="url(#neon-glow)">
                <g transform="translate(730 175)">
                  <g className="tube blu">
                    <use href="#face" />
                    <use href="#capBlue" />
                  </g>
                  <g className="core core-blu">
                    <use href="#face" />
                    <use href="#capBlue" />
                  </g>
                </g>
              </g>

              {/* Texto */}
              <g className="sign-text" filter="url(#neon-glow)">
                <text x="62" y="490" fontSize="150" textLength={670} lengthAdjust="spacingAndGlyphs">
                  P<tspan className="r">R</tspan>ESIDENTES
                </text>
                <text x="62" y="675" fontSize="188" textLength={670} lengthAdjust="spacingAndGlyphs">
                  MUE<tspan className="r">R</tspan>TOS
                </text>
                <text transform="translate(800 470) rotate(90)" fontSize="64" textLength={215} lengthAdjust="spacingAndGlyphs">
                  Y VIVOS.
                </text>
              </g>

              {/* Electrodos y soportes de montaje (sobre los tubos) */}
              <g>
                <circle className="cap" cx={35} cy={337} r={6} />
                <circle className="cap" cx={305} cy={337} r={6} />
                <circle className="cap" cx={315} cy={337} r={6} />
                <circle className="cap" cx={585} cy={337} r={6} />
                <circle className="cap" cx={595} cy={337} r={6} />
                <circle className="cap" cx={865} cy={337} r={6} />
                <circle className="cap" cx={822} cy={466} r={6} />
                <use href="#clip" className="clip" x={170} y={76} />
                <use href="#clip" className="clip" x={450} y={95} />
                <use href="#clip" className="clip" x={730} y={77} />
                <use href="#clip" className="clip" x={72} y={509} />
                <use href="#clip" className="clip" x={722} y={509} />
                <use href="#clip" className="clip" x={310} y={352} />
                <use href="#clip" className="clip" x={590} y={352} />
              </g>
            </g>
          </svg>
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
