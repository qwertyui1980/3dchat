import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Box,
} from 'lucide-react';
import { AuthenticatedUser } from './Login';
import { dbServiceSingleton } from '../../services/dbService';
import { indexedDbService, UserAccount } from '../../services/db/indexedDbService';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';
import { AvatarDefinition, AvatarId } from '../../types';

interface RegisterProps {
  onRegisterSuccess: (user: AuthenticatedUser) => void;
  onNavigateLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({
  onRegisterSuccess,
  onNavigateLogin,
}) => {
  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>('lincoln_3d');

  // UI States
  const [avatarsList, setAvatarsList] = useState<AvatarDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  useEffect(() => {
    // Load active avatars from catalog
    const all = avatarModelServiceSingleton.getActiveAvatars();
    setAvatarsList(all);
  }, []);

  // Username validation helper
  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    setUsername(clean);
    setUsernameError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUsernameError(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Validation
    if (!cleanUser || cleanUser.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.');
      return;
    }

    if (!cleanPass || cleanPass.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setError('Las contraseñas no coinciden. Verifícalas.');
      return;
    }

    setIsLoading(true);

    try {
      // 2. Check username availability in Supabase Cloud
      const isAvailableInCloud = await dbServiceSingleton.isUsernameAvailable(cleanUser);
      if (!isAvailableInCloud) {
        setUsernameError(`El usuario "${cleanUser}" ya existe en la base de datos Supabase. Elige otro alias.`);
        setIsLoading(false);
        return;
      }

      // 3. Save User Account directly into centralized Supabase DB
      const now = Date.now();
      const displayName = cleanUser;
      const userAccount: UserAccount = {
        id: `user_${cleanUser}`,
        username: cleanUser,
        name: displayName,
        role: 'participant',
        provider: 'local',
        password: cleanPass,
        avatarId: selectedAvatarId,
        bio: '',
        createdAvatars: [],
        createdAt: now,
      };

      await dbServiceSingleton.saveUser(userAccount);

      // Save user-scoped selected avatar in localStorage to avoid collisions
      if (typeof window !== 'undefined') {
        localStorage.setItem(`xstreamx_selected_avatar_${cleanUser}`, selectedAvatarId);
        localStorage.setItem('xstreamx_selected_avatar', selectedAvatarId);
      }

      // 5. Direct sign in and notify parent app
      const authenticatedUser: AuthenticatedUser = {
        username: cleanUser,
        name: displayName,
        role: 'participant',
        avatarId: selectedAvatarId,
        provider: 'local',
      };

      onRegisterSuccess(authenticatedUser);
    } catch (err: any) {
      setError(err?.message || 'Error inesperado durante el registro. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[100dvh] relative overflow-y-auto select-none bg-[#08090d] text-neutral-100 flex flex-col justify-between p-3 sm:p-6 md:p-8">
      {/* Background Neon Ambient Glows matching the sign: Yellow, Blue, Red */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-rose-600/10 blur-[130px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
      <div className="fixed top-[40%] left-[30%] w-[400px] h-[400px] rounded-full bg-yellow-500/5 blur-[150px] pointer-events-none" />

      {/* Top Header Navigation */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between z-10 mb-6">
        <button
          type="button"
          onClick={onNavigateLogin}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-yellow-400 border border-white/[0.08] text-xs font-semibold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-yellow-400" />
          <span>Volver al Inicio / Salón</span>
        </button>
      </div>

      {/* Main Registration Form Container */}
      <div className="w-full max-w-4xl mx-auto bg-[#0b0e15]/95 border border-white/[0.1] backdrop-blur-2xl rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl z-10 my-auto">
        
        {/* Title Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-yellow-100 to-amber-200">
            Crea tu Perfil y Elige tu Avatar 3D
          </h1>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-semibold animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* STEP 1: Datos de la Cuenta */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <div className="w-6 h-6 rounded-lg bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-sm shadow-yellow-500/30">
                1
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Datos de la Cuenta
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Username Input */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Nombre de Usuario (Alias Único) <span className="text-yellow-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="ej. satoshi, elena_3d, neo"
                    autoComplete="username"
                    required
                    className={`w-full pl-10 pr-4 py-2.5 bg-[#06070a] border rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition font-mono ${
                      usernameError
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-white/[0.1] focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30'
                    }`}
                  />
                </div>
                {usernameError ? (
                  <p className="text-[11px] text-rose-400 mt-1 font-semibold">{usernameError}</p>
                ) : (
                  <p className="text-[10px] text-neutral-500 mt-1">Solo letras, números, guiones y guiones bajos.</p>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Contraseña <span className="text-yellow-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    autoComplete="new-password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-[#06070a] border border-white/[0.1] focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-200 transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Confirmar Contraseña <span className="text-yellow-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    autoComplete="new-password"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-[#06070a] border border-white/[0.1] focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/30 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* STEP 2: Selección de Avatar 3D */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <div className="w-6 h-6 rounded-lg bg-blue-500 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-blue-500/30">
                2
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Elige tu Avatar 3D
              </h2>
            </div>

            {/* Predefined Avatar Carousel / Grid */}
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">
                Selecciona tu personaje biomimético inicial. Podrás cambiarlo o añadir nuevos avatares en cualquier momento:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[320px] overflow-y-auto p-1">
                {avatarsList.map((avatar) => {
                  const isSelected = selectedAvatarId === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setSelectedAvatarId(avatar.id)}
                      className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-yellow-950/40 border-yellow-400 ring-2 ring-yellow-400/40 shadow-lg shadow-yellow-500/20 scale-[1.02]'
                          : 'bg-black/50 border-white/[0.08] hover:border-white/[0.2] hover:bg-black/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase font-bold text-yellow-300 truncate font-mono">
                          {avatar.badge || '3D'}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                        )}
                      </div>

                      {avatar.previewImage ? (
                        <div className="w-full h-16 rounded-xl overflow-hidden bg-black/80 mb-2 flex items-center justify-center">
                          <img src={avatar.previewImage} alt={avatar.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full h-16 rounded-xl bg-slate-900/60 mb-2 flex items-center justify-center text-neutral-600">
                          <Box className="w-6 h-6" />
                        </div>
                      )}

                      <div className="truncate">
                        <span className="font-bold text-white text-xs block truncate">{avatar.name}</span>
                        <span className="text-[10px] text-neutral-400 block truncate">{avatar.category || '3D'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* STEP 3: Submit Registration Button */}
          <div className="pt-4 border-t border-white/[0.08] space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 hover:from-yellow-300 hover:to-amber-200 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-yellow-500/25 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>REGISTRAR PERFIL Y ENTRAR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Login Link */}
            <div className="text-center text-xs text-neutral-400">
              ¿Ya tienes una cuenta registrada?{' '}
              <button
                type="button"
                onClick={onNavigateLogin}
                className="text-yellow-400 hover:text-yellow-300 font-bold underline cursor-pointer"
              >
                Inicia sesión aquí
              </button>
            </div>
          </div>

        </form>

      </div>

      {/* Footer Legal & Apache License Notice */}
      <div className="w-full max-w-4xl mx-auto mt-6 text-center text-[10px] text-neutral-500 flex flex-col items-center gap-1 z-10">
        <span>
          Licenciado bajo la <strong>Apache License 2.0</strong> &ldquo;TAL CUAL&rdquo; sin garantías expresas o implícitas.
        </span>
        <div className="flex items-center gap-2 text-neutral-400">
          <span>Origen: <strong className="text-neutral-300">XStreamX</strong></span>
          <span>•</span>
          <span>Privacidad por Diseño (Cero Transmisión de Video)</span>
        </div>
      </div>

    </div>
  );
};
