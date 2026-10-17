import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  X,
  VolumeX,
  Volume2,
  UserX,
  Lock,
  Unlock,
  Upload,
  Layers,
  Sparkles,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileBox,
  Users,
  Settings,
  Plus,
  Pencil,
  Check,
  Camera,
  Image as ImageIcon,
  Sliders,
} from 'lucide-react';
import { RoomInfo, User, AvatarDefinition } from '../../types';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';
import { FaceBlendshapeStudioModal } from '../admin/FaceBlendshapeStudioModal';

interface AdminControlPanelProps {
  room: RoomInfo;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onAdminMute: (userId: string, state: boolean) => void;
  onAdminKick: (userId: string) => void;
  onToggleLock: (locked: boolean) => void;
  onMuteAll: () => void;
  onSelectAvatar?: (avatarId: string) => void;
  onOpenFaceStudio?: () => void;
}

export const AdminControlPanel: React.FC<AdminControlPanelProps> = ({
  room,
  currentUser,
  isOpen,
  onClose,
  onAdminMute,
  onAdminKick,
  onToggleLock,
  onMuteAll,
  onSelectAvatar,
  onOpenFaceStudio,
}) => {
  const [activeTab, setActiveTab] = useState<'models' | 'room'>('models');
  const [avatars, setAvatars] = useState<AvatarDefinition[]>(() =>
    avatarModelServiceSingleton.getAllAvatars()
  );
  const [isFaceStudioModalOpen, setIsFaceStudioModalOpen] = useState(false);
  const [editingAvatarForStudio, setEditingAvatarForStudio] = useState<AvatarDefinition | null>(null);

  // Upload Form State
  const [modelName, setModelName] = useState('');
  const [modelCategory, setModelCategory] = useState('Personalizados');
  const [modelThemeColor, setModelThemeColor] = useState('#06b6d4');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedThumbPreview, setSelectedThumbPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadCustomThumbnail = async (avatarId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        await avatarModelServiceSingleton.updateModelPreview(avatarId, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThumbFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedThumbPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Inline rename state for admin
  const [editingAvatarId, setEditingAvatarId] = useState<string | null>(null);
  const [editingAvatarName, setEditingAvatarName] = useState<string>('');

  useEffect(() => {
    const unsub = avatarModelServiceSingleton.subscribe(() => {
      setAvatars(avatarModelServiceSingleton.getAllAvatars());
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const otherParticipants = room.participants.filter((p) => p.id !== currentUser.id);
  const isAllMuted =
    !!room.isAllMuted ||
    (otherParticipants.length > 0 &&
      otherParticipants.filter((p) => p.role !== 'admin').every((p) => p.isMuted));

  const handleToggleModelActive = (avatarId: string, currentDisabled: boolean) => {
    avatarModelServiceSingleton.toggleModelActive(avatarId, currentDisabled);
  };

  const handleDeleteModel = (avatarId: string) => {
    if (confirm('¿Eliminar este modelo 3D de la plataforma?')) {
      avatarModelServiceSingleton.deleteModel(avatarId);
    }
  };

  const handleStartRename = (av: AvatarDefinition) => {
    setEditingAvatarId(av.id);
    setEditingAvatarName(av.name);
  };

  const handleSaveRename = (avatarId: string) => {
    if (editingAvatarName.trim()) {
      avatarModelServiceSingleton.renameModel(avatarId, editingAvatarName.trim());
    }
    setEditingAvatarId(null);
    setEditingAvatarName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (!modelName) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setModelName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
      setUploadError(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Por favor selecciona un archivo 3D (.glb, .gltf, .vrm, .obj, .stl)');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const created = await avatarModelServiceSingleton.addCustomModel({
        name: modelName || selectedFile.name,
        category: modelCategory,
        themeColor: modelThemeColor,
        previewImage: selectedThumbPreview || undefined,
        file: selectedFile,
        isPublic: true,
        ownerId: 'admin',
      });

      setUploadSuccess(`¡Modelo "${created.name}" agregado con éxito a la lista de modelos!`);
      setSelectedFile(null);
      setSelectedThumbPreview(null);
      setModelName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (thumbInputRef.current) thumbInputRef.current.value = '';
      if (onSelectAvatar) {
        onSelectAvatar(created.id);
      }
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: any) {
      setUploadError(err?.message || 'Error al procesar el archivo 3D.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-3xl rounded-2xl bg-[#090b14] border border-cyan-500/30 shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0e1220]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Shield className="w-5 h-5 font-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Panel de Control Administrador
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Gestión de Modelos 3D • Moderación de Sala • Subida de Archivos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.08] transition active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-white/[0.06] bg-[#0c0f1c] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'models'
                ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Gestión de Modelos 3D ({avatars.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('room')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'room'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Moderación de Espacio y Participantes</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === 'models' && (
            <div className="space-y-6">
              {/* 0. 3D Masks Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-indigo-950/60 to-purple-950/60 border border-cyan-500/40 shadow-xl shadow-cyan-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/30">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm sm:text-base font-black text-white tracking-wide">
                        3D Masks
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40 text-[9px] font-black uppercase">
                        NUEVO
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 mt-0.5">
                      Convierte una sola foto o selfie en un modelo 3D con 52 morph targets ARKit y texturizado UV automático.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onOpenFaceStudio) {
                      onOpenFaceStudio();
                    } else {
                      setIsFaceStudioModalOpen(true);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs tracking-wider shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition hover:scale-[1.02] active:scale-[0.98] shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>ABRIR ESTUDIO 3D</span>
                </button>
              </div>

              {/* 1. Upload Model File Section */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0f1426] border border-cyan-500/20 shadow-lg">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm mb-3">
                  <Upload className="w-4 h-4" />
                  <span>Subir Archivo de Modelo 3D (.glb / .gltf)</span>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                        Nombre del Modelo
                      </label>
                      <input
                        type="text"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        placeholder="Ej. Cyber Ninja 3D, Robot Alpha..."
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                        Categoría
                      </label>
                      <select
                        value={modelCategory}
                        onChange={(e) => setModelCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400 transition cursor-pointer"
                      >
                        <option value="Personalizados">Personalizados</option>
                        <option value="Character">Character</option>
                        <option value="Robot">Robot</option>
                        <option value="Sci-Fi">Sci-Fi</option>
                        <option value="Animals">Animals</option>
                        <option value="Anime">Anime</option>
                        <option value="Líderes">Líderes</option>
                      </select>
                    </div>
                  </div>

                  {/* File Selector & Optional Thumbnail */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                        Archivo 3D (.glb, .gltf, .vrm, .obj, .stl) *
                      </label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".glb,.gltf,.vrm,.json,.obj,.stl"
                        onChange={handleFileChange}
                        className="hidden"
                        id="admin-model-file-input"
                      />
                      <label
                        htmlFor="admin-model-file-input"
                        className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/30 text-cyan-300 text-xs font-bold cursor-pointer transition truncate"
                      >
                        <FileBox className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          {selectedFile ? selectedFile.name : 'Seleccionar Archivo 3D'}
                        </span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                        Imagen de Vista Previa (Opcional)
                      </label>
                      <input
                        ref={thumbInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleThumbFileChange}
                        className="hidden"
                        id="admin-thumb-file-input"
                      />
                      <label
                        htmlFor="admin-thumb-file-input"
                        className="flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-950/20 hover:bg-indigo-950/30 text-indigo-300 text-xs font-bold cursor-pointer transition truncate"
                      >
                        {selectedThumbPreview ? (
                          <div className="flex items-center gap-2">
                            <img src={selectedThumbPreview} alt="Preview" className="w-5 h-5 rounded object-cover" />
                            <span className="text-emerald-400 text-[11px]">Imagen cargada ✓</span>
                          </div>
                        ) : (
                          <>
                            <ImageIcon className="w-4 h-4 shrink-0" />
                            <span>Subir Miniatura PNG/JPG</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isUploading || !selectedFile}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-cyan-900/30 cursor-pointer flex items-center gap-2"
                    >
                      {isUploading ? (
                        <span>Procesando modelo...</span>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Guardar Modelo en Base de Datos</span>
                        </>
                      )}
                    </button>
                  </div>

                  {uploadSuccess && (
                    <div className="flex items-center gap-2 text-emerald-300 text-xs p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{uploadSuccess}</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="flex items-center gap-2 text-rose-300 text-xs p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/30">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{uploadError}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* 2. Models List with Activation & 1-Click Delete */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                    <span>Modelos de la Plataforma ({avatars.length})</span>
                    <span className="text-[10px] text-neutral-500 font-normal">
                      (Activa, desactiva o elimina modelos con un clic)
                    </span>
                  </h4>

                  <button
                    type="button"
                    onClick={() => avatarModelServiceSingleton.restoreDefaultModels()}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    title="Restaurar lista de modelos predeterminados"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar Predeterminados</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {avatars.map((av) => {
                    const isDisabled = !!av.disabled;
                    return (
                      <div
                        key={av.id}
                        className={`flex items-center justify-between p-3 rounded-xl border transition ${
                          isDisabled
                            ? 'bg-black/30 border-white/[0.04] opacity-60'
                            : 'bg-[#0f1322] border-white/[0.08] hover:border-cyan-500/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                          {/* Miniatura visual del modelo almacenada en DB */}
                          <div className="relative group/thumb shrink-0">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border overflow-hidden shadow-md transition group-hover/thumb:scale-105"
                              style={{
                                backgroundColor: `${av.themeColor}20`,
                                borderColor: `${av.themeColor}60`,
                              }}
                            >
                              {av.previewImage ? (
                                <img
                                  src={av.previewImage}
                                  alt={av.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xl">{av.emoji || '🤖'}</span>
                              )}
                            </div>

                            {/* Botón para cambiar o subir imagen de miniatura personalizada */}
                            <label
                              htmlFor={`change-thumb-${av.id}`}
                              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-600 hover:bg-cyan-500 border border-slate-950 text-white flex items-center justify-center cursor-pointer shadow opacity-0 group-hover/thumb:opacity-100 transition z-10"
                              title="Cambiar miniatura/imagen del modelo"
                            >
                              <Camera className="w-2.5 h-2.5" />
                              <input
                                id={`change-thumb-${av.id}`}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadCustomThumbnail(av.id, e)}
                              />
                            </label>
                          </div>

                          {editingAvatarId === av.id ? (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <input
                                type="text"
                                value={editingAvatarName}
                                onChange={(e) => setEditingAvatarName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(av.id);
                                  if (e.key === 'Escape') setEditingAvatarId(null);
                                }}
                                autoFocus
                                className="bg-black/60 border border-cyan-400 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 w-full font-bold"
                                placeholder="Nombre del modelo..."
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(av.id)}
                                className="p-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition cursor-pointer shrink-0"
                                title="Guardar nombre"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAvatarId(null)}
                                className="p-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition cursor-pointer shrink-0"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="truncate">
                              <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                <span>{av.name}</span>
                                {av.isCustom && (
                                  <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-mono">
                                    CUSTOM
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate">
                                {av.category} • {av.badge}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Actions: Rename / Toggle Active / 1-Click Delete */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Rename Button */}
                          <button
                            type="button"
                            onClick={() => handleStartRename(av)}
                            className="p-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900 border border-cyan-500/30 hover:border-cyan-400 text-cyan-300 transition active:scale-90 cursor-pointer"
                            title="Cambiar nombre de este modelo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active */}
                          <button
                            type="button"
                            onClick={() => handleToggleModelActive(av.id, isDisabled)}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                              isDisabled
                                ? 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                                : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                            }`}
                            title={isDisabled ? 'Activar este modelo' : 'Desactivar este modelo'}
                          >
                            {isDisabled ? (
                              <>
                                <ToggleLeft className="w-3.5 h-3.5 text-neutral-500" />
                                <span>Inactivo</span>
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Activo</span>
                              </>
                            )}
                          </button>

                          {/* Edit with 3D Masks Button */}
                          {(av.isCustom || av.isPublic || av.originalImage || av.debugParams) && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAvatarForStudio(av);
                                setIsFaceStudioModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 transition active:scale-90 cursor-pointer"
                              title="Volver a editar este modelo en 3D Masks Studio"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 1-Click Delete Button ('X') */}
                          <button
                            type="button"
                            onClick={() => handleDeleteModel(av.id)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900 border border-rose-500/30 hover:border-rose-400 text-rose-300 transition active:scale-90 cursor-pointer"
                            title="Eliminar este modelo de la plataforma"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'room' && (
            <div className="space-y-6">
              {/* Quick Actions */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                  Acciones Globales de Moderación
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Mute All */}
                  <button
                    onClick={onMuteAll}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition active:scale-98 cursor-pointer ${
                      isAllMuted
                        ? 'bg-rose-950/80 border-rose-700 text-rose-300 hover:bg-rose-900'
                        : 'bg-[#121629] hover:bg-[#181d36] text-neutral-200 border-white/10'
                    }`}
                  >
                    {isAllMuted ? (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>Desmutear a Todos</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-4 h-4 text-rose-400" />
                        <span>Silenciar a Todos</span>
                      </>
                    )}
                  </button>

                  {/* Toggle Lock */}
                  <button
                    onClick={() => onToggleLock(!room.isLocked)}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition active:scale-98 cursor-pointer ${
                      room.isLocked
                        ? 'bg-rose-950/80 border-rose-700 text-rose-300 hover:bg-rose-900'
                        : 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                    }`}
                  >
                    {room.isLocked ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Desbloquear Espacio</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>Bloquear Acceso</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Participants Live List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 mb-3">
                  Participantes Conectados ({room.participants.length})
                </h4>

                <div className="space-y-2">
                  {/* Admin Self */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-white">{currentUser.name} (Tú)</span>
                        <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                          Admin Anfitrión
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-amber-300/80 font-medium">Control Total</span>
                  </div>

                  {/* Other Participants */}
                  {otherParticipants.length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-black/30 border border-white/[0.06] text-neutral-500 text-xs">
                      No hay otros participantes en el espacio en este momento.
                    </div>
                  ) : (
                    otherParticipants.map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#0f1322] border border-white/[0.08]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              participant.isMuted ? 'bg-rose-400' : 'bg-emerald-400'
                            }`}
                          />
                          <div className="truncate">
                            <p className="text-xs font-bold text-white truncate">{participant.name}</p>
                            <p className="text-[10px] text-neutral-400 font-mono">
                              Avatar: {participant.avatarId}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onAdminMute(participant.id, !participant.isMuted)}
                            className={`p-2 rounded-lg border text-xs transition cursor-pointer ${
                              participant.isMuted
                                ? 'bg-rose-950 text-rose-300 border-rose-800'
                                : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                            }`}
                            title={participant.isMuted ? 'Desmutear usuario' : 'Silenciar micrófono'}
                          >
                            {participant.isMuted ? (
                              <VolumeX className="w-3.5 h-3.5" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => onAdminKick(participant.id)}
                            className="p-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 text-rose-400 border border-rose-800/60 transition cursor-pointer"
                            title="Expulsar participante"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] bg-[#0c0f1c] flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-mono">
            XStreamX Control Hub • Rol: Administrador
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-bold transition cursor-pointer"
          >
            Cerrar Panel
          </button>
        </div>
      </div>

      {/* Face to Blendshape 3D Admin Studio Modal */}
      <FaceBlendshapeStudioModal
        isOpen={isFaceStudioModalOpen}
        onClose={() => {
          setIsFaceStudioModalOpen(false);
          setEditingAvatarForStudio(null);
        }}
        isAdmin={true}
        editingAvatar={editingAvatarForStudio}
        onSelectAvatar={(avatarId) => {
          if (onSelectAvatar) onSelectAvatar(avatarId);
          setIsFaceStudioModalOpen(false);
          setEditingAvatarForStudio(null);
        }}
      />
    </div>
  );
};
