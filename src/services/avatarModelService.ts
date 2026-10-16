import { AvatarDefinition, AvatarId } from '../types';
import { AVATAR_LIST as DEFAULT_AVATARS } from '../components/avatars/avatarConfigs';
import { getAvatarTrackingProfile, registerAvatarTrackingProfile } from '../components/avatars/avatarTrackingProfiles';
import { buildCustomAvatarTrackingProfile, LandmarkDensity } from './face3d/landmarkCalibrationService';
import { indexedDbService, StoredCustomModel } from './db/indexedDbService';
import { getAvatarThumbnail } from './db/avatarThumbnails';

const STORAGE_CUSTOM_AVATARS = 'xstreamx_custom_avatars_v1';
const STORAGE_DISABLED_AVATARS = 'xstreamx_disabled_avatars_v1';
const STORAGE_DELETED_AVATARS = 'xstreamx_deleted_avatars_v1';
const STORAGE_RENAMED_AVATARS = 'xstreamx_renamed_avatars_v1';
const STORAGE_PREVIEWS_AVATARS = 'xstreamx_avatar_previews_v1';

type Listener = () => void;

class AvatarModelService {
  private customAvatars: AvatarDefinition[] = [];
  private disabledIds: Set<string> = new Set();
  private deletedIds: Set<string> = new Set();
  private renamedNames: Record<string, string> = {};
  private modelPreviews: Record<string, string> = {};
  private listeners: Set<Listener> = new Set();
  private isInitialized = false;

  constructor() {
    this.loadInitialFromLocalStorage();
    this.initAsyncDb();
  }

  /**
   * Carga sincrónica inicial de metadatos ligeros desde LocalStorage
   * para disponibilidad inmediata en el primer render de React.
   */
  private loadInitialFromLocalStorage() {
    if (typeof window === 'undefined') return;

    try {
      const storedDisabled = localStorage.getItem(STORAGE_DISABLED_AVATARS);
      if (storedDisabled) {
        this.disabledIds = new Set(JSON.parse(storedDisabled));
      }

      const storedDeleted = localStorage.getItem(STORAGE_DELETED_AVATARS);
      if (storedDeleted) {
        this.deletedIds = new Set(JSON.parse(storedDeleted));
      }

      const storedRenamed = localStorage.getItem(STORAGE_RENAMED_AVATARS);
      if (storedRenamed) {
        this.renamedNames = JSON.parse(storedRenamed);
      }

      const storedPreviews = localStorage.getItem(STORAGE_PREVIEWS_AVATARS);
      if (storedPreviews) {
        this.modelPreviews = JSON.parse(storedPreviews);
      }

      // Carga temporal de avatares guardados en LocalStorage (si aún no han sido migrados)
      const storedCustom = localStorage.getItem(STORAGE_CUSTOM_AVATARS);
      if (storedCustom) {
        const parsed = JSON.parse(storedCustom);
        if (Array.isArray(parsed)) {
          this.customAvatars = parsed.map((p) => ({
            ...p,
            previewImage: p.previewImage || this.modelPreviews[p.id] || getAvatarThumbnail(p.id),
          }));
        }
      }
    } catch (e) {
      console.warn('[AvatarModelService] Error cargando estado inicial de LocalStorage:', e);
    }
  }

