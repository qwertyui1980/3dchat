import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Box,
  Check,
  Upload,
  Sliders,
  Plus,
  Search,
  User,
  Shield,
  Layers,
} from 'lucide-react';
import { AvatarDefinition, AvatarId } from '../../types';
import { AuthenticatedUser } from '../auth/Login';
import {
  avatarModelServiceSingleton,
  MAX_USER_AVATARS,
} from '../../services/avatarModelService';

interface RoomAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarId: AvatarId;
  onSelectAvatar: (avatarId: AvatarId) => void;
  authUser?: AuthenticatedUser | null;
  onOpenStudio: (avatarToEdit?: AvatarDefinition | null) => void;
}

export const RoomAvatarModal: React.FC<RoomAvatarModalProps> = ({
  isOpen,
  onClose,
  currentAvatarId,
  onSelectAvatar,
  authUser,
  onOpenStudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'collection'>('available');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isAdmin = authUser?.role === 'admin';
  const cleanUsername = (authUser?.username || '').trim().toLowerCase();

  // Suscribirse a cambios en la lista de avatares en tiempo real
  const [allAvatars, setAllAvatars] = useState<AvatarDefinition[]>(() =>
    isAdmin
      ? avatarModelServiceSingleton.getAllAvatars()
      : avatarModelServiceSingleton.getActiveAvatars()
  );

  useEffect(() => {
    const unsub = avatarModelServiceSingleton.subscribe(() => {
      setAllAvatars(
        isAdmin
          ? avatarModelServiceSingleton.getAllAvatars()
          : avatarModelServiceSingleton.getActiveAvatars()
      );
    });
    return unsub;
  }, [isAdmin]);

  // Modelos Disponibles: Predefinidos de fábrica + Modelos creados en 3D Mask + Públicos de la BD
  const availableAvatars = useMemo(() => {
    return allAvatars.filter((a) => {
      if (!a.isCustom) return true;
      if (a.isPublic) return true;
      const owner = (a.ownerId || '').trim().toLowerCase();
      if (!owner || owner === 'admin') return true;
      return true; // Todos los modelos de la base de datos están disponibles en la reunión
    });
  }, [allAvatars]);

  // Mi Colección: Modelos creados por el usuario actual (o todos los de admin si es admin)
  const myCollectionAvatars = useMemo(() => {
    return allAvatars.filter((a) => {
      const owner = (a.ownerId || '').trim().toLowerCase();
      if (isAdmin) {
        return owner === 'admin' || (!owner && a.isCustom) || a.isCustom;
      }
      if (cleanUsername) {
        return owner === cleanUsername || (!owner && a.isCustom);
      }
      return a.isCustom || a.id.startsWith('custom_') || !owner;
    });
  }, [allAvatars, cleanUsername, isAdmin]);

  // Filtro de búsqueda por nombre o categoría
  const filteredAvailable = useMemo(() => {
    if (!searchQuery.trim()) return availableAvatars;
    const q = searchQuery.toLowerCase();
    return availableAvatars.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.category && a.category.toLowerCase().includes(q))
    );
  }, [availableAvatars, searchQuery]);

  const filteredCollection = useMemo(() => {
    if (!searchQuery.trim()) return myCollectionAvatars;
    const q = searchQuery.toLowerCase();
    return myCollectionAvatars.filter(
      (a) => a.name.toLowerCase().includes(q) || (a.category && a.category.toLowerCase().includes(q))
    );
  }, [myCollectionAvatars, searchQuery]);

  // Manejo de subida directa de archivos 3D (.glb, .gltf, .obj, .stl)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAdmin && myCollectionAvatars.length >= MAX_USER_AVATARS) {
      setUploadError(`Límite máximo de ${MAX_USER_AVATARS} avatares alcanzado.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      const newDef = await avatarModelServiceSingleton.addCustomModel({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        tagline: 'Modelo 3D importado para telepresencia biomimética',
        category: 'Mis Modelos 3D',
        themeColor: '#06b6d4',
        accentColor: '#3b82f6',
        badge: '3D MASK',
        isPublic: false,
        ownerId: cleanUsername,
        file,
      });

      onSelectAvatar(newDef.id);
      setActiveTab('collection');
    } catch (err: any) {
      console.error('[RoomAvatarModal] Error al subir modelo 3D:', err);
      setUploadError(err?.message || 'Error al procesar el archivo 3D');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0b0e14] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header con gradiente y pestañas */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] bg-gradient-to-r from-slate-950 via-[#0c121e] to-slate-950">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                  <span>Seleccionar Avatar 3D</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                    En Reunión
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Cambia de modelo en tiempo real. Todos los participantes verán tu nuevo avatar biomimético.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-neutral-400 hover:text-white border border-white/[0.08] transition cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Buscador y Pestañas */}
          <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Pestañas Disponibles vs Mi Colección */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/[0.06] text-xs font-semibold select-none">
              <button
                type="button"
                onClick={() => setActiveTab('available')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'available'
                    ? 'bg-yellow-400 text-slate-950 shadow-md font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>Disponibles y Admin</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'available' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-neutral-400'
                }`}>
                  {availableAvatars.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('collection')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  activeTab === 'collection'
                    ? 'bg-yellow-400 text-slate-950 shadow-md font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Mi Colección</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'collection' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-neutral-400'
                }`}>
                  {isAdmin ? myCollectionAvatars.length : `${myCollectionAvatars.length}/${MAX_USER_AVATARS}`}
                </span>
              </button>
            </div>

            {/* Input de Búsqueda */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-white/[0.08] rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-400 transition"
              />
            </div>
          </div>
        </div>

        {/* Action Bar: Crear con 3D Masks / Subir Modelo */}
        <div className="px-4 py-2.5 bg-[#0e131d] border-b border-white/[0.06] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {/* Botón Crear con 3D Masks (Solo Admin) */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenStudio(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition cursor-pointer active:scale-95 text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                <span>+ Crear con 3D Masks</span>
              </button>
            )}

            {/* Input oculto y botón para subir archivo 3D */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".glb,.gltf,.obj,.stl"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || (!isAdmin && myCollectionAvatars.length >= MAX_USER_AVATARS)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-neutral-300 hover:text-white border border-white/[0.08] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs font-semibold"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-400" />
              <span>{isUploading ? 'Subiendo...' : 'Subir Modelo (.glb/.obj)'}</span>
            </button>
          </div>

          <div className="text-[11px] text-neutral-400 hidden sm:block">
            {activeTab === 'available' ? 'Catálogo disponible para toda la reunión' : 'Tus modelos biomiméticos privados'}
          </div>
        </div>

        {uploadError && (
          <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-800 text-rose-300 text-xs font-medium">
            {uploadError}
          </div>
        )}

        {/* Grid de Modelos 3D */}
        <div className="flex-1 p-4 overflow-y-auto max-h-[55vh] custom-scrollbar">
          {activeTab === 'available' ? (
            filteredAvailable.length === 0 ? (
              <div className="py-12 text-center text-neutral-500 text-xs">
                No se encontraron modelos disponibles que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredAvailable.map((avatar) => {
                  const isSelected = avatar.id === currentAvatarId;
                  const isOwnerAdmin = (avatar.ownerId || '').toLowerCase() === 'admin';

                  return (
                    <div
                      key={avatar.id}
                      onClick={() => {
                        onSelectAvatar(avatar.id);
                        onClose();
                      }}
                      className={`group relative p-2.5 rounded-2xl border text-left flex flex-col items-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-yellow-950/40 border-yellow-400 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/20 scale-[1.02]'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden relative"
                        style={{
                          background: `linear-gradient(135deg, ${avatar.themeColor}22, ${avatar.accentColor}33)`,
                          borderColor: `${avatar.themeColor}55`,
                        }}
                      >
                        {avatar.previewImage ? (
                          <img
                            src={avatar.previewImage}
                            alt={avatar.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          avatar.emoji || '🎭'
                        )}

                        {isOwnerAdmin && (
                          <span
                            className="absolute bottom-1 right-1 text-[8px] font-mono px-1 py-0.2 rounded bg-amber-950/90 text-amber-300 border border-amber-600/60"
                            title="Modelo creado por el Administrador"
                          >
                            ADMIN
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-bold text-slate-100 truncate w-full text-center">
                        {avatar.name}
                      </span>

                      <span className="text-[10px] text-neutral-400 truncate w-full text-center">
                        {avatar.category || (isOwnerAdmin ? 'Admin' : 'Catálogo')}
                      </span>

                      {/* Selected Indicator Check */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 text-slate-950 font-bold" />
                        </div>
                      )}

                      {/* Botón Admin: Editar con 3D Mask */}
                      {isAdmin && (avatar.isCustom || avatar.isPublic || avatar.originalImage || avatar.debugParams) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onOpenStudio(avatar);
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/90 hover:bg-emerald-600 text-slate-400 hover:text-white border border-slate-700 hover:border-emerald-400 flex items-center justify-center transition shadow-md z-10 cursor-pointer"
                          title={`Editar "${avatar.name}" en 3D Masks Studio`}
                        >
                          <Sliders className="w-3 h-3 text-emerald-400 group-hover:text-white" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            filteredCollection.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-300">
                    Aún no tienes modelos en tu colección
                  </p>
                  <p className="text-[11px] text-neutral-500 max-w-sm mt-0.5">
                    Puedes crear tu propio avatar 3D facial con 52 blendshapes desde una foto con IA o subir un archivo .glb/.obj.
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStudio(null);
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    + Crear con 3D Masks Ahora
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredCollection.map((avatar) => {
                  const isSelected = avatar.id === currentAvatarId;

                  return (
                    <div
                      key={avatar.id}
                      onClick={() => {
                        onSelectAvatar(avatar.id);
                        onClose();
                      }}
                      className={`group relative p-2.5 rounded-2xl border text-left flex flex-col items-center gap-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'bg-yellow-950/40 border-yellow-400 ring-2 ring-yellow-400/50 shadow-lg shadow-yellow-500/20 scale-[1.02]'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border flex items-center justify-center text-2xl shadow-inner shrink-0 overflow-hidden relative"
                        style={{
                          background: `linear-gradient(135deg, ${avatar.themeColor}22, ${avatar.accentColor}33)`,
                          borderColor: `${avatar.themeColor}55`,
                        }}
                      >
                        {avatar.previewImage ? (
                          <img
                            src={avatar.previewImage}
                            alt={avatar.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          avatar.emoji || '🎭'
                        )}
                      </div>

                      <span className="text-xs font-bold text-slate-100 truncate w-full text-center">
                        {avatar.name}
                      </span>

                      <span className="text-[10px] text-cyan-400 font-mono truncate w-full text-center">
                        Mi Colección
                      </span>

                      {/* Selected Indicator Check */}
                      {isSelected && (
                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 text-slate-950 font-bold" />
                        </div>
                      )}

                      {/* Botón: Volver a Editar con 3D Mask (Solo Admin) */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onOpenStudio(avatar);
                          }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-900/90 hover:bg-blue-600 text-slate-400 hover:text-white border border-slate-700 hover:border-blue-400 flex items-center justify-center transition shadow-md z-10 cursor-pointer"
                          title={`Editar "${avatar.name}" con 3D Masks`}
                        >
                          <Sliders className="w-3 h-3 text-blue-400 group-hover:text-white" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Footer con info y botón cerrar */}
        <div className="p-3 sm:p-4 border-t border-white/[0.08] bg-slate-950/90 flex items-center justify-between text-xs">
          <div className="text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sincronización P2P & Nube activa</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
