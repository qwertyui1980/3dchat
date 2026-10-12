import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck, ArrowLeft, X, ChevronDown } from 'lucide-react';
import { dbServiceSingleton } from '../../services/dbService';
import { LegalDisclaimerModal } from '../common/LegalDisclaimerModal';
import { PresidentesNeonHome } from '../home/PresidentesNeonHome';

export interface AuthenticatedUser {
  username: string;
  name: string;
  role: 'admin' | 'participant';
  provider?: 'local';
}

interface LoginProps {
  onLogin: (user: AuthenticatedUser) => void;
}

const PRIVACY_WORDS: Array<{ text: string; isBold?: boolean }> = [
  { text: 'El' },
  { text: 'rastreo' },
  { text: 'facial' },
  { text: 'opera' },
  { text: '100%', isBold: true },
  { text: 'en', isBold: true },
  { text: 'el', isBold: true },
  { text: 'dispositivo', isBold: true },
  { text: 'del', isBold: true },
  { text: 'usuario', isBold: true },
  { text: '(lado', isBold: true },
  { text: 'cliente)', isBold: true },
  { text: 'y' },
  { text: 'transmite' },
  { text: 'únicamente' },
  { text: 'un' },
  { text: 'flujo' },
  { text: 'ultraligero' },
  { text: 'de' },
  { text: 'blendshapes' },
  { text: 'numéricos' },
  { text: '(pocos', isBold: true },
  { text: 'cientos', isBold: true },
  { text: 'de', isBold: true },
  { text: 'bytes', isBold: true },
  { text: 'por', isBold: true },
  { text: 'fotograma)', isBold: true },
  { text: 'en' },
  { text: 'lugar' },
  { text: 'de' },
  { text: 'video.' },
  { text: 'Cada' },
  { text: 'espectador' },
  { text: 'renderiza' },
  { text: 'el' },
  { text: 'avatar' },
  { text: '3D' },
  { text: 'de' },
  { text: 'forma' },
  { text: 'local,' },
  { text: 'garantizando' },
  { text: 'privacidad', isBold: true },
  { text: 'total,', isBold: true },
  { text: 'optimizando' },
  { text: 'el' },
  { text: 'ancho' },
  { text: 'de' },
  { text: 'banda' },
  { text: 'y' },
  { text: 'eliminando' },
  { text: 'costos' },
  { text: 'de' },
  { text: 'servidor.' },
];

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUser = username.trim();
    const cleanUser = trimmedUser.toLowerCase();
    const trimmedPass = password.trim();

    if (!cleanUser) {
      setError('Por favor escribe tu nombre de usuario.');
      return;
    }
    if (!trimmedPass) {
      setError('Por favor escribe tu contraseña.');
      return;
    }

    setIsLoading(true);

    try {
      // Check admin credentials
      const isAdmin = cleanUser === 'admin' && trimmedPass === 'pass2000';

      // If user typed admin but wrong password
      if (cleanUser === 'admin' && trimmedPass !== 'pass2000') {
        setError('Contraseña incorrecta para la cuenta de Administrador.');
        setIsLoading(false);
        return;
      }

      const role: 'admin' | 'participant' = isAdmin ? 'admin' : 'participant';
      const displayName = cleanUser === 'admin' ? 'Administrador' : trimmedUser;

      const userRecord = await dbServiceSingleton.upsertUser({
        id: `user_${cleanUser}`,
        username: cleanUser,
        name: displayName,
        role: role,
        provider: 'local',
        avatarId: isAdmin ? 'three_robot' : 'cat_3d',
        createdAt: Date.now(),
      });

      onLogin({
        username: userRecord.username,
        name: userRecord.name,
        role: userRecord.role,
        provider: 'local',
      });
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] relative overflow-hidden select-none bg-[#0a141b]">
      {/* 1. Neon "Presidentes Muertos" Home View */}
      <PresidentesNeonHome
        onEnterSalon={() => setShowLoginForm(true)}
        onOpenLegal={() => setIsLegalOpen(true)}
      />

      {/* 2. Modal Reveal: Formulario de Login para Entrar al Salón */}
      {showLoginForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-md my-auto flex flex-col items-center">
            {/* Main Login Card */}
            <div className="w-full bg-[#0d0d12]/95 backdrop-blur-2xl border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-2xl relative">
              {/* Top Navigation Bar: Volver al Club & Close */}
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowLoginForm(false)}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-cyan-300 font-semibold transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver al Club</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLoginForm(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Header Branding */}
              <div className="text-center mb-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400 font-mono">
                  * * * * *
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-400 mt-1">
                  Acceso al Salón
                </h2>
                <p className="text-xs text-neutral-400 mt-1 font-medium">
                  Presidentes Muertos • Avatares 3D biomiméticos
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-600/70 text-rose-200 text-xs font-semibold animate-shake">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Nombre de Usuario
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Tu nombre de usuario o alias"
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#070709] border border-white/[0.08] focus:border-cyan-400 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 bg-[#070709] border border-white/[0.08] focus:border-cyan-400 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-200 transition cursor-pointer"
                      title={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-3 py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-cyan-400/20 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>INGRESAR AL SALÓN</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Footer Legal & Apache License Notice */}
              <div className="pt-5 text-center text-[10px] text-neutral-500 flex flex-col items-center gap-1 border-t border-white/[0.06] mt-5">
                <span>
                  Licenciado bajo la <strong>Apache License 2.0</strong> &ldquo;TAL CUAL&rdquo; sin garantías expresas o implícitas.
                </span>
                <div className="flex items-center gap-2 text-neutral-400">
                  <span>Origen: <strong className="text-neutral-300">XStreamX</strong></span>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setIsLegalOpen(true)}
                    className="text-cyan-400/80 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Ver Licencia Apache 2.0 y Términos Legales
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy-by-Design Architecture Legal Card (Colapsable) */}
            <div className="w-full mt-3 rounded-3xl bg-[#0d0d12]/90 border border-emerald-500/20 backdrop-blur-2xl text-xs text-neutral-300 shadow-xl overflow-hidden transition-all duration-300">
              {/* Encabezado Clicable para Expandir / Colapsar */}
              <button
                type="button"
                onClick={() => setIsPrivacyExpanded((prev) => !prev)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between text-left hover:bg-emerald-500/[0.04] transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Garantía de Privacidad y Flujo</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-[9px] font-mono font-black text-cyan-300 uppercase">
                    Apache 2.0
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-neutral-400 transition-transform duration-300 ${isPrivacyExpanded ? 'rotate-180 text-emerald-300' : ''
                      }`}
                  />
                </div>
              </button>

              {/* Contenido Expandible Animado Palabra por Palabra */}
              {isPrivacyExpanded && (
                <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1.5 space-y-2.5 border-t border-white/[0.06] animate-in fade-in duration-200">
                  <p className="text-[11px] text-neutral-300/90 leading-relaxed flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                    {PRIVACY_WORDS.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-block animate-word-reveal"
                        style={{ animationDelay: `${idx * 22}ms` }}
                      >
                        {item.isBold ? (
                          <strong className="text-white font-bold">{item.text}</strong>
                        ) : (
                          <span>{item.text}</span>
                        )}
                      </span>
                    ))}
                  </p>
                  <div className="pt-1.5 flex items-center justify-end text-[10px] text-neutral-400 border-t border-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => setIsLegalOpen(true)}
                      className="text-cyan-400 hover:text-cyan-300 underline font-semibold cursor-pointer"
                    >
                      Detalles Legales
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Términos Legales */}
      <LegalDisclaimerModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />
    </div>
  );
};
