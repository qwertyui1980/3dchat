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
  ShieldCheck,
  Sparkles,
  Upload,
  Box,
  Database,
  RefreshCw,
  X,
  FileCheck,
} from 'lucide-react';
import { AuthenticatedUser } from './Login';
import { dbServiceSingleton } from '../../services/dbService';
import { indexedDbService, UserAccount } from '../../services/db/indexedDbService';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';
import { AvatarDefinition, AvatarId } from '../../types';
import {
  getEffectiveSupabaseUrl,
  getEffectiveSupabaseAnonKey,
  isSupabaseConfigured,
  setSupabaseConfig,
  testSupabaseConnection,
} from '../../services/supabaseClient';

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
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'participant' | 'admin'>('participant');
  const [bio, setBio] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState<AvatarId>('lincoln_3d');

  // Custom Avatar Upload during registration
  const [isCreatingCustomAvatar, setIsCreatingCustomAvatar] = useState(false);
  const [customAvatarName, setCustomAvatarName] = useState('');
  const [customAvatarFile, setCustomAvatarFile] = useState<File | null>(null);
  const [customAvatarCategory, setCustomAvatarCategory] = useState('Personalizados');

  // UI States
  const [avatarsList, setAvatarsList] = useState<AvatarDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Supabase Connection Status
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(isSupabaseConfigured());
  const [showDbSettings, setShowDbSettings] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(getEffectiveSupabaseUrl());
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(getEffectiveSupabaseAnonKey());
  const [supabaseNotice, setSupabaseNotice] = useState<string | null>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);

  useEffect(() => {
    // Load avatars
    const all = avatarModelServiceSingleton.getActiveAvatars();
    setAvatarsList(all);

    // Initial Supabase check
    setIsSupabaseOnline(isSupabaseConfigured());
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
    const cleanName = name.trim();
    const cleanPass = password.trim();

    // 1. Validation
    if (!cleanUser || cleanUser.length < 3) {
      setError('El nombre de usuario debe tener al menos 3 caracteres alfanuméricos.');
      return;
    }

    if (!cleanName) {
      setError('Por favor indica tu nombre o cómo deseas que te llamen.');
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
      // 2. Check username availability in IndexedDB and Supabase
      const existingInIdb = await indexedDbService.getUser(cleanUser);
      if (existingInIdb) {
        setUsernameError(`El usuario "${cleanUser}" ya está registrado. Por favor elige otro.`);
        setIsLoading(false);
        return;
      }

      const isAvailableInCloud = await dbServiceSingleton.isUsernameAvailable(cleanUser);
      if (!isAvailableInCloud) {
        setUsernameError(`El usuario "${cleanUser}" ya existe en la base de datos Supabase. Elige otro alias.`);
        setIsLoading(false);
        return;
      }

      let finalAvatarId: AvatarId = selectedAvatarId;
      const createdAvatarsList: string[] = [];

      // 3. Process Custom 3D Avatar if uploaded
      if (isCreatingCustomAvatar && customAvatarFile) {
        const avName = customAvatarName.trim() || cleanName + ' 3D';
        const newAvatar = await avatarModelServiceSingleton.addCustomModel({
          name: avName,
          category: customAvatarCategory,
          ownerId: cleanUser,
          file: customAvatarFile,
          badge: 'MI 3D',
        });

        finalAvatarId = newAvatar.id;
        createdAvatarsList.push(newAvatar.id);

        // Also save avatar metadata in Supabase
        await dbServiceSingleton.saveAvatarRecord({
          id: newAvatar.id,
          name: newAvatar.name,
          category: newAvatar.category,
          ownerId: cleanUser,
          badge: newAvatar.badge,
          format: newAvatar.format,
          createdAt: Date.now(),
        });
      }

      // 4. Save User Account to IndexedDB
      const now = Date.now();
      const userAccount: UserAccount = {
        id: `user_${cleanUser}`,
        username: cleanUser,
        name: cleanName,
        role: role,
        password: cleanPass,
        avatarId: finalAvatarId,
        bio: bio.trim(),
        createdAvatars: createdAvatarsList,
        createdAt: now,
      };

      await indexedDbService.saveUser(userAccount);

      // 5. Persist User in Supabase Cloud
      await dbServiceSingleton.upsertUser({
        id: `user_${cleanUser}`,
        username: cleanUser,
        name: cleanName,
        role: role,
        provider: 'local',
        avatarId: finalAvatarId,
        bio: bio.trim(),
        createdAvatars: createdAvatarsList,
        createdAt: now,
      });

      // 6. Direct sign in and notify parent app
      const authenticatedUser: AuthenticatedUser = {
        username: cleanUser,
        name: cleanName,
        role: role,
        provider: 'local',
      };

      onRegisterSuccess(authenticatedUser);
    } catch (err: any) {
      setError(err?.message || 'Error inesperado durante el registro. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestDb = async () => {
    setIsTestingDb(true);
    setSupabaseNotice('Comprobando conexión con Supabase...');
    const result = await testSupabaseConnection();
    setIsTestingDb(false);
    setIsSupabaseOnline(result.ok);
    setSupabaseNotice(result.message);
  };

  const handleSaveDbConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setIsSupabaseOnline(isSupabaseConfigured());
    setSupabaseNotice('Credenciales de Supabase actualizadas.');
    setTimeout(() => setSupabaseNotice(null), 3000);
  };

  return (
    <div className="w-full min-h-[100dvh] relative overflow-y-auto select-none bg-[#08090d] text-neutral-100 flex flex-col justify-between p-3 sm:p-6 md:p-8">
      {/* Background Cyber Ambient Glows */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/10 blur-[130px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />

      {/* Top Header Navigation */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between z-10 mb-6">
        <button
          type="button"
          onClick={onNavigateLogin}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-white/[0.08] text-xs font-semibold transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-400" />
          <span>Volver al Inicio / Salón</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Supabase Status Pill */}
          <button
            type="button"
            onClick={() => setShowDbSettings(!showDbSettings)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-mono font-bold transition cursor-pointer ${
              isSupabaseOnline
                ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60'
                : 'bg-amber-950/70 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
            }`}
            title="Haz clic para ver o configurar Supabase Cloud"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Supabase: {isSupabaseOnline ? 'Conectado' : 'Modo Local'}</span>
          </button>
        </div>
      </div>

      {/* Optional Supabase Cloud Settings Drawer */}
      {showDbSettings && (
        <div className="w-full max-w-4xl mx-auto mb-6 p-4 rounded-3xl bg-[#0e1017]/95 border border-cyan-500/30 backdrop-blur-xl animate-fade-in z-20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Configuración de Supabase Cloud Database
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowDbSettings(false)}
              className="p-1 text-neutral-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 mb-3 leading-relaxed">
            Los perfiles y avatares se almacenan en tiempo real en tu base de datos Supabase para que puedas sincronizarlos en múltiples dispositivos. Si no configuras una clave Anon, el sistema funciona de inmediato en modo local con IndexedDB.
          </p>

          {supabaseNotice && (
            <div className="mb-3 p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-500/50 text-cyan-200 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{supabaseNotice}</span>
            </div>
          )}

          <form onSubmit={handleSaveDbConfig} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                URL del Proyecto Supabase
              </label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-white/[0.1] rounded-xl text-white font-mono text-[11px] focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">
                Supabase Public Anon Key (JWT)
              </label>
              <input
                type="password"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3 py-2 bg-black/60 border border-white/[0.1] rounded-xl text-white font-mono text-[11px] focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestDb}
                disabled={isTestingDb}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                <span>Comprobar Conexión</span>
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Guardar Configuración
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Registration Form Container */}
      <div className="w-full max-w-4xl mx-auto bg-[#0d0f16]/90 border border-white/[0.12] backdrop-blur-2xl rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl z-10 my-auto">
        
        {/* Title Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Nuevo Perfil de Usuario • XStreamX</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-400">
            Crea tu Perfil y Elige tu Avatar 3D
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-2 max-w-lg mx-auto">
            Únete al espacio de telepresencia con privacidad por diseño: sin transmisión de video y con renderizado biomimético local en Three.js.
          </p>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs font-semibold animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* STEP 1: Credenciales y Datos Personales */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/[0.08]">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Datos de la Cuenta
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Username Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Nombre de Usuario (Alias Único) <span className="text-cyan-400">*</span>
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
                        : 'border-white/[0.1] focus:border-cyan-400'
                    }`}
                  />
                </div>
                {usernameError ? (
                  <p className="text-[11px] text-rose-400 mt-1 font-semibold">{usernameError}</p>
                ) : (
                  <p className="text-[10px] text-neutral-500 mt-1">Solo letras, números, guiones y guiones bajos.</p>
                )}
              </div>

              {/* Display Name Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Nombre Completo / Display Name <span className="text-cyan-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Satoshi Nakamoto"
                  required
                  className="w-full px-4 py-2.5 bg-[#06070a] border border-white/[0.1] focus:border-cyan-400 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
                />
                <p className="text-[10px] text-neutral-500 mt-1">Este nombre se mostrará en las salas y chat.</p>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Contraseña <span className="text-cyan-400">*</span>
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
                    className="w-full pl-10 pr-10 py-2.5 bg-[#06070a] border border-white/[0.1] focus:border-cyan-400 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
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
                  Confirmar Contraseña <span className="text-cyan-400">*</span>
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
                    className="w-full pl-10 pr-4 py-2.5 bg-[#06070a] border border-white/[0.1] focus:border-cyan-400 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Rol del Perfil
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('participant')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      role === 'participant'
                        ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-sm'
                        : 'bg-black/40 border-white/[0.08] text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Participante</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      role === 'admin'
                        ? 'bg-amber-950/80 border-amber-400 text-amber-300 shadow-sm'
                        : 'bg-black/40 border-white/[0.08] text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Administrador</span>
                  </button>
                </div>
              </div>

              {/* Bio Field */}
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5">
                  Biografía o Lema (Opcional)
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="ej. Entusiasta de los avatares 3D biomiméticos"
                  className="w-full px-4 py-2.5 bg-[#06070a] border border-white/[0.1] focus:border-cyan-400 rounded-xl text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none transition"
                />
              </div>

            </div>
          </div>

          {/* STEP 2: Selección y Creación de Avatares 3D */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Elige tu Avatar 3D o Crea uno Nuevo
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingCustomAvatar(!isCreatingCustomAvatar)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  isCreatingCustomAvatar
                    ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-md shadow-cyan-400/20'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-cyan-300 border-cyan-500/30'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isCreatingCustomAvatar ? 'Usar Catálogo Predefinido' : 'Subir Avatar 3D Personalizado'}</span>
              </button>
            </div>

            {/* Custom Avatar Upload Mode */}
            {isCreatingCustomAvatar ? (
              <div className="p-5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 space-y-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                    <Box className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Subir Modelo 3D para este Perfil</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Sube tu propio archivo de modelo 3D (.glb, .gltf, .obj, .stl) exportado de Blender, 3ds Max u otro software. Se asociará permanentemente a tu perfil.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-neutral-300 mb-1">Nombre del Avatar</label>
                    <input
                      type="text"
                      value={customAvatarName}
                      onChange={(e) => setCustomAvatarName(e.target.value)}
                      placeholder="ej. Cyber Skull, Mecha Zero"
                      className="w-full px-3 py-2 bg-black/60 border border-white/[0.12] rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-neutral-300 mb-1">Categoría</label>
                    <input
                      type="text"
                      value={customAvatarCategory}
                      onChange={(e) => setCustomAvatarCategory(e.target.value)}
                      placeholder="Personalizados, Sci-Fi..."
                      className="w-full px-3 py-2 bg-black/60 border border-white/[0.12] rounded-xl text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-neutral-300 mb-1">Archivo 3D (.glb, .gltf, .obj, .stl)</label>
                    <input
                      type="file"
                      accept=".glb,.gltf,.obj,.stl,.vrm"
                      onChange={(e) => setCustomAvatarFile(e.target.files?.[0] || null)}
                      required={isCreatingCustomAvatar}
                      className="w-full text-xs text-neutral-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-400 file:text-slate-950 hover:file:bg-cyan-300 cursor-pointer"
                    />
                  </div>
                </div>

                {customAvatarFile && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-xs">
                    <FileCheck className="w-4 h-4 text-cyan-400" />
                    <span>Archivo seleccionado: <strong>{customAvatarFile.name}</strong> ({(customAvatarFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>
            ) : (
              /* Predefined Avatar Carousel / Grid */
              <div className="space-y-3">
                <p className="text-xs text-neutral-400">
                  Selecciona tu personaje biomimético inicial. Podrás cambiarlo o añadir nuevos avatares en cualquier momento:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[300px] overflow-y-auto p-1">
                  {avatarsList.map((avatar) => {
                    const isSelected = selectedAvatarId === avatar.id;
                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatarId(avatar.id)}
                        className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                            : 'bg-black/50 border-white/[0.08] hover:border-white/[0.2] hover:bg-black/70'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase font-bold text-cyan-300 truncate font-mono">
                            {avatar.badge || '3D'}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
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
            )}
          </div>

          {/* STEP 3: Submit Registration Button */}
          <div className="pt-4 border-t border-white/[0.08] space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-cyan-400/20 flex items-center justify-center gap-2 transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50"
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
                className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
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
