import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { AuthenticatedUser } from '../auth/Login';
import { dbServiceSingleton } from '../../services/dbService';
import { UserAccount } from '../../services/db/indexedDbService';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';
import { AvatarDefinition } from '../../types';

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
}) => {
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [displayName, setDisplayName] = useState(authUser.name);
  const [bio, setBio] = useState('');
  const [activeAvatar, setActiveAvatar] = useState(currentAvatarId || 'three_robot');
  const [availableAvatars, setAvailableAvatars] = useState<AvatarDefinition[]>([]);

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

    // Load avatars
    const all = avatarModelServiceSingleton.getAllAvatars();
    setAvailableAvatars(all);

    // Subscribe to avatar changes
    const unsub = avatarModelServiceSingleton.subscribe(() => {
      if (!isMounted) return;
      const updatedAll = avatarModelServiceSingleton.getAllAvatars();
      setAvailableAvatars(updatedAll);
    });

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
                Administra tus credenciales y preferencias de perfil
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
        </div>
      </div>
    </div>
  );
};
