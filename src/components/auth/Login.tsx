import React, { useState, useEffect } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { dbServiceSingleton } from '../../services/dbService';

export interface AuthenticatedUser {
  username: string;
  name: string;
  role: 'admin' | 'participant';
  provider?: 'local' | 'x';
  xHandle?: string;
}

interface LoginProps {
  onLogin: (user: AuthenticatedUser) => void;
}

const VALID_LOCAL_USERS: Record<string, { pass: string; name: string; role: 'admin' | 'participant' }> = {
  admin: {
    pass: 'pass2000',
    name: 'Admin',
    role: 'admin',
  },
  avatar: {
    pass: 'pass',
    name: 'Avatar',
    role: 'participant',
  },
};

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'x'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // X.com handle input for direct sign in
  const [xHandleInput, setXHandleInput] = useState('');
  const [isXLoading, setIsXLoading] = useState(false);

  // Listen for OAuth postMessage from popup if backend OAuth callback is triggered
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'x') {
        const handle = event.data.handle || 'x_user';
        const user = await dbServiceSingleton.registerXUser(handle, `@${handle}`);
        onLogin({
          username: user.username,
          name: user.name,
          role: user.role,
          provider: 'x',
          xHandle: `@${user.username}`,
        });
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onLogin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUser = username.trim().toLowerCase();
    const userConfig = VALID_LOCAL_USERS[trimmedUser];

    if (!userConfig || userConfig.pass !== password) {
      setError('Credenciales incorrectas. Verifica tu usuario y contraseña.');
      return;
    }

    setIsLoading(true);
    setTimeout(async () => {
      await dbServiceSingleton.upsertUser({
        id: `user_${trimmedUser}`,
        username: trimmedUser,
        name: userConfig.name,
        role: userConfig.role,
        provider: 'local',
        avatarId: trimmedUser === 'admin' ? 'three_robot' : 'cat_3d',
        createdAt: Date.now(),
      });

      onLogin({
        username: trimmedUser,
        name: userConfig.name,
        role: userConfig.role,
        provider: 'local',
      });
      setIsLoading(false);
    }, 250);
  };

  const handleQuickFill = (userKey: 'admin' | 'avatar') => {
    setUsername(userKey);
    setPassword(VALID_LOCAL_USERS[userKey].pass);
    setError(null);
  };

  // Sign In with X.com
  const handleXSignIn = async () => {
    setError(null);
    setIsXLoading(true);

    const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');
    if (!isGitHubPages) {
      try {
        // 1. Check if backend OAuth is available
        const statusRes = await fetch('/api/auth/x/url').then((r) => r.json()).catch(() => null);
        if (statusRes?.configured && statusRes?.url) {
          // Open OAuth popup
          const width = 500;
          const height = 650;
          const left = window.screen.width / 2 - width / 2;
          const top = window.screen.height / 2 - height / 2;
          window.open(
            statusRes.url,
            'XStreamX_X_Auth',
            `width=${width},height=${height},top=${top},left=${left}`
          );
          setIsXLoading(false);
          return;
        }
      } catch (e) {
        // Backend OAuth not available or running serverless/static
      }
    }

    // 2. Direct X.com handle sign-in fallback
    setActiveTab('x');
    setIsXLoading(false);
  };

  const handleXHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanHandle = xHandleInput.replace(/^@/, '').trim();
    if (!cleanHandle) {
      setError('Por favor escribe tu usuario de X.com (ej. @elonmusk o tu handle).');
      return;
    }

    setIsXLoading(true);
    setTimeout(async () => {
      const user = await dbServiceSingleton.registerXUser(cleanHandle, `@${cleanHandle}`);
      onLogin({
        username: user.username,
        name: user.name,
        role: user.role,
        provider: 'x',
        xHandle: `@${user.username}`,
      });
      setIsXLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
            XSTREAMX
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            Acceso a videollamada con captura facial y avatares 3D
          </p>
        </div>

        {/* Tab switchers: Credenciales vs X.com */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('credentials');
              setError(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'credentials'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Usuario / Clave</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('x');
              setError(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'x'
                ? 'bg-white text-black shadow-md shadow-white/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {/* X Logo */}
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Ingresar con X</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/80 border border-rose-600/70 text-rose-200 text-xs font-semibold animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Username & Password Form */}
        {activeTab === 'credentials' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin o avatar"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu clave"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-cyan-500 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>INGRESAR</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Tab 2: X.com (Twitter) Sign-In */}
        {activeTab === 'x' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-black/60 border border-slate-800 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
                <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white">Conectar con X.com</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ingresa con tu perfil de X.com para usar tu identidad verificada en las videollamadas con avatar.
              </p>
            </div>

            <form onSubmit={handleXHandleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tu Usuario de X (Handle)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 font-bold text-sm pointer-events-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={xHandleInput}
                    onChange={(e) => setXHandleInput(e.target.value)}
                    placeholder="elonmusk, xstreamx..."
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-white rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none transition font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isXLoading}
                className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-200 text-black font-black text-sm tracking-wide shadow-lg shadow-white/20 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {isXLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4 fill-black" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    <span>CONECTAR CON X.COM</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Divider if on credentials tab to offer 1-click X.com button */}
        {activeTab === 'credentials' && (
          <>
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
                <span className="bg-slate-900 px-3 text-slate-500">O también</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleXSignIn}
              disabled={isXLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-slate-950 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition hover:border-slate-500 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-white" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              <span>Continuar con X.com</span>
            </button>
          </>
        )}

        {/* Quick User Helper Badges */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <p className="text-[11px] font-semibold text-slate-400 mb-2 text-center">
            Accesos rápidos para pruebas:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('credentials');
                handleQuickFill('admin');
              }}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-cyan-500/50 transition text-left group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                user: <span className="text-slate-200">admin</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                pass: <span className="text-slate-200">pass2000</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('credentials');
                handleQuickFill('avatar');
              }}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/60 hover:border-cyan-500/50 transition text-left group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Participante</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                user: <span className="text-slate-200">avatar</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                pass: <span className="text-slate-200">pass</span>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
