import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Upload,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
  ExternalLink,
  Plus,
  Box,
  Calendar,
  Layers,
} from 'lucide-react';
import { AuthenticatedUser } from '../auth/Login';
import { dbServiceSingleton } from '../../services/dbService';
import { indexedDbService, UserAccount } from '../../services/db/indexedDbService';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';
import { AvatarDefinition } from '../../types';
import {
  getEffectiveSupabaseUrl,
  getEffectiveSupabaseAnonKey,
  isSupabaseConfigured,
  setSupabaseConfig,
  testSupabaseConnection,
} from '../../services/supabaseClient';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  authUser: AuthenticatedUser;
  onUserUpdated?: (updated: AuthenticatedUser) => void;
  onSelectAvatar?: (avatarId: string) => void;
  currentAvatarId?: string;
  onOpenRegister?: () => void;
  onOpenFaces?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  authUser,
  onUserUpdated,
  onSelectAvatar,
  currentAvatarId,
  onOpenRegister,
  onOpenFaces,
}) => {
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [displayName, setDisplayName] = useState(authUser.name);
  const [bio, setBio] = useState('');
  const [activeAvatar, setActiveAvatar] = useState(currentAvatarId || 'three_robot');
  const [userAvatars, setUserAvatars] = useState<AvatarDefinition[]>([]);
  const [availableAvatars, setAvailableAvatars] = useState<AvatarDefinition[]>([]);
  
  // Custom Avatar Upload state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('Personalizados');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Supabase Configuration state
  const [showSupabaseSettings, setShowSupabaseSettings] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(getEffectiveSupabaseUrl());
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(getEffectiveSupabaseAnonKey());
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(isSupabaseConfigured());
  const [supabaseTestStatus, setSupabaseTestStatus] = useState<string | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);

  // Status & Notifications
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    // Load full user details from centralized online Supabase DB
    dbServiceSingleton.getUser(authUser.username).then((acc) => {
      if (!isMounted) return;
      if (acc) {
        setUserAccount(acc as unknown as UserAccount);
        setDisplayName(acc.name);
        setBio(acc.bio || '');
        if (acc.avatarId) setActiveAvatar(acc.avatarId);
      }
    });

    // Load avatars and sync from Supabase cloud
    const all = avatarModelServiceSingleton.getAllAvatars();
    setAvailableAvatars(all);
    const mine = avatarModelServiceSingleton.getUserAvatars(authUser.username);
    setUserAvatars(mine);
    avatarModelServiceSingleton.syncUserCloudAvatars(authUser.username).catch(() => {});

    // Subscribe to avatar changes
    const unsub = avatarModelServiceSingleton.subscribe(() => {
      if (!isMounted) return;
      const updatedAll = avatarModelServiceSingleton.getAllAvatars();
      setAvailableAvatars(updatedAll);
      setUserAvatars(avatarModelServiceSingleton.getUserAvatars(authUser.username));
    });

    // Check supabase status
    setIsSupabaseOnline(isSupabaseConfigured());

    return () => {
      isMounted = false;
      unsub();
    };
  }, [isOpen, authUser.username]);

  if (!isOpen) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const cleanName = displayName.trim() || authUser.username;
      const cleanBio = bio.trim();

      // 1. Update Centralized Supabase DB
      if (userAccount) {
        const updatedAcc: UserAccount = {
          ...userAccount,
          name: cleanName,
          bio: cleanBio,
          avatarId: activeAvatar,
        };
        await dbServiceSingleton.saveUser(updatedAcc as any);
        setUserAccount(updatedAcc);
      }

      // 2. Update Supabase
      await dbServiceSingleton.upsertUser({
        id: `user_${authUser.username.toLowerCase()}`,
        username: authUser.username.toLowerCase(),
        name: cleanName,
        role: authUser.role,
        provider: 'local',
        avatarId: activeAvatar,
        bio: cleanBio,
        createdAvatars: userAccount?.createdAvatars || [],
        createdAt: userAccount?.createdAt || Date.now(),
      });

      // Save user-scoped selected avatar in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem(`xstreamx_selected_avatar_${authUser.username.toLowerCase()}`, activeAvatar);
        localStorage.setItem('xstreamx_selected_avatar', activeAvatar);
      }

      // 3. Notify parent app
      if (onUserUpdated) {
        onUserUpdated({
          ...authUser,
          name: cleanName,
          avatarId: activeAvatar,
        });
      }

      if (onSelectAvatar) {
        onSelectAvatar(activeAvatar);
      }

      setSaveStatus('¡Perfil actualizado con éxito!');
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      setSaveStatus(`Error al guardar: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadCustomAvatar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Por favor selecciona un archivo 3D (.glb, .gltf, .obj, .stl).');
      return;
    }

    if (userAvatars.length >= 4) {
      setUploadError('Has alcanzado el límite máximo de 4 avatares por cuenta. Elimina uno de tus avatares existentes para subir o crear otro.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const avatarName = uploadName.trim() || uploadFile.name.replace(/\.[^/.]+$/, '');
      const newDef = await avatarModelServiceSingleton.addCustomModel({
        name: avatarName,
        category: uploadCategory,
        ownerId: authUser.username.toLowerCase(),
        file: uploadFile,
        badge: 'MI 3D',
      });

      // Also register in Supabase avatars table
      await dbServiceSingleton.saveAvatarRecord({
        id: newDef.id,
        name: newDef.name,
        category: newDef.category,
        ownerId: authUser.username.toLowerCase(),
        badge: newDef.badge,
        format: newDef.format,
        createdAt: Date.now(),
      });

      // Equip it
      setActiveAvatar(newDef.id);
      if (onSelectAvatar) {
        onSelectAvatar(newDef.id);
      }

      setShowUploadForm(false);
      setUploadFile(null);
      setUploadName('');
      setSaveStatus(`¡Avatar "${avatarName}" creado y agregado a tu perfil!`);
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      setUploadError(err?.message || 'Error al procesar el archivo 3D.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    setSupabaseTestStatus('Comprobando conexión con Supabase...');
    const result = await testSupabaseConnection();
    setIsTestingSupabase(false);
    setIsSupabaseOnline(result.ok);
    setSupabaseTestStatus(result.message);
  };

  const handleSaveSupabaseConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseConfig(supabaseUrl, supabaseAnonKey);
    setIsSupabaseOnline(isSupabaseConfigured());
    setSupabaseTestStatus('Configuración de Supabase guardada.');
    setTimeout(() => setSupabaseTestStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-[#0d0e14] border border-cyan-500/20 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-gradient-to-r from-cyan-950/30 to-blue-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Perfil de Usuario
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
                  @{authUser.username}
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Administra tus credenciales, tus avatares creados y la sincronización en la nube
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {/* Status Message */}
          {saveStatus && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-semibold animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveStatus}</span>
            </div>
          )}

          {/* User Info Overview & Edit Form */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  Nombre de Usuario (ID)
                </label>
                <div className="flex items-center gap-2 px-3 py-2 bg-black/60 border border-white/[0.08] rounded-xl text-neutral-400 font-mono">
                  <User className="w-3.5 h-3.5 text-neutral-500" />
                  <span>{authUser.username}</span>
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-400 uppercase">
                    Único
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  Rol en el Sistema
                </label>
                <div className="flex items-center gap-2 px-3 py-2 bg-black/60 border border-white/[0.08] rounded-xl text-neutral-200">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-semibold capitalize">{authUser.role}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  Nombre para Mostrar (Display Name)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Tu nombre o seudónimo"
                  className="w-full px-3 py-2 bg-[#07080c] border border-white/[0.12] focus:border-cyan-400 rounded-xl text-white focus:outline-none transition"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                  Avatar Activo Principal
                </label>
                <select
                  value={activeAvatar}
                  onChange={(e) => setActiveAvatar(e.target.value)}
                  className="w-full px-3 py-2 bg-[#07080c] border border-white/[0.12] focus:border-cyan-400 rounded-xl text-white focus:outline-none transition"
                >
                  {availableAvatars.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.category || '3D'}) {a.ownerId === authUser.username ? '★ Creado por ti' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                Biografía o Lema Personal
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Escribe una breve descripción para tu perfil..."
                rows={2}
                className="w-full px-3 py-2 bg-[#07080c] border border-white/[0.12] focus:border-cyan-400 rounded-xl text-white placeholder-neutral-600 focus:outline-none transition resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>

          {/* Section: Avatares Creados por este Perfil */}
          <div className="border-t border-white/[0.08] pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Avatares creados por ti ({userAvatars.length} / 4)</span>
                  {userAvatars.length >= 4 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-600/50 text-amber-300 font-normal">
                      Límite alcanzado
                    </span>
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (userAvatars.length >= 4 && !showUploadForm) {
                    setUploadError('Has alcanzado el límite máximo de 4 avatares por cuenta. Elimina uno existente para crear otro.');
                  }
                  setShowUploadForm(!showUploadForm);
                }}
                disabled={userAvatars.length >= 4 && !showUploadForm}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition ${
                  userAvatars.length >= 4 && !showUploadForm
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed opacity-60'
                    : 'bg-cyan-950/60 hover:bg-cyan-900/60 border-cyan-500/30 text-cyan-300 cursor-pointer'
                }`}
                title={userAvatars.length >= 4 ? 'Límite de 4 avatares alcanzado. Elimina uno para crear o subir otro.' : 'Subir nuevo avatar 3D'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showUploadForm ? 'Cancelar subida' : userAvatars.length >= 4 ? 'Límite (4/4)' : 'Subir Avatar 3D'}</span>
              </button>
            </div>

            {/* Upload Form Accordion */}
            {showUploadForm && (
              <form onSubmit={handleUploadCustomAvatar} className="p-4 rounded-2xl bg-black/60 border border-cyan-500/30 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-cyan-300 text-xs">Subir Nuevo Modelo 3D</h4>
                  <span className="text-[10px] text-neutral-400">Formatos: .glb, .gltf, .obj, .stl</span>
                </div>

                {uploadError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500 text-rose-200 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-300 mb-1">Nombre del Avatar</label>
                    <input
                      type="text"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      placeholder="Ej. Mi Mascota 3D, Cyber Face"
                      className="w-full px-3 py-1.5 bg-[#07080c] border border-white/[0.12] rounded-lg text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-300 mb-1">Categoría</label>
                    <input
                      type="text"
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      placeholder="Personalizados, Sci-Fi..."
                      className="w-full px-3 py-1.5 bg-[#07080c] border border-white/[0.12] rounded-lg text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-300 mb-1">Archivo del Modelo 3D</label>
                  <input
                    type="file"
                    accept=".glb,.gltf,.obj,.stl,.vrm"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-neutral-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar y Asociar a mi Perfil</span>
                  </button>
                </div>
              </form>
            )}

            {/* List of user's avatars */}
            {userAvatars.length === 0 ? (
              <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.06] text-center text-neutral-500 space-y-1">
                <Box className="w-8 h-8 mx-auto text-neutral-600 mb-1" />
                <p className="font-semibold text-neutral-400">Aún no has creado avatares personalizados.</p>
                <p className="text-[11px]">Sube un archivo 3D aquí o diseña uno en el Estudio 3D para añadirlo a tu perfil.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {userAvatars.map((av) => {
                  const isSelected = activeAvatar === av.id;
                  return (
                    <div
                      key={av.id}
                      className={`p-3 rounded-2xl border transition text-left flex flex-col justify-between ${
                        isSelected
                          ? 'bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/10'
                          : 'bg-black/50 border-white/[0.08] hover:border-white/[0.2]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <span className="font-bold text-white text-xs truncate max-w-[120px]">{av.name}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                          {av.badge || '3D'}
                        </span>
                      </div>
                      
                      {av.previewImage ? (
                        <div className="w-full h-16 rounded-xl overflow-hidden bg-black/80 mb-2 flex items-center justify-center">
                          <img src={av.previewImage} alt={av.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full h-16 rounded-xl bg-slate-900/60 mb-2 flex items-center justify-center text-neutral-600">
                          <Box className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-1">
                        <span className="text-[10px] text-neutral-400 truncate">{av.category || 'Personal'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAvatar(av.id);
                            if (onSelectAvatar) onSelectAvatar(av.id);
                          }}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-white/[0.08] hover:bg-white/[0.15] text-neutral-200'
                          }`}
                        >
                          {isSelected ? 'Equipado' : 'Equipar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Supabase Cloud Database Integration */}
          <div className="border-t border-white/[0.08] pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Base de Datos Supabase (Cloud Sync)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase flex items-center gap-1 ${
                    isSupabaseOnline
                      ? 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300'
                      : 'bg-amber-950/80 border border-amber-500/60 text-amber-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSupabaseOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {isSupabaseOnline ? 'Conectado' : 'Modo Local'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSupabaseSettings(!showSupabaseSettings)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
              >
                {showSupabaseSettings ? 'Ocultar Configuración' : 'Configurar Conexión'}
              </button>
            </div>

            {showSupabaseSettings && (
              <form onSubmit={handleSaveSupabaseConfig} className="p-4 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-3 animate-fade-in">
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Supabase sincroniza tus perfiles, salas y avatares para que estén disponibles entre distintos navegadores y dispositivos sin costo de servidor central.
                </p>

                {supabaseTestStatus && (
                  <div
                    className={`p-2.5 rounded-lg text-[11px] flex items-center gap-2 ${
                      isSupabaseOnline
                        ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-200'
                        : 'bg-amber-950/80 border border-amber-500 text-amber-200'
                    }`}
                  >
                    {isSupabaseOnline ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                    <span>{supabaseTestStatus}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-neutral-300 mb-1">
                    URL del Proyecto Supabase
                  </label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#07080c] border border-white/[0.12] rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-300 mb-1 flex items-center justify-between">
                    <span>Supabase Public Anon Key (JWT)</span>
                    <span className="text-[9px] text-neutral-500">Settings → API → anon public</span>
                  </label>
                  <input
                    type="password"
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-1.5 bg-[#07080c] border border-white/[0.12] rounded-lg text-white font-mono text-[11px] focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestSupabase}
                    disabled={isTestingSupabase}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-neutral-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                    <span>Probar Conexión</span>
                  </button>
                  <button
                    type="submit"
                    className="ml-auto px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                  >
                    Guardar Credenciales
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Quick link to /register */}
          {onOpenRegister && (
            <div className="border-t border-white/[0.08] pt-4 flex items-center justify-between text-neutral-400">
              <span>¿Deseas dar de alta otra identidad o usuario?</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRegister();
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
              >
                Ir a /register
              </button>
            </div>
          )}

          {/* Quick link to /3dchat/faces */}
          {onOpenFaces && (
            <div className="border-t border-white/[0.08] pt-3 flex items-center justify-between text-neutral-400">
              <span>¿Quieres crear una máscara facial 3D desde una foto?</span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFaces();
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer flex items-center gap-1"
              >
                <span>Ir a /3dchat/faces</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
