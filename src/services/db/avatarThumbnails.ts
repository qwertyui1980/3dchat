/**
 * XStreamX - Predefined Avatar Thumbnails & SVG Generator
 *
 * Provee imágenes de vista previa vectoriales ultra-nítidas y de 0ms de carga
 * para los avatares predeterminados y utilidades para capturar miniaturas 3D.
 */

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const PREDEFINED_AVATAR_THUMBNAILS: Record<string, string> = {
  // 1. Lincoln 3D - Sombrero de copa y barba presidencial
  lincoln_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="bg_lincoln" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="18" fill="url(#bg_lincoln)"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#3b82f6" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Sombrero de copa -->
      <path d="M28 42 H72 V14 H28 Z" fill="#0f172a" stroke="#60a5fa" stroke-width="2"/>
      <rect x="20" y="42" width="60" height="6" rx="2" fill="#1e293b" stroke="#93c5fd" stroke-width="1.5"/>
      <rect x="28" y="36" width="44" height="4" fill="#3b82f6"/>
      <!-- Rostro -->
      <path d="M34 48 H66 V66 C66 74 58 80 50 80 C42 80 34 74 34 66 Z" fill="#fbd5b5"/>
      <!-- Ojos y Cejas -->
      <rect x="40" y="56" width="6" height="3" rx="1.5" fill="#1e293b"/>
      <rect x="54" y="56" width="6" height="3" rx="1.5" fill="#1e293b"/>
      <line x1="38" y1="53" x2="47" y2="53" stroke="#1e293b" stroke-width="2"/>
      <line x1="53" y1="53" x2="62" y2="53" stroke="#1e293b" stroke-width="2"/>
      <!-- Barba Lincoln -->
      <path d="M32 60 C32 78 40 85 50 85 C60 85 68 78 68 60 C64 62 62 68 50 68 C38 68 36 62 32 60 Z" fill="#1e293b"/>
      <!-- Traje y Corbata -->
      <path d="M24 94 L38 80 L50 86 L62 80 L76 94 Z" fill="#090d16"/>
      <polygon points="50,86 46,96 54,96" fill="#3b82f6"/>
    </svg>
  `),

  // 2. Biden 3D - Gafas aviador clásicas y traje azul
  biden_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="bg_biden" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e3a8a"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="18" fill="url(#bg_biden)"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#60a5fa" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Cabello Blanco -->
      <path d="M28 38 C28 20 72 20 72 38 C74 46 72 52 70 54 C66 30 34 30 30 54 Z" fill="#f8fafc"/>
      <!-- Rostro -->
      <path d="M32 38 H68 V66 C68 76 60 82 50 82 C40 82 32 76 32 66 Z" fill="#fed7aa"/>
      <!-- Gafas Aviador -->
      <line x1="46" y1="46" x2="54" y2="46" stroke="#fbbf24" stroke-width="2"/>
      <line x1="30" y1="46" x2="36" y2="46" stroke="#fbbf24" stroke-width="1.5"/>
      <line x1="64" y1="46" x2="70" y2="46" stroke="#fbbf24" stroke-width="1.5"/>
      <path d="M34 46 H48 V56 C48 60 44 63 41 63 C36 63 34 59 34 56 Z" fill="#0f172a" stroke="#fbbf24" stroke-width="1.5"/>
      <path d="M52 46 H66 V56 C66 59 64 63 59 63 C56 63 52 60 52 56 Z" fill="#0f172a" stroke="#fbbf24" stroke-width="1.5"/>
      <!-- Sonrisa -->
      <path d="M42 71 Q50 76 58 71" stroke="#c2410c" stroke-width="2" fill="none" stroke-linecap="round"/>
      <!-- Traje Presidencial y Corbata Azul -->
      <path d="M22 96 L36 82 L50 87 L64 82 L78 96 Z" fill="#172554"/>
      <polygon points="50,86 46,98 54,98" fill="#38bdf8"/>
    </svg>
  `),

  // 3. Obama 3D - Busto presidencial y corbata
  obama_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="bg_obama" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0369a1"/>
          <stop offset="100%" stop-color="#082f49"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="18" fill="url(#bg_obama)"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Cabello oscuro recortado -->
      <path d="M30 36 C30 22 70 22 70 36 C72 44 70 50 68 52 C66 28 34 28 32 52 Z" fill="#1c1917"/>
      <!-- Rostro -->
      <path d="M33 36 H67 V66 C67 76 60 82 50 82 C40 82 33 76 33 66 Z" fill="#b45309"/>
      <!-- Orejas prominentes -->
      <ellipse cx="30" cy="52" rx="4" ry="7" fill="#b45309"/>
      <ellipse cx="70" cy="52" rx="4" ry="7" fill="#b45309"/>
      <!-- Ojos y Cejas -->
      <ellipse cx="42" cy="50" rx="4" ry="2.5" fill="#1c1917"/>
      <ellipse cx="58" cy="50" rx="4" ry="2.5" fill="#1c1917"/>
      <line x1="37" y1="45" x2="46" y2="46" stroke="#1c1917" stroke-width="2"/>
      <line x1="54" y1="46" x2="63" y2="45" stroke="#1c1917" stroke-width="2"/>
      <!-- Sonrisa blanca característica -->
      <path d="M41 68 Q50 76 59 68 Z" fill="#f8fafc" stroke="#78350f" stroke-width="1.5"/>
      <!-- Traje Azul Marino y Corbata Celeste -->
      <path d="M22 96 L36 82 L50 87 L64 82 L78 96 Z" fill="#0f172a"/>
      <polygon points="50,86 46,98 54,98" fill="#0284c7"/>
    </svg>
  `),

  // 4. Trump 3D - Cabello rubio icónico y corbata roja
  trump_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="bg_trump" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#991b1b"/>
          <stop offset="100%" stop-color="#450a0a"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="18" fill="url(#bg_trump)"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#f87171" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Cabello Dorado Voluminoso -->
      <path d="M24 38 C24 16 78 14 78 36 C82 32 80 44 76 46 C74 24 34 22 26 44 Z" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
      <path d="M26 34 C36 22 64 20 74 32 C68 26 38 24 28 36 Z" fill="#fef08a"/>
      <!-- Rostro -->
      <path d="M32 38 H68 V66 C68 76 60 82 50 82 C40 82 32 76 32 66 Z" fill="#ffedd5"/>
      <!-- Ojos y Cejas Claras -->
      <line x1="37" y1="48" x2="45" y2="49" stroke="#b45309" stroke-width="2.5"/>
      <line x1="55" y1="49" x2="63" y2="48" stroke="#b45309" stroke-width="2.5"/>
      <ellipse cx="42" cy="53" rx="3.5" ry="2" fill="#0369a1"/>
      <ellipse cx="58" cy="53" rx="3.5" ry="2" fill="#0369a1"/>
      <!-- Boca expresiva -->
      <ellipse cx="50" cy="71" rx="4" ry="2.5" fill="#b91c1c"/>
      <!-- Traje Azul y Larga Corbata Roja -->
      <path d="M22 96 L36 82 L50 87 L64 82 L78 96 Z" fill="#0f172a"/>
      <polygon points="50,86 45,98 55,98" fill="#dc2626"/>
    </svg>
  `),

  // 5. Robot 3D (three_robot) - Mecha sci-fi con visor cian
  three_robot: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="bg_bot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#064e3b"/>
          <stop offset="100%" stop-color="#022c22"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="18" fill="url(#bg_bot)"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#10b981" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Antena Central -->
      <line x1="50" y1="16" x2="50" y2="28" stroke="#34d399" stroke-width="3"/>
      <circle cx="50" cy="14" r="4" fill="#06b6d4"/>
      <!-- Cabeza Mecha -->
      <path d="M30 30 H70 L76 72 L64 82 H36 L24 72 Z" fill="#1e293b" stroke="#34d399" stroke-width="2"/>
      <!-- Visor Ocular Brillante -->
      <rect x="34" y="44" width="32" height="12" rx="4" fill="#00f0ff" filter="drop-shadow(0 0 4px #00f0ff)"/>
      <circle cx="44" cy="50" r="2.5" fill="#ffffff"/>
      <circle cx="56" cy="50" r="2.5" fill="#ffffff"/>
      <!-- Rejilla de Boca -->
      <line x1="40" y1="68" x2="60" y2="68" stroke="#06b6d4" stroke-width="2"/>
      <line x1="43" y1="73" x2="57" y2="73" stroke="#06b6d4" stroke-width="2"/>
      <!-- Auriculares Laterales -->
      <rect x="20" y="46" width="6" height="18" rx="2" fill="#334155" stroke="#10b981" stroke-width="1.5"/>
      <rect x="74" y="46" width="6" height="18" rx="2" fill="#334155" stroke="#10b981" stroke-width="1.5"/>
    </svg>
  `),

  // 6. Neon Cyber 3D (neon_holo) - Vectorial con líneas cian neón y labios azules
  neon_holo: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#050814"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#00f0ff" stroke-width="2" stroke-opacity="0.6"/>
      <!-- Silueta de Cabeza Neón -->
      <path d="M32 34 C32 18 68 18 68 34 C72 46 68 66 50 78 C32 66 28 46 32 34 Z" fill="none" stroke="#22d3ee" stroke-width="2.5" filter="drop-shadow(0 0 3px #00f0ff)"/>
      <!-- Orejas redondeadas -->
      <path d="M30 44 C20 44 20 60 30 60" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <path d="M70 44 C80 44 80 60 70 60" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <!-- Partición de Cabello -->
      <path d="M42 20 Q50 30 46 38" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <!-- Cejas arqueadas -->
      <path d="M36 40 Q42 36 46 40" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <path d="M54 40 Q58 36 64 40" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <!-- Ojos elípticos con pupila -->
      <ellipse cx="41" cy="46" rx="5" ry="3" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <circle cx="41" cy="46" r="2" fill="#22d3ee"/>
      <ellipse cx="59" cy="46" rx="5" ry="3" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <circle cx="59" cy="46" r="2" fill="#22d3ee"/>
      <!-- Nariz continua -->
      <path d="M50 44 L48 56 L53 58" fill="none" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>
      <!-- Labios Azul Eléctrico -->
      <ellipse cx="50" cy="67" rx="9" ry="3.5" fill="none" stroke="#3b82f6" stroke-width="2.5" filter="drop-shadow(0 0 3px #3b82f6)"/>
      <!-- Cuello Neón -->
      <path d="M42 75 V88 L26 96" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <path d="M58 75 V88 L74 96" fill="none" stroke="#22d3ee" stroke-width="2"/>
    </svg>
  `),

  // 7. Gato 3D (cat_3d)
  cat_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#451a03"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#f59e0b" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Orejas triangulares -->
      <polygon points="26,38 32,16 50,34" fill="#d97706"/>
      <polygon points="32,32 35,22 45,32" fill="#f43f5e"/>
      <polygon points="74,38 68,16 50,34" fill="#d97706"/>
      <polygon points="68,32 65,22 55,32" fill="#f43f5e"/>
      <!-- Rostro felino -->
      <circle cx="50" cy="54" r="26" fill="#f59e0b"/>
      <!-- Ojos esmeralda -->
      <ellipse cx="40" cy="50" rx="5" ry="6" fill="#10b981"/>
      <ellipse cx="40" cy="50" rx="1.5" ry="5" fill="#0f172a"/>
      <ellipse cx="60" cy="50" rx="5" ry="6" fill="#10b981"/>
      <ellipse cx="60" cy="50" rx="1.5" ry="5" fill="#0f172a"/>
      <!-- Nariz y Bigotes -->
      <polygon points="50,58 46,62 54,62" fill="#f43f5e"/>
      <line x1="34" y1="62" x2="16" y2="59" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="34" y1="66" x2="16" y2="68" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="66" y1="62" x2="84" y2="59" stroke="#ffffff" stroke-width="1.5"/>
      <line x1="66" y1="66" x2="84" y2="68" stroke="#ffffff" stroke-width="1.5"/>
      <!-- Cascabel dorado -->
      <circle cx="50" cy="85" r="7" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
    </svg>
  `),

  // 8. Perro 3D (dog_3d)
  dog_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#172554"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#3b82f6" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Orejas caídas -->
      <ellipse cx="26" cy="46" rx="8" ry="16" fill="#92400e" transform="rotate(-15 26 46)"/>
      <ellipse cx="74" cy="46" rx="8" ry="16" fill="#92400e" transform="rotate(15 74 46)"/>
      <!-- Cabeza -->
      <circle cx="50" cy="50" r="25" fill="#d97706"/>
      <!-- Ojos tiernos -->
      <circle cx="40" cy="44" r="4.5" fill="#1c1917"/>
      <circle cx="38.5" cy="42.5" r="1.5" fill="#ffffff"/>
      <circle cx="60" cy="44" r="4.5" fill="#1c1917"/>
      <circle cx="58.5" cy="42.5" r="1.5" fill="#ffffff"/>
      <!-- Hocico blanco -->
      <ellipse cx="50" cy="62" rx="14" ry="11" fill="#fef3c7"/>
      <ellipse cx="50" cy="56" rx="6" ry="4" fill="#1c1917"/>
      <!-- Lengua sonriente -->
      <path d="M48 68 C48 76 52 76 52 68 Z" fill="#f43f5e"/>
    </svg>
  `),

  // 9. Chica Anime 3D (female_3d)
  female_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#500724"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#ec4899" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Cabello Rosa -->
      <path d="M22 42 C16 66 22 84 26 86 C26 70 28 54 30 46 C36 22 64 22 70 46 C72 54 74 70 74 86 C78 84 84 66 78 42 C76 22 24 22 22 42 Z" fill="#f43f5e"/>
      <!-- Rostro Chibi -->
      <path d="M32 40 H68 V62 C68 74 60 80 50 80 C40 80 32 74 32 62 Z" fill="#ffe4e6"/>
      <!-- Flequillo -->
      <path d="M30 40 L40 50 L50 42 L60 50 L70 40 Z" fill="#f43f5e"/>
      <!-- Ojos Anime Grandes -->
      <ellipse cx="42" cy="56" rx="5" ry="7" fill="#be185d"/>
      <circle cx="40.5" cy="53" r="2" fill="#ffffff"/>
      <ellipse cx="58" cy="56" rx="5" ry="7" fill="#be185d"/>
      <circle cx="56.5" cy="53" r="2" fill="#ffffff"/>
      <!-- Rubor -->
      <ellipse cx="36" cy="65" rx="3.5" ry="1.5" fill="#fda4af"/>
      <ellipse cx="64" cy="65" rx="3.5" ry="1.5" fill="#fda4af"/>
      <!-- Flor sakura -->
      <circle cx="70" cy="34" r="4" fill="#fb7185"/>
    </svg>
  `),

  // 10. Caballo 3D (horse_3d)
  horse_3d: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#2e1065"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Orejas -->
      <polygon points="36,18 42,32 30,32" fill="#7c3aed"/>
      <polygon points="46,18 52,32 40,32" fill="#7c3aed"/>
      <!-- Crin de caballo ondeante -->
      <path d="M34 32 C26 42 24 60 22 80 C28 70 32 50 36 44 Z" fill="#c084fc"/>
      <!-- Rostro estilizado de caballo -->
      <path d="M38 32 L62 36 L72 68 L60 82 L46 72 L42 46 Z" fill="#6d28d9"/>
      <!-- Ojo despierto -->
      <circle cx="50" cy="46" r="3.5" fill="#fbbf24"/>
      <circle cx="49" cy="45" r="1.5" fill="#000000"/>
      <!-- Nariz del hocico -->
      <ellipse cx="66" cy="74" rx="2.5" ry="3.5" fill="#3b0764"/>
    </svg>
  `),

  // 11. Kitsune Fox (fox_sensei)
  fox_sensei: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#431407"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#f97316" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Orejas de zorro largas -->
      <polygon points="20,18 40,36 20,44" fill="#ea580c"/>
      <polygon points="24,24 36,36 24,40" fill="#fee2e2"/>
      <polygon points="80,18 60,36 80,44" fill="#ea580c"/>
      <polygon points="76,24 64,36 76,40" fill="#fee2e2"/>
      <!-- Rostro triangular -->
      <polygon points="50,86 24,44 76,44" fill="#f97316"/>
      <polygon points="50,86 36,52 64,52" fill="#ffffff"/>
      <!-- Ojos rasgados místicos -->
      <path d="M34 50 Q42 46 48 54" stroke="#dc2626" stroke-width="2.5" fill="none"/>
      <path d="M66 50 Q58 46 52 54" stroke="#dc2626" stroke-width="2.5" fill="none"/>
      <!-- Nariz negra -->
      <circle cx="50" cy="80" r="3" fill="#1c1917"/>
    </svg>
  `),

  // 12. Holo Mesh 3D (mesh_outline)
  mesh_outline: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#082f49"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#06b6d4" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Malla 3D Facetada -->
      <polygon points="50,22 32,38 50,44" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polygon points="50,22 68,38 50,44" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polygon points="32,38 28,60 42,60" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polygon points="68,38 72,60 58,60" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polygon points="50,44 42,60 58,60" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polygon points="42,60 50,78 58,60" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polygon points="28,60 50,78 42,60" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <polygon points="72,60 50,78 58,60" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
      <!-- Nodos brillantes -->
      <circle cx="50" cy="22" r="2" fill="#22d3ee"/>
      <circle cx="50" cy="44" r="2" fill="#22d3ee"/>
      <circle cx="50" cy="78" r="2.5" fill="#22d3ee"/>
      <circle cx="32" cy="38" r="2" fill="#22d3ee"/>
      <circle cx="68" cy="38" r="2" fill="#22d3ee"/>
    </svg>
  `),

  // 13. Cyber Nova 3D (cyber_nova)
  cyber_nova: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#030712"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#06b6d4" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Casco / Cara Androide -->
      <path d="M28 34 L50 20 L72 34 L76 68 L50 82 L24 68 Z" fill="#111827" stroke="#0ea5e9" stroke-width="2"/>
      <!-- Monóculo Cibernético -->
      <circle cx="40" cy="48" r="9" fill="none" stroke="#06b6d4" stroke-width="2"/>
      <circle cx="40" cy="48" r="4" fill="#00f0ff" filter="drop-shadow(0 0 3px #00f0ff)"/>
      <line x1="28" y1="48" x2="31" y2="48" stroke="#06b6d4" stroke-width="2"/>
      <line x1="49" y1="48" x2="62" y2="48" stroke="#06b6d4" stroke-width="2"/>
      <circle cx="62" cy="48" r="3" fill="#38bdf8"/>
      <!-- Trazos de Circuito -->
      <path d="M50 82 V70 H60 V62" fill="none" stroke="#06b6d4" stroke-width="1.5"/>
    </svg>
  `),

  // 14. Face Cap 3D (face_cap)
  face_cap: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#0c4a6e"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Contorno craneal humano -->
      <ellipse cx="50" cy="52" rx="24" ry="30" fill="#075985" stroke="#38bdf8" stroke-width="1.5"/>
      <!-- Ojos y Labios -->
      <ellipse cx="40" cy="46" rx="4" ry="2.5" fill="#38bdf8"/>
      <ellipse cx="60" cy="46" rx="4" ry="2.5" fill="#38bdf8"/>
      <ellipse cx="50" cy="66" rx="7" ry="2.5" fill="#38bdf8"/>
      <!-- 52 Puntos de Tracking ARKit -->
      <circle cx="50" cy="28" r="1.5" fill="#7dd3fc"/>
      <circle cx="44" cy="36" r="1.5" fill="#7dd3fc"/>
      <circle cx="56" cy="36" r="1.5" fill="#7dd3fc"/>
      <circle cx="34" cy="46" r="1.5" fill="#7dd3fc"/>
      <circle cx="66" cy="46" r="1.5" fill="#7dd3fc"/>
      <circle cx="50" cy="54" r="1.5" fill="#7dd3fc"/>
      <circle cx="42" cy="66" r="1.5" fill="#7dd3fc"/>
      <circle cx="58" cy="66" r="1.5" fill="#7dd3fc"/>
      <circle cx="50" cy="74" r="1.5" fill="#7dd3fc"/>
    </svg>
  `),

  // 15. Mipipi 3D (mipipi)
  mipipi: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#064e3b"/>
      <rect x="2" y="2" width="96" height="96" rx="16" fill="none" stroke="#10b981" stroke-width="2" stroke-opacity="0.4"/>
      <!-- Cabeza redonda Chibi -->
      <circle cx="50" cy="52" r="28" fill="#a7f3d0"/>
      <!-- Mechones de Cabello Verde -->
      <path d="M26 38 C32 18 68 18 74 38 C70 32 30 32 26 38 Z" fill="#059669"/>
      <!-- Ojos brillantes anime -->
      <ellipse cx="39" cy="50" rx="4.5" ry="6.5" fill="#065f46"/>
      <circle cx="37.5" cy="47" r="2" fill="#ffffff"/>
      <ellipse cx="61" cy="50" rx="4.5" ry="6.5" fill="#065f46"/>
      <circle cx="59.5" cy="47" r="2" fill="#ffffff"/>
      <!-- Rubor tierno -->
      <ellipse cx="33" cy="59" rx="3.5" ry="1.5" fill="#f43f5e" opacity="0.6"/>
      <ellipse cx="67" cy="59" rx="3.5" ry="1.5" fill="#f43f5e" opacity="0.6"/>
      <!-- Sonrisa -->
      <path d="M46 62 Q50 66 54 62" stroke="#065f46" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>
  `),
};

/**
 * Obtiene la imagen de vista previa del avatar o genera un placeholder estilizado
 */
export function getAvatarThumbnail(avatarId: string, customPreview?: string): string {
  if (customPreview) return customPreview;
  if (PREDEFINED_AVATAR_THUMBNAILS[avatarId]) {
    return PREDEFINED_AVATAR_THUMBNAILS[avatarId];
  }

  // Fallback genérico moderno
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="18" fill="#0f172a"/>
      <circle cx="50" cy="42" r="18" fill="#334155"/>
      <path d="M24 84 C24 68 36 64 50 64 C64 64 76 68 76 84 Z" fill="#334155"/>
    </svg>
  `);
}
