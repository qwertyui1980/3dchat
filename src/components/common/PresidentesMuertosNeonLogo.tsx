import React, { useEffect, useRef } from 'react';

interface PresidentesMuertosNeonLogoProps {
  className?: string;
  showBrickBackground?: boolean;
}

export const PresidentesMuertosNeonLogo: React.FC<PresidentesMuertosNeonLogoProps> = ({
  className = 'h-7 sm:h-9 md:h-10 w-auto',
  showBrickBackground = false,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

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

    const setStroke = (el: SVGElement) => (l: number) => {
      el.style.strokeOpacity = String(Math.max(0.08, l * 0.9));
    };

    const Rs = Array.from(svg.querySelectorAll<SVGTSpanElement>('.pm-r'));

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      Rs.forEach((r) => {
        r.style.strokeOpacity = '0.9';
      });
      return;
    }

    function burst(set: (l: number) => void, n: number, done?: () => void) {
      let i = 0;
      function step() {
        if (!isMounted) return;
        if (i >= n) {
          set(1);
          done?.();
          return;
        }
        set(i % 2 === 0 ? rand(0.05, 0.25) : rand(0.7, 0.95));
        i++;
        safeTimeout(step, rand(30, 130));
      }
      step();
    }

    function neon(
      set: (l: number) => void,
      {
        minWait,
        maxWait,
        minBurst = 1,
        maxBurst = 4,
        dead = 0.15,
      }: {
        minWait: number;
        maxWait: number;
        minBurst?: number;
        maxBurst?: number;
        dead?: number;
      }
    ) {
      set(0.08);
      const loop = () => {
        if (!isMounted) return;
        safeTimeout(() => {
          if (!isMounted) return;
          if (Math.random() < dead) {
            set(0.08);
            safeTimeout(() => burst(set, randInt(4, 7), loop), rand(600, 1300));
          } else {
            burst(set, randInt(minBurst, maxBurst) * 2, loop);
          }
        }, rand(minWait, maxWait));
      };
      safeTimeout(() => burst(set, randInt(4, 7), loop), rand(400, 1400));
    }

    Rs.forEach((r) => {
      neon(setStroke(r), { minWait: 1800, maxWait: 6500, minBurst: 1, maxBurst: 4, dead: 0.15 });
    });

    return () => {
      isMounted = false;
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      title="Presidentes Muertos"
    >
      <svg
        ref={svgRef}
        viewBox="0 0 780 300"
        role="img"
        aria-label="Logo de Neón: Presidentes Muertos"
        className={`h-full w-auto overflow-visible select-none ${
          showBrickBackground
            ? 'rounded-xl shadow-[0_0_20px_rgba(255,225,50,0.08)] border border-white/[0.06]'
            : ''
        }`}
        style={{ shapeRendering: 'geometricPrecision' }}
      >
        <defs>
          {/* Patrón de pared de ladrillos oscuros (solo cuando se activa fondo) */}
          {showBrickBackground && (
            <pattern id="pmBrickWall" width="160" height="80" patternUnits="userSpaceOnUse">
              <rect width="160" height="80" fill="#09090e" />
              <rect x="1" y="1" width="78" height="18" fill="#14141a" />
              <rect x="81" y="1" width="78" height="18" fill="#1a1a22" />
              <rect x="-39" y="21" width="78" height="18" fill="#111116" />
              <rect x="41" y="21" width="78" height="18" fill="#16161d" />
              <rect x="121" y="21" width="78" height="18" fill="#111116" />
              <rect x="1" y="41" width="78" height="18" fill="#17171e" />
              <rect x="81" y="41" width="78" height="18" fill="#121217" />
              <rect x="-39" y="61" width="78" height="18" fill="#15151c" />
              <rect x="41" y="61" width="78" height="18" fill="#191921" />
              <rect x="121" y="61" width="78" height="18" fill="#15151c" />
            </pattern>
          )}

          {/* Filtro sutil no saturado: halo suave y nítido para trazos delgados */}
          <filter id="pm-logo-glow" x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.0" result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.0" result="b2" />
            <feMerge>
              <feMergeNode in="b2" />
              <feMergeNode in="b1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {showBrickBackground && (
            <radialGradient id="pmSpill" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#ffd400" stopOpacity="0.18" />
              <stop offset="60%" stopColor="#ffd400" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#ffd400" stopOpacity="0" />
            </radialGradient>
          )}

          {showBrickBackground && (
            <radialGradient id="pmVignette" cx="50%" cy="50%" r="65%">
              <stop offset="40%" stopColor="#000000" stopOpacity="0" />
              <stop offset="85%" stopColor="#000000" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#070709" stopOpacity="0.95" />
            </radialGradient>
          )}
        </defs>

        {/* Fondo de ladrillos si está habilitado */}
        {showBrickBackground && (
          <g>
            <rect width="780" height="300" rx="16" fill="url(#pmBrickWall)" />
            <rect width="780" height="300" rx="16" fill="url(#pmVignette)" />
            <ellipse cx="390" cy="150" rx="360" ry="120" fill="url(#pmSpill)" />
          </g>
        )}

        {/* Tubos negros de puente verticales entre líneas con electrodos finos */}
        <g opacity="0.75">
          <path d="M45,138 V174 M735,138 V174" stroke="#101015" strokeWidth="3.5" strokeLinecap="round" />
          <path
            d="M45,138 V174 M735,138 V174"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="0.8"
            strokeLinecap="round"
            transform="translate(-0.5, -0.5)"
          />
          {/* Clips de montaje */}
          <circle cx="45" cy="156" r="2.8" fill="#22222a" stroke="#606070" strokeWidth="0.8" />
          <circle cx="735" cy="156" r="2.8" fill="#22222a" stroke="#606070" strokeWidth="0.8" />
          {/* Tapones de electrodo */}
          <circle cx="45" cy="138" r="3.5" fill="#1c1c24" stroke="#4e4e5c" strokeWidth="0.9" />
          <circle cx="45" cy="174" r="3.5" fill="#1c1c24" stroke="#4e4e5c" strokeWidth="0.9" />
          <circle cx="735" cy="138" r="3.5" fill="#1c1c24" stroke="#4e4e5c" strokeWidth="0.9" />
          <circle cx="735" cy="174" r="3.5" fill="#1c1c24" stroke="#4e4e5c" strokeWidth="0.9" />
        </g>

        {/* Texto Neón Amarillo: Trazo Delgado y Luz Desaturada Elegante */}
        <g filter="url(#pm-logo-glow)">
          <g
            stroke="#f5d63d"
            strokeWidth="2.1"
            strokeOpacity="0.92"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <text
              x="40"
              y="136"
              fontSize="136"
              fontFamily="'Oswald', 'Bebas Neue', Impact, sans-serif"
              fontWeight="500"
              textLength="700"
              lengthAdjust="spacingAndGlyphs"
            >
              P<tspan className="pm-r">R</tspan>ESIDENTES
            </text>
            <text
              x="40"
              y="280"
              fontSize="172"
              fontFamily="'Oswald', 'Bebas Neue', Impact, sans-serif"
              fontWeight="500"
              textLength="700"
              lengthAdjust="spacingAndGlyphs"
            >
              MUE<tspan className="pm-r">R</tspan>TOS
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
