import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, ArrowLeft, X } from 'lucide-react';
import { dbServiceSingleton } from '../../services/dbService';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';
import { LegalDisclaimerModal } from '../common/LegalDisclaimerModal';
import { PresidentesNeonHome } from '../home/PresidentesNeonHome';

export interface AuthenticatedUser {
  username: string;
  name: string;
  role: 'admin' | 'participant';
  avatarId?: string;
  provider?: 'local';
}

interface LoginProps {
  onLogin: (user: AuthenticatedUser) => void;
  onOpenRegister?: () => void;
  onOpenFaces?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, onOpenRegister, onOpenFaces }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

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
      // Validate credentials against centralized online Supabase DB
      const userAccount = await dbServiceSingleton.authenticateUser(cleanUser, trimmedPass);

      if (!userAccount) {
        if (cleanUser === 'admin') {
          setError('Contraseña incorrecta para la cuenta de Administrador.');
        } else if (cleanUser.startsWith('presi')) {
          setError(`Contraseña incorrecta para el usuario ${cleanUser}.`);
        } else {
          setError('Usuario o contraseña no válidos. Verifica tus credenciales.');
        }
        setIsLoading(false);
        return;
      }

      const role: 'admin' | 'participant' = userAccount.role;
      const displayName = userAccount.name;
      const targetAvatarId = userAccount.avatarId || (cleanUser === 'admin' ? 'lincoln_3d' : 'lincoln_3d');

      const userRecord = await dbServiceSingleton.upsertUser({
        id: `user_${cleanUser}`,
        username: cleanUser,
        name: displayName,
        role: role,
        provider: 'local',
        password: trimmedPass,
        avatarId: targetAvatarId as any,
        createdAt: userAccount.createdAt || Date.now(),
      });

      // Synchronize all custom avatars created by this user from Supabase online
      avatarModelServiceSingleton.syncUserCloudAvatars(cleanUser).catch(() => {});

      // Save user-scoped selected avatar in localStorage to avoid collisions
      if (typeof window !== 'undefined') {
        localStorage.setItem(`xstreamx_selected_avatar_${cleanUser}`, targetAvatarId);
        localStorage.setItem('xstreamx_selected_avatar', targetAvatarId);
      }

      onLogin({
        username: userRecord.username,
        name: userRecord.name,
        role: userRecord.role,
        avatarId: targetAvatarId,
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
        onOpenRegister={onOpenRegister}
        onOpenFaces={onOpenFaces}
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
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-yellow-400 font-semibold transition cursor-pointer"
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
                <h2 className="text-2xl sm:text-3xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-yellow-100 to-amber-200">
                  Acceso al Salón
                </h2>
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
                      className="w-full pl-10 pr-4 py-2.5 bg-[#070709] border border-white/[0.08] focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
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
                      className="w-full pl-10 pr-10 py-2.5 bg-[#070709] border border-white/[0.08] focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
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
                  className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 hover:from-yellow-300 hover:to-amber-200 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-yellow-500/25 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
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

                {/* Link to Register Page */}
                {onOpenRegister && (
                  <div className="text-center pt-2 text-xs text-neutral-400">
                    ¿No tienes una cuenta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setShowLoginForm(false);
                        onOpenRegister();
                      }}
                      className="text-yellow-400 hover:text-yellow-300 font-bold underline cursor-pointer"
                    >
                      Crear nuevo perfil aquí
                    </button>
                  </div>
                )}
              </form>

            </div>
          </div>
        </div>
      )}

      {/* Modal de Términos Legales */}
      <LegalDisclaimerModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />
    </div>
  );
};