  /**
   * Conexión asíncrona con IndexedDB y migración automática de datos existentes.
   */
  private async initAsyncDb() {
    if (typeof window === 'undefined') return;

    try {
      // 1. Migrar modelos de LocalStorage a IndexedDB si existían previamente
      await indexedDbService.migrateFromLocalStorage(STORAGE_CUSTOM_AVATARS);

      // 2. Cargar todos los modelos 3D almacenados en IndexedDB
      const storedModels = await indexedDbService.getAllModels();

      if (storedModels && storedModels.length > 0) {
        // Cargar previsualizaciones guardadas en IndexedDB para cualquier modelo
        storedModels.forEach((item) => {
          if (item.previewImage) {
            this.modelPreviews[item.id] = item.previewImage;
          }
        });

        // Filtrar modelos dinámicos (personalizados o públicos creados por usuarios/admin)
        const customOnly = storedModels.filter(
          (item) => !item.isPredefined || item.blob || item.isPublic
        );

        this.customAvatars = customOnly.map((item) => {
          let modelUrl = item.fileData || '';
          if (item.blob) {
            modelUrl = URL.createObjectURL(item.blob);
          }

          const previewImage =
            item.previewImage || this.modelPreviews[item.id] || getAvatarThumbnail(item.id);

          const isPublic = !!item.isPublic;

          return {
            id: item.id,
            name: this.renamedNames[item.id] || item.name || 'Modelo 3D Personalizado',
            tagline:
              item.tagline ||
              (isPublic
                ? 'Modelo 3D del Catálogo Público con seguimiento facial'
                : 'Modelo 3D personalizado con seguimiento facial'),
            category: item.category || (isPublic ? 'Catálogo Público' : 'Personalizados'),
            themeColor: item.themeColor || '#06b6d4',
            accentColor: item.accentColor || '#3b82f6',
            badge: item.badge || (isPublic ? 'PÚBLICO' : '3D MASK'),
            emoji: '✨',
            isCustom: !isPublic,
            isPublic,
            modelUrl,
            fileData: item.fileData,
            previewImage,
            originalImage: item.originalImage,
            debugParams: item.debugParams,
            createdAt: item.createdAt || Date.now(),
            trackingProfile: (() => {
              const density = (item.debugParams?.calibration?.density as LandmarkDensity) || 32;
              const prof = buildCustomAvatarTrackingProfile({
                avatarId: item.id,
                name: item.name,
                density,
                themeColor: item.themeColor || '#06b6d4',
                activeIndices: item.debugParams?.calibration?.activeIndices,
              });
              registerAvatarTrackingProfile(item.id, prof);
              return prof;
            })(),
          };
        });
      }

      this.isInitialized = true;
      this.notify();
    } catch (err) {
      console.warn('[AvatarModelService] Error inicializando IndexedDB:', err);
    }
  }

  private saveMetadataToStorage() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(
        STORAGE_DISABLED_AVATARS,
        JSON.stringify(Array.from(this.disabledIds))
      );
      localStorage.setItem(
        STORAGE_DELETED_AVATARS,
        JSON.stringify(Array.from(this.deletedIds))
      );
      localStorage.setItem(
        STORAGE_RENAMED_AVATARS,
        JSON.stringify(this.renamedNames)
      );
      localStorage.setItem(
        STORAGE_PREVIEWS_AVATARS,
        JSON.stringify(this.modelPreviews)
      );

