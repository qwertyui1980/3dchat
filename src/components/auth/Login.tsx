import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { dbServiceSingleton } from '../../services/dbService';
import { LegalDisclaimerModal } from '../common/LegalDisclaimerModal';

export interface AuthenticatedUser {
  username: string;
  name: string;
  role: 'admin' | 'participant';
  provider?: 'local';
}

interface LoginProps {
  onLogin: (user: AuthenticatedUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);

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
    <div className="min-h-[100dvh] w-full max-w-full bg-[#070709] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Subtle Soft Ambient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-indigo-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-[#0d0d12]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">

        {/* Header Branding */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-400">
            XSTREAMX
          </h1>
          <p className="text-xs text-neutral-400 mt-1.5 font-medium">
            Videollamadas seguras con avatares 3D y audio reactivo
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
            className="w-full mt-3 py-3 px-4 rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 font-black text-sm tracking-wide shadow-lg shadow-white/10 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>INGRESAR</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer Legal & Origin Disclaimer */}
        <div className="pt-6 text-center text-[10px] text-neutral-500 flex flex-col items-center gap-1">
          <span>
            Software provisto &ldquo;TAL CUAL&rdquo; bajo total responsabilidad personal del usuario.
          </span>
          <div className="flex items-center gap-2 text-neutral-400">
            <span>Origen: <strong className="text-neutral-300">XStreamX</strong></span>
            <span>•</span>
            <button
              type="button"
              onClick={() => setIsLegalOpen(true)}
              className="text-cyan-400/80 hover:text-cyan-300 underline cursor-pointer"
            >
              Ver Licencia y Descargo Legal
            </button>
          </div>
        </div>

      </div>

      <LegalDisclaimerModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />
    </div>
  );
};
