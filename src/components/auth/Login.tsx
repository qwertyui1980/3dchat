import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Sparkles, ExternalLink } from 'lucide-react';
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
  const [isOAuthPending, setIsOAuthPending] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const popupCheckIntervalRef = useRef<number | null>(null);

  // Clean up popup listeners
  useEffect(() => {
    return () => {
      if (popupCheckIntervalRef.current) {
        clearInterval(popupCheckIntervalRef.current);
      }
    };
  }, []);

  // Listen for OAuth postMessage from popup if backend OAuth callback is triggered
  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'x') {
        if (popupCheckIntervalRef.current) {
          clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        setIsOAuthPending(false);
        setIsXLoading(false);

        if (event.data.error) {
          setError(`Error de autenticación en X: ${event.data.error}. Puedes ingresar directamente con tu @usuario.`);
          return;
        }

        const handle = event.data.handle || (xHandleInput ? xHandleInput.replace(/^@/, '').trim() : 'x_user');
        const displayName = event.data.name || `@${handle}`;
        
        try {
          const user = await dbServiceSingleton.registerXUser(handle, displayName);
          onLogin({
            username: user.username,
            name: user.name,
            role: user.role,
            provider: 'x',
            xHandle: `@${user.username}`,
          });
        } catch (err: any) {
          setError(err?.message || 'Error al completar el acceso con X.com');
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        if (popupCheckIntervalRef.current) {
          clearInterval(popupCheckIntervalRef.current);
          popupCheckIntervalRef.current = null;
        }
        setIsOAuthPending(false);
        setIsXLoading(false);
        setError(event.data.error || 'No se pudo validar el acceso con X. Puedes ingresar con tu @usuario.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onLogin, xHandleInput]);

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

  // Sign In with X.com Handle Directly
  const handleXHandleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanHandle = xHandleInput.replace(/^@/, '').trim();
    if (!cleanHandle) {
      setError('Por favor escribe tu usuario de X.com (ej. @tu_usuario).');
      return;
    }

    setIsXLoading(true);
    try {
      const user = await dbServiceSingleton.registerXUser(cleanHandle, `@${cleanHandle}`);
      onLogin({
        username: user.username,
        name: user.name,
        role: user.role,
        provider: 'x',
        xHandle: `@${user.username}`,
      });
    } catch (err: any) {
      setError(err?.message || 'Error al conectar con X.com.');
    } finally {
      setIsXLoading(false);
    }
  };

  // 1-Click OAuth Popup Authorization
  const handleOAuthClick = async () => {
    setError(null);
    setIsOAuthPending(true);

    try {
      const res = await fetch('/api/auth/x/url');
      const data = await res.json();

      if (data.configured && data.url) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.url,
          'x_oauth_popup',
          `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
        );

        if (!popup) {
          setError('El navegador bloqueó la ventana emergente. Por favor permítela o ingresa directamente con tu @usuario.');
          setIsOAuthPending(false);
          return;
        }

        popupRef.current = popup;

        // Monitor popup closure in case user cancels
        if (popupCheckIntervalRef.current) clearInterval(popupCheckIntervalRef.current);
        popupCheckIntervalRef.current = window.setInterval(() => {
          if (!popup || popup.closed) {
            if (popupCheckIntervalRef.current) {
              clearInterval(popupCheckIntervalRef.current);
              popupCheckIntervalRef.current = null;
            }
            setIsOAuthPending(false);
          }
        }, 1000);
      } else {
        setError(data.message || 'OAuth no disponible en este momento. Ingresa directamente con tu @usuario de X.');
        setIsOAuthPending(false);
      }
    } catch (err) {
      setError('No se pudo iniciar la conexión con X.com. Puedes ingresar directamente con tu @usuario.');
      setIsOAuthPending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full max-w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl relative z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
            XSTREAMX
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 font-medium">
            Acceso a videollamada con avatares 3D y captura facial
          </p>
        </div>

        {/* Tab switchers: Acceder con Usuario Propio vs Acceder con X.com */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('credentials');
              setError(null);
            }}
            className={`py-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'credentials'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Usuario Propio</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('x');
              setError(null);
            }}
            className={`py-2.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'x'
                ? 'bg-white text-black shadow-md shadow-white/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {/* X Logo */}
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Cuenta de X.com</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-950/80 border border-rose-600/70 text-rose-200 text-xs font-semibold animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Pestaña 1: Usuario Propio */}
        {activeTab === 'credentials' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Nombre de Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tu nombre de usuario"
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
                  placeholder="Ingresa tu contraseña"
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
              className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
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

        {/* Pestaña 2: Cuenta de X.com */}
        {activeTab === 'x' && (
          <div className="space-y-4">
            {/* 1-Click OAuth Action */}
            <button
              type="button"
              onClick={handleOAuthClick}
              disabled={isOAuthPending || isXLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 active:bg-slate-200 text-black font-extrabold text-sm tracking-wide shadow-lg shadow-white/10 flex items-center justify-center gap-2.5 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
            >
              {isOAuthPending ? (
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4 fill-black shrink-0" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              )}
              <span>{isOAuthPending ? 'Esperando autorización en X...' : 'Autorizar con X.com (1-Clic)'}</span>
              {!isOAuthPending && <ExternalLink className="w-3.5 h-3.5 text-slate-600" />}
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                o ingresa con tu @handle
              </span>
              <div className="border-t border-slate-800 w-full" />
            </div>

            {/* Direct Handle Form */}
            <form onSubmit={handleXHandleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tu Usuario o Handle de X
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-cyan-400 font-black text-sm pointer-events-none">
                    @
                  </span>
                  <input
                    type="text"
                    value={xHandleInput}
                    onChange={(e) => setXHandleInput(e.target.value)}
                    placeholder="ej. elonmusk o tu_usuario"
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none transition font-mono"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isXLoading || isOAuthPending}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs tracking-wide border border-slate-700/60 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                {isXLoading ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ENTRAR DIRECTAMENTE CON ESTE USUARIO</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