      // También sincronizamos metadatos en IndexedDB
      indexedDbService.setMetadata('disabled_avatars', Array.from(this.disabledIds)).catch(() => {});
      indexedDbService.setMetadata('deleted_avatars', Array.from(this.deletedIds)).catch(() => {});
      indexedDbService.setMetadata('renamed_avatars', this.renamedNames).catch(() => {});
      indexedDbService.setMetadata('avatar_previews', this.modelPreviews).catch(() => {});
    } catch (e) {
      console.warn('[AvatarModelService] Error guardando metadatos:', e);
    }
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('[AvatarModelService] Listener error:', e);
      }
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns all registered avatars (both default and custom) that have not been deleted.
   * Includes metadata on whether they are disabled, custom names, and preview images.
   */
  getAllAvatars(): AvatarDefinition[] {
    const customIds = new Set(this.customAvatars.map((c) => c.id));
    const defaultFiltered = DEFAULT_AVATARS.filter((a) => !this.deletedIds.has(a.id) && !customIds.has(a.id)).map(
      (a) => ({
        ...a,
        name: this.renamedNames[a.id] || a.name,
        disabled: this.disabledIds.has(a.id),
        previewImage: this.modelPreviews[a.id] || (a as any).previewImage || getAvatarThumbnail(a.id),
      })
    );

    const customFiltered = this.customAvatars
      .filter((a) => !this.deletedIds.has(a.id))
      .map((a) => ({
        ...a,
        name: this.renamedNames[a.id] || a.name,
        disabled: this.disabledIds.has(a.id),
        previewImage: a.previewImage || this.modelPreviews[a.id] || getAvatarThumbnail(a.id),
      }));

    return [...defaultFiltered, ...customFiltered];
  }

  /**
   * Returns only avatars that are currently active (not disabled and not deleted).
   */
  getActiveAvatars(): AvatarDefinition[] {
    return this.getAllAvatars().filter((a) => !a.disabled);
  }

  /**
   * Find an avatar definition by ID
   */
  getAvatarById(avatarId: AvatarId): AvatarDefinition | undefined {
    return this.getAllAvatars().find((a) => a.id === avatarId);
  }

  /**
   * Toggle activation state of an avatar (Admin only)
   */
  toggleModelActive(avatarId: string, active: boolean) {
    if (active) {
      this.disabledIds.delete(avatarId);
    } else {
      this.disabledIds.add(avatarId);
    }
    this.saveMetadataToStorage();
    this.notify();
  }

  /**
   * Rename any model (predefined or custom) with permanent database persistence
   */
  renameModel(avatarId: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    this.renamedNames[avatarId] = trimmed;

    // Actualizar nombre en memoria y en IndexedDB si es personalizado
    const custom = this.customAvatars.find((a) => a.id === avatarId);
    if (custom) {
      custom.name = trimmed;
      indexedDbService.getModel(avatarId).then((existing) => {
        if (existing) {
          existing.name = trimmed;
          indexedDbService.saveModel(existing).catch(() => {});
        }
      }).catch(() => {});
    }

    this.saveMetadataToStorage();
    this.notify();
    return true;
  }

  /**
   * Actualiza o cambia la imagen de vista previa/miniatura de un modelo (Admin only)
   * y la persiste inmediatamente en la base de datos IndexedDB.
   */
  async updateModelPreview(avatarId: string, previewImageDataUrl: string): Promise<boolean> {
    const cleanImg = previewImageDataUrl.trim();
    if (!cleanImg) return false;

    this.modelPreviews[avatarId] = cleanImg;

    const custom = this.customAvatars.find((a) => a.id === avatarId);
    if (custom) {
      custom.previewImage = cleanImg;
    }

    try {
      const existing = await indexedDbService.getModel(avatarId);
      if (existing) {
        existing.previewImage = cleanImg;
        await indexedDbService.saveModel(existing);
      } else {
        await indexedDbService.saveModel({
          id: avatarId,
          name: this.renamedNames[avatarId] || avatarId,
          createdAt: Date.now(),
          previewImage: cleanImg,
        });
      }
    } catch (e) {
      console.warn('[AvatarModelService] Error guardando previewImage en IndexedDB:', e);
    }

    this.saveMetadataToStorage();
    this.notify();
    return true;
  }

  /**
   * Delete a model from the platform (1-click Admin action)
   */
  deleteModel(avatarId: string): boolean {
    this.deletedIds.add(avatarId);

    // Si es personalizado, eliminar de memoria y de la base de datos IndexedDB
    this.customAvatars = this.customAvatars.filter((a) => a.id !== avatarId);
    delete this.renamedNames[avatarId];
    delete this.modelPreviews[avatarId];

    indexedDbService.deleteModel(avatarId).catch((err) => {
      console.warn(`[AvatarModelService] Error eliminando ${avatarId} de IndexedDB:`, err);
    });

    this.saveMetadataToStorage();
    this.notify();
    return true;
  }

  /**
   * Restore all default models and reset renamed names
   */
  restoreDefaultModels() {
    this.deletedIds.clear();
    this.disabledIds.clear();
    this.renamedNames = {};
    this.saveMetadataToStorage();
    this.notify();
  }

  /**
   * Add a newly uploaded or generated 3D model file (GLB, GLTF, VRM, etc.)
   * Persists binary data and thumbnail directly into IndexedDB without size limitations.
   */
  async addCustomModel(params: {
    name: string;
    tagline?: string;
    category?: string;
    themeColor?: string;
    accentColor?: string;
    badge?: string;
    previewImage?: string;
    originalImage?: string;
    debugParams?: any;
    isPublic?: boolean;
    file: File | Blob;
  }): Promise<AvatarDefinition> {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const modelUrl = URL.createObjectURL(params.file);

    const isPublic = !!params.isPublic;
    const name = params.name.trim() || 'Modelo 3D Personalizado';
    const tagline =
      params.tagline?.trim() ||
      (isPublic
        ? 'Avatar 3D del Catálogo Público generado en XStreamX con seguimiento facial'
        : 'Avatar 3D biomimético generado en XStreamX con seguimiento facial');
    const category = params.category || (isPublic ? 'Catálogo Público' : 'Creados con IA');
    const themeColor = params.themeColor || '#06b6d4';
    const accentColor = params.accentColor || '#3b82f6';
    const badge = params.badge?.trim() || (isPublic ? 'PÚBLICO' : '3D MASK');
    const createdAt = Date.now();
    const previewImage = params.previewImage || getAvatarThumbnail(id);

    // Guardar directamente el archivo binario (Blob) y la miniatura en IndexedDB
    const storedModel: StoredCustomModel = {
      id,
      name,
      tagline,
      category,
      themeColor,
      accentColor,
      badge,
      createdAt,
      blob: params.file,
      previewImage,
      originalImage: params.originalImage,
      debugParams: params.debugParams,
      isPublic,
    };

    try {
      await indexedDbService.saveModel(storedModel);
    } catch (e) {
      console.error('[AvatarModelService] Error guardando modelo en IndexedDB:', e);
    }

    if (previewImage) {
      this.modelPreviews[id] = previewImage;
    }

    const newAvatar: AvatarDefinition = {
      id,
      name,
      tagline,
      category,
      themeColor,
      accentColor,
      badge,
      emoji: '✨',
      isCustom: !isPublic,
      isPublic,
      modelUrl,
      previewImage,
      originalImage: params.originalImage,
      debugParams: params.debugParams,
      createdAt,
      trackingProfile: (() => {
        const density = (params.debugParams?.calibration?.density as LandmarkDensity) || 32;
        const prof = buildCustomAvatarTrackingProfile({
          avatarId: id,
          name,
          density,
          themeColor,
          activeIndices: params.debugParams?.calibration?.activeIndices,
        });
        registerAvatarTrackingProfile(id, prof);
        return prof;
      })(),
    };

    this.customAvatars.push(newAvatar);
    this.saveMetadataToStorage();
    this.notify();
    return newAvatar;
  }

  /**
   * Actualiza un modelo 3D existente creado con 3D Mask o cargado por el usuario.
   * Guarda los cambios binarios y de calibración en IndexedDB y actualiza las listas en vivo.
   */
  async updateCustomModel(params: {
    id: string;
    name: string;
    tagline?: string;
    category?: string;
    themeColor?: string;
    accentColor?: string;
    badge?: string;
    previewImage?: string;
    originalImage?: string;
    debugParams?: any;
    isPublic?: boolean;
    file: File | Blob;
  }): Promise<AvatarDefinition> {
    const modelUrl = URL.createObjectURL(params.file);
    const name = params.name.trim() || 'Modelo 3D Personalizado';
    const previewImage = params.previewImage || this.modelPreviews[params.id] || getAvatarThumbnail(params.id);

    let existing: StoredCustomModel | null = null;
    try {
      existing = await indexedDbService.getModel(params.id);
    } catch (_) {}

    const isPublic = params.isPublic !== undefined ? params.isPublic : !!existing?.isPublic;

    const updatedModel: StoredCustomModel = {
      ...existing,
      id: params.id,
      name,
      tagline:
        params.tagline ||
        existing?.tagline ||
        (isPublic
          ? 'Avatar 3D del Catálogo Público generado en XStreamX con seguimiento facial'
          : 'Avatar 3D biomimético generado en XStreamX con seguimiento facial'),
      category: params.category || existing?.category || (isPublic ? 'Catálogo Público' : 'Creados con IA'),
      themeColor: params.themeColor || existing?.themeColor || '#06b6d4',
      accentColor: params.accentColor || existing?.accentColor || '#3b82f6',
      badge: params.badge || existing?.badge || (isPublic ? 'PÚBLICO' : '3D MASK'),
      createdAt: existing?.createdAt || Date.now(),
      blob: params.file,
      previewImage,
      originalImage: params.originalImage || existing?.originalImage,
      debugParams: params.debugParams !== undefined ? params.debugParams : existing?.debugParams,
      isPublic,
    };

    try {
      await indexedDbService.saveModel(updatedModel);
    } catch (e) {
      console.error('[AvatarModelService] Error actualizando modelo en IndexedDB:', e);
    }

    if (previewImage) {
      this.modelPreviews[params.id] = previewImage;
    }
    this.renamedNames[params.id] = name;

    const existingIdx = this.customAvatars.findIndex((a) => a.id === params.id);
    const updatedDef: AvatarDefinition = {
      id: params.id,
      name,
      tagline: updatedModel.tagline || '',
      category: updatedModel.category || (isPublic ? 'Catálogo Público' : 'Creados con IA'),
      themeColor: updatedModel.themeColor || '#06b6d4',
      accentColor: updatedModel.accentColor || '#3b82f6',
      badge: updatedModel.badge || (isPublic ? 'PÚBLICO' : '3D MASK'),
      emoji: '✨',
      isCustom: !isPublic,
      isPublic,
      modelUrl,
      previewImage,
      originalImage: updatedModel.originalImage,
      debugParams: updatedModel.debugParams,
      createdAt: updatedModel.createdAt,
      trackingProfile: (() => {
        const density = (updatedModel.debugParams?.calibration?.density as LandmarkDensity) || 32;
        const prof = buildCustomAvatarTrackingProfile({
          avatarId: params.id,
          name,
          density,
          themeColor: updatedModel.themeColor || '#06b6d4',
          activeIndices: updatedModel.debugParams?.calibration?.activeIndices,
        });
        registerAvatarTrackingProfile(params.id, prof);
        return prof;
      })(),
    };

    if (existingIdx !== -1) {
      this.customAvatars[existingIdx] = updatedDef;
    } else {
      this.customAvatars.push(updatedDef);
    }

    this.saveMetadataToStorage();
    this.notify();
    return updatedDef;
  }
}

export const avatarModelServiceSingleton = new AvatarModelService();
