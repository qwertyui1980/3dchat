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
} from 'lucide-react';
import { RoomInfo, User, AvatarDefinition } from '../../types';
import { avatarModelServiceSingleton } from '../../services/avatarModelService';

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
}) => {
  const [activeTab, setActiveTab] = useState<'models' | 'room'>('models');
  const [avatars, setAvatars] = useState<AvatarDefinition[]>(() =>
    avatarModelServiceSingleton.getAllAvatars()
  );

  // Upload Form State
  const [modelName, setModelName] = useState('');
  const [modelCategory, setModelCategory] = useState('Personalizados');
  const [modelThemeColor, setModelThemeColor] = useState('#06b6d4');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      setUploadError('Por favor selecciona un archivo 3D (.glb, .gltf, .vrm, .json)');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const created = await avatarModelServiceSingleton.addCustomModel({
        name: modelName || selectedFile.name,
        category: modelCategory,
        themeColor: modelThemeColor,
        file: selectedFile,
      });

      setUploadSuccess(`¡Modelo "${created.name}" agregado con éxito a la lista de modelos!`);
      setSelectedFile(null);
      setModelName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
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
              {/* 1. Upload Model File Section */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0f1426] border border-cyan-500/20 shadow-lg">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm mb-3">
                  <Upload className="w-4 h-4" />
                  <span>Subir Nuevo Archivo de Modelo 3D</span>
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

                  {/* File Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-300 mb-1">
                      Archivo 3D (.glb, .gltf, .vrm, .json, .obj)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".glb,.gltf,.vrm,.json,.obj"
                        onChange={handleFileChange}
                        className="hidden"
                        id="admin-model-file-input"
                      />
                      <label
                        htmlFor="admin-model-file-input"
                        className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/30 text-cyan-300 text-xs font-bold cursor-pointer transition"
                      >
                        <FileBox className="w-4 h-4" />
                        <span>
                          {selectedFile ? selectedFile.name : 'Haz clic para seleccionar archivo 3D'}
                        </span>
                      </label>

                      <button
                        type="submit"
                        disabled={isUploading || !selectedFile}
                        className="px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-cyan-900/30 cursor-pointer flex items-center gap-2"
                      >
                        {isUploading ? (
                          <span>Procesando...</span>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>Agregar Modelo</span>
                          </>
                        )}
                      </button>
                    </div>
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
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 border"
                            style={{
                              backgroundColor: `${av.themeColor}20`,
                              borderColor: `${av.themeColor}50`,
                            }}
                          >
                            {av.emoji || '🤖'}
                          </div>
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
                        </div>

                        {/* Actions: Toggle Active / 1-Click Delete */}
                        <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
};
