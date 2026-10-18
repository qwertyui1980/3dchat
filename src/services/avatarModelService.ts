import { AvatarDefinition, AvatarId } from '../types';
import { AVATAR_LIST as DEFAULT_AVATARS } from '../components/avatars/avatarConfigs';
import { getAvatarTrackingProfile, registerAvatarTrackingProfile } from '../components/avatars/avatarTrackingProfiles';
import { buildCustomAvatarTrackingProfile, LandmarkDensity } from './face3d/landmarkCalibrationService';
import { indexedDbService, StoredCustomModel } from './db/indexedDbService';
import { getAvatarThumbnail } from './db/avatarThumbnails';
import { dbServiceSingleton } from './dbService';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const STORAGE_CUSTOM_AVATARS = 'xstreamx_custom_avatars_v1';
const STORAGE_DISABLED_AVATARS = 'xstreamx_disabled_avatars_v1';
const STORAGE_DELETED_AVATARS = 'xstreamx_deleted_avatars_v1';
const STORAGE_RENAMED_AVATARS = 'xstreamx_renamed_avatars_v1';
const STORAGE_PREVIEWS_AVATARS = 'xstreamx_avatar_previews_v1';

export const MAX_USER_AVATARS = 4;

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
            format: item.format || (() => {
              const n = (item.name || '').toLowerCase();
              if (n.endsWith('.obj')) return 'obj';
              if (n.endsWith('.stl')) return 'stl';
              if (n.endsWith('.gltf')) return 'gltf';
              if (n.endsWith('.vrm')) return 'vrm';
              return 'glb';
            })(),
            createdAt: item.createdAt || Date.now(),
            ownerId: item.ownerId,
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

      // Sincronizar modelos del Catálogo Público desde Supabase Cloud
      this.syncCloudPublicAvatars().catch((err) => {
        console.warn('[AvatarModelService] Notice syncing cloud public avatars:', err);
      });

      // Asegurar que todos los avatares predefinidos estén en Supabase
      this.seedDefaultAvatarsToCloud().catch(() => {});
    } catch (err) {
      console.warn('[AvatarModelService] Error inicializando IndexedDB:', err);
    }
  }

  /**
   * Sincroniza la colección pública de modelos 3D desde Supabase Cloud.
   * Todos los usuarios de la plataforma descargan y ven automáticamente estos modelos.
   */
  public async syncCloudPublicAvatars() {
    try {
      const publicCloudAvatars = await dbServiceSingleton.getPublicAvatarsFromCloud();
      if (!publicCloudAvatars || publicCloudAvatars.length === 0) return;

      let hasNew = false;
      for (const cloudItem of publicCloudAvatars) {
        if (this.deletedIds.has(cloudItem.id)) continue;

        const existing = this.customAvatars.find((a) => a.id === cloudItem.id);
        if (existing && existing.modelUrl) continue;

        let blob: Blob | null = null;
        let modelUrl = '';
        if (cloudItem.model_data) {
          try {
            const res = await fetch(cloudItem.model_data);
            blob = await res.blob();
            modelUrl = URL.createObjectURL(blob);
          } catch (_) {}
        }

        const previewImage =
          cloudItem.preview_image || this.modelPreviews[cloudItem.id] || getAvatarThumbnail(cloudItem.id);
        const format = cloudItem.format || 'glb';

        const def: AvatarDefinition = {
          id: cloudItem.id,
          name: this.renamedNames[cloudItem.id] || cloudItem.name || 'Modelo 3D Público',
          tagline: cloudItem.tagline || 'Modelo 3D del Catálogo Público con seguimiento facial',
          category: cloudItem.category || 'Catálogo Público',
          themeColor: cloudItem.theme_color || '#06b6d4',
          accentColor: cloudItem.accent_color || '#3b82f6',
          badge: cloudItem.badge || 'PÚBLICO',
          emoji: '✨',
          isCustom: false,
          isPublic: true,
          modelUrl: modelUrl || undefined,
          previewImage,
          format,
          createdAt: cloudItem.created_at || Date.now(),
          ownerId: cloudItem.owner_id,
          debugParams: cloudItem.debug_params,
          trackingProfile: (() => {
            const density = (cloudItem.debug_params?.calibration?.density as LandmarkDensity) || 32;
            const prof = buildCustomAvatarTrackingProfile({
              avatarId: cloudItem.id,
              name: cloudItem.name,
              density,
              themeColor: cloudItem.theme_color || '#06b6d4',
              activeIndices: cloudItem.debug_params?.calibration?.activeIndices,
            });
            registerAvatarTrackingProfile(cloudItem.id, prof);
            return prof;
          })(),
        };

        if (existing) {
          Object.assign(existing, def);
        } else {
          this.customAvatars.push(def);
        }

        if (blob) {
          indexedDbService
            .saveModel({
              id: cloudItem.id,
              name: cloudItem.name,
              tagline: cloudItem.tagline,
              category: cloudItem.category || 'Catálogo Público',
              themeColor: cloudItem.theme_color,
              accentColor: cloudItem.accent_color,
              badge: cloudItem.badge || 'PÚBLICO',
              createdAt: cloudItem.created_at || Date.now(),
              blob,
              format,
              previewImage,
              isPublic: true,
              ownerId: cloudItem.owner_id,
              debugParams: cloudItem.debug_params,
            })
            .catch(() => {});
        }

        hasNew = true;
      }

      if (hasNew) {
        this.notify();
      }
    } catch (e) {
      console.warn('[AvatarModelService] Error sincronizando catálogo público de Supabase:', e);
    }
  }

  /**
   * Asegura que todos los avatares predefinidos de la plataforma estén registrados
   * en la base de datos de Supabase Cloud como parte del catálogo público.
   */
  public async seedDefaultAvatarsToCloud() {
    try {
      const cloudPublic = await dbServiceSingleton.getPublicAvatarsFromCloud();
      const existingCloudIds = new Set((cloudPublic || []).map((c: any) => c.id));

      for (const avatar of DEFAULT_AVATARS) {
        if (!existingCloudIds.has(avatar.id)) {
          await dbServiceSingleton.saveAvatarRecord({
            id: avatar.id,
            name: avatar.name,
            tagline: avatar.tagline,
            category: avatar.category,
            themeColor: avatar.themeColor,
            accentColor: avatar.accentColor,
            badge: avatar.badge,
            ownerId: 'system',
            previewImage: avatar.previewImage || getAvatarThumbnail(avatar.id),
            format: avatar.format || 'glb',
            isPublic: true,
            createdAt: 1700000000000,
          });
        }
      }
    } catch (e) {
      console.warn('[AvatarModelService] Notice seeding default avatars to cloud:', e);
    }
  }

  /**
   * Sincroniza los avatares guardados en la cuenta del usuario desde Supabase
   */
  public async syncUserCloudAvatars(ownerId: string) {
    if (!ownerId) return;
    try {
      const userCloudAvatars = await dbServiceSingleton.getUserAvatarsFromCloud(ownerId);
      if (!userCloudAvatars || userCloudAvatars.length === 0) return;

      let hasNew = false;
      for (const cloudItem of userCloudAvatars) {
        if (this.deletedIds.has(cloudItem.id)) continue;
        const existing = this.customAvatars.find((a) => a.id === cloudItem.id);
        if (existing && existing.modelUrl) continue;

        let blob: Blob | null = null;
        let modelUrl = '';
        if (cloudItem.model_data) {
          try {
            const res = await fetch(cloudItem.model_data);
            blob = await res.blob();
            modelUrl = URL.createObjectURL(blob);
          } catch (_) {}
        }

        const previewImage =
          cloudItem.preview_image || this.modelPreviews[cloudItem.id] || getAvatarThumbnail(cloudItem.id);
        const format = cloudItem.format || 'glb';

        const def: AvatarDefinition = {
          id: cloudItem.id,
          name: this.renamedNames[cloudItem.id] || cloudItem.name || 'Mi Avatar 3D',
          tagline: cloudItem.tagline || 'Avatar 3D biomimético guardado en tu cuenta',
          category: cloudItem.category || 'Mis Avatares',
          themeColor: cloudItem.theme_color || '#06b6d4',
          accentColor: cloudItem.accent_color || '#3b82f6',
          badge: cloudItem.badge || '3D',
          emoji: '✨',
          isCustom: true,
          isPublic: !!cloudItem.is_public,
          modelUrl: modelUrl || undefined,
          previewImage,
          format,
          createdAt: cloudItem.created_at || Date.now(),
          ownerId: cloudItem.owner_id,
          debugParams: cloudItem.debug_params,
          trackingProfile: (() => {
            const density = (cloudItem.debug_params?.calibration?.density as LandmarkDensity) || 32;
            const prof = buildCustomAvatarTrackingProfile({
              avatarId: cloudItem.id,
              name: cloudItem.name,
              density,
              themeColor: cloudItem.theme_color || '#06b6d4',
              activeIndices: cloudItem.debug_params?.calibration?.activeIndices,
            });
            registerAvatarTrackingProfile(cloudItem.id, prof);
            return prof;
          })(),
        };

        if (existing) {
          Object.assign(existing, def);
        } else {
          this.customAvatars.push(def);
        }

        if (blob) {
          indexedDbService
            .saveModel({
              id: cloudItem.id,
              name: cloudItem.name,
              tagline: cloudItem.tagline,
              category: cloudItem.category,
              themeColor: cloudItem.theme_color,
              accentColor: cloudItem.accent_color,
              badge: cloudItem.badge,
              createdAt: cloudItem.created_at || Date.now(),
              blob,
              format,
              previewImage,
              isPublic: !!cloudItem.is_public,
              ownerId: cloudItem.owner_id,
              debugParams: cloudItem.debug_params,
            })
            .catch(() => {});
        }

        hasNew = true;
      }

      if (hasNew) {
        this.notify();
      }
    } catch (e) {
      console.warn('[AvatarModelService] Error sincronizando avatares de usuario desde Supabase:', e);
    }
  }

  /**
   * Carga bajo demanda un avatar específico desde Supabase Cloud y lo monta en memoria.
   * Utilizado cuando un usuario entra en la sala y los demás participantes necesitan renderizar su modelo 3D.
   */
  public async fetchAndCacheAvatarFromCloud(avatarId: string): Promise<AvatarDefinition | null> {
    if (!avatarId) return null;
    const existing = this.customAvatars.find((a) => a.id === avatarId);
    if (existing && existing.modelUrl) {
      return existing;
    }

    try {
      const cloudItem = await dbServiceSingleton.getAvatarByIdFromCloud(avatarId);
      if (!cloudItem) return null;

      let blob: Blob | null = null;
      let modelUrl = '';
      if (cloudItem.model_data) {
        try {
          const res = await fetch(cloudItem.model_data);
          blob = await res.blob();
          modelUrl = URL.createObjectURL(blob);
        } catch (e) {
          console.warn('[AvatarModelService] Error creando blob de avatar:', e);
        }
      }

      const previewImage =
        cloudItem.preview_image || this.modelPreviews[cloudItem.id] || getAvatarThumbnail(cloudItem.id);
      const format = cloudItem.format || 'glb';

      const def: AvatarDefinition = {
        id: cloudItem.id,
        name: this.renamedNames[cloudItem.id] || cloudItem.name || 'Avatar 3D',
        tagline: cloudItem.tagline || 'Avatar 3D con seguimiento facial en tiempo real',
        category: cloudItem.category || 'Personalizados',
        themeColor: cloudItem.theme_color || '#06b6d4',
        accentColor: cloudItem.accent_color || '#3b82f6',
        badge: cloudItem.badge || '3D',
        emoji: '✨',
        isCustom: !cloudItem.is_public,
        isPublic: !!cloudItem.is_public,
        modelUrl: modelUrl || undefined,
        previewImage,
        format,
        createdAt: cloudItem.created_at || Date.now(),
        ownerId: cloudItem.owner_id,
        debugParams: cloudItem.debug_params,
        trackingProfile: (() => {
          const density = (cloudItem.debug_params?.calibration?.density as LandmarkDensity) || 32;
          const prof = buildCustomAvatarTrackingProfile({
            avatarId: cloudItem.id,
            name: cloudItem.name,
            density,
            themeColor: cloudItem.theme_color || '#06b6d4',
            activeIndices: cloudItem.debug_params?.calibration?.activeIndices,
          });
          registerAvatarTrackingProfile(cloudItem.id, prof);
          return prof;
        })(),
      };

      if (existing) {
        Object.assign(existing, def);
      } else {
        this.customAvatars.push(def);
      }

      if (blob) {
        indexedDbService
          .saveModel({
            id: cloudItem.id,
            name: cloudItem.name,
            tagline: cloudItem.tagline,
            category: cloudItem.category,
            themeColor: cloudItem.theme_color,
            accentColor: cloudItem.accent_color,
            badge: cloudItem.badge,
            createdAt: cloudItem.created_at || Date.now(),
            blob,
            format,
            previewImage,
            isPublic: !!cloudItem.is_public,
            ownerId: cloudItem.owner_id,
            debugParams: cloudItem.debug_params,
          })
          .catch(() => {});
      }

      this.notify();
      return def;
    } catch (err) {
      console.warn('[AvatarModelService] Error descargando avatar desde Supabase:', err);
      return null;
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
   * Obtiene todos los avatares creados por un usuario específico
   */
  getUserAvatars(ownerId: string): AvatarDefinition[] {
    if (!ownerId) return [];
    const cleanOwner = ownerId.trim().toLowerCase();
    return this.getAllAvatars().filter(
      (a) => a.ownerId && a.ownerId.trim().toLowerCase() === cleanOwner
    );
  }

  /**
   * Valida si un usuario tiene cupo disponible para crear un nuevo avatar (máximo 4 avatares por usuario)
   */
  canUserCreateAvatar(ownerId: string, isAdmin: boolean = false): {
    allowed: boolean;
    currentCount: number;
    maxCount: number;
    message?: string;
  } {
    if (isAdmin || ownerId === 'admin') {
      return { allowed: true, currentCount: 0, maxCount: MAX_USER_AVATARS };
    }
    const currentCount = this.getUserAvatars(ownerId).length;
    const allowed = currentCount < MAX_USER_AVATARS;
    return {
      allowed,
      currentCount,
      maxCount: MAX_USER_AVATARS,
      message: allowed
        ? undefined
        : `Has alcanzado el límite máximo permitido de ${MAX_USER_AVATARS} avatares por cuenta. Elimina o edita uno de tus avatares existentes para crear uno nuevo.`,
    };
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

    dbServiceSingleton.deleteAvatar(avatarId).catch((err) => {
      console.warn(`[AvatarModelService] Error eliminando ${avatarId} de Supabase:`, err);
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
    format?: 'glb' | 'gltf' | 'obj' | 'stl' | 'vrm' | string;
    ownerId?: string;
    file: File | Blob;
  }): Promise<AvatarDefinition> {
    // Validar límite máximo de 4 avatares por cuenta para usuarios normales
    if (params.ownerId && params.ownerId !== 'admin' && !params.isPublic) {
      const quota = this.canUserCreateAvatar(params.ownerId, false);
      if (!quota.allowed) {
        throw new Error(quota.message || 'Límite de 4 avatares por cuenta alcanzado.');
      }
    }

    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const modelUrl = URL.createObjectURL(params.file);

    const isPublic = !!params.isPublic;
    const name = params.name.trim() || 'Modelo 3D Personalizado';
    const fileName = (params.file as File).name ? (params.file as File).name.toLowerCase() : name.toLowerCase();
    const format = params.format || (() => {
      if (fileName.endsWith('.obj')) return 'obj';
      if (fileName.endsWith('.stl')) return 'stl';
      if (fileName.endsWith('.gltf')) return 'gltf';
      if (fileName.endsWith('.vrm')) return 'vrm';
      return 'glb';
    })();

    const tagline =
      params.tagline?.trim() ||
      (isPublic
        ? 'Avatar 3D del Catálogo Público generado en XStreamX con seguimiento facial'
        : 'Avatar 3D biomimético generado en XStreamX con seguimiento facial');
    const category = params.category || (isPublic ? 'Catálogo Público' : 'Creados con IA');
    const themeColor = params.themeColor || '#06b6d4';
    const accentColor = params.accentColor || '#3b82f6';
    const badge = params.badge?.trim() || (isPublic ? 'PÚBLICO' : (format ? format.toUpperCase() : '3D MASK'));
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
      format,
      previewImage,
      originalImage: params.originalImage,
      debugParams: params.debugParams,
      isPublic,
      ownerId: params.ownerId,
    };

    try {
      await indexedDbService.saveModel(storedModel);
      if (params.ownerId) {
        await indexedDbService.addAvatarToUser(params.ownerId, id);
      }
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
      format,
      modelUrl,
      previewImage,
      originalImage: params.originalImage,
      debugParams: params.debugParams,
      createdAt,
      ownerId: params.ownerId,
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

    // Sincronización en segundo plano con Supabase Cloud
    (async () => {
      try {
        let modelData: string | undefined;
        if (params.file) {
          modelData = await blobToDataUrl(params.file);
        }
        await dbServiceSingleton.saveAvatarRecord({
          id,
          name,
          tagline,
          category,
          themeColor,
          accentColor,
          badge,
          ownerId: params.ownerId,
          previewImage,
          format,
          isPublic,
          createdAt,
          modelData,
          debugParams: params.debugParams,
        });
        if (params.ownerId) {
          await dbServiceSingleton.addAvatarToUser(params.ownerId, id);
        }
      } catch (err) {
        console.warn('[AvatarModelService] Error sincronizando avatar con Supabase:', err);
      }
    })();

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
    ownerId?: string;
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

    // Sincronización de actualización en segundo plano con Supabase Cloud
    (async () => {
      try {
        let modelData: string | undefined;
        if (params.file) {
          modelData = await blobToDataUrl(params.file);
        }
        await dbServiceSingleton.saveAvatarRecord({
          id: params.id,
          name,
          tagline: updatedDef.tagline,
          category: updatedDef.category,
          themeColor: updatedDef.themeColor,
          accentColor: updatedDef.accentColor,
          badge: updatedDef.badge,
          ownerId: params.ownerId || existing?.ownerId,
          previewImage,
          format: updatedDef.format,
          isPublic,
          createdAt: updatedDef.createdAt,
          modelData,
          debugParams: params.debugParams,
        });
      } catch (err) {
        console.warn('[AvatarModelService] Error actualizando avatar en Supabase:', err);
      }
    })();

    return updatedDef;
  }

  /**
   * Obtiene los datos binarios del modelo para sincronización P2P con los demás integrantes de la sala
   */
  async getModelDataForSync(avatarId: string): Promise<{
    avatarId: string;
    name: string;
    format: string;
    themeColor: string;
    accentColor: string;
    previewImage?: string;
    trackingProfile?: any;
    debugParams?: any;
    buffer: ArrayBuffer;
  } | null> {
    const avatar = this.getAvatarById(avatarId);
    if (!avatar) return null;

    let buffer: ArrayBuffer | null = null;
    let format = avatar.format || 'glb';

    // 1. Intentar desde IndexedDB
    try {
      const stored = await indexedDbService.getModel(avatarId);
      if (stored?.blob) {
        buffer = await stored.blob.arrayBuffer();
        if (stored.format) {
          format = stored.format;
        } else if ((stored.blob as any).name) {
          const ext = (stored.blob as any).name.split('.').pop()?.toLowerCase();
          if (ext && ['glb', 'gltf', 'obj', 'stl', 'vrm'].includes(ext)) {
            format = ext;
          }
        }
      } else if (stored?.fileData) {
        const res = await fetch(stored.fileData);
        buffer = await res.arrayBuffer();
      }
    } catch (e) {
      console.warn('[AvatarModelService] Error reading from IndexedDB:', e);
    }

    // 2. Si no se encontró en IndexedDB pero tiene modelUrl
    if (!buffer && avatar.modelUrl) {
      try {
        const res = await fetch(avatar.modelUrl);
        buffer = await res.arrayBuffer();
      } catch (e) {
        console.warn('[AvatarModelService] Error fetching modelUrl:', e);
      }
    }

    // 3. Respaldo: intentar cargar desde Supabase Cloud si está disponible
    if (!buffer) {
      try {
        const cloudItem = await dbServiceSingleton.getAvatarByIdFromCloud(avatarId);
        if (cloudItem && cloudItem.model_data) {
          const res = await fetch(cloudItem.model_data);
          buffer = await res.arrayBuffer();
          if (cloudItem.format) format = cloudItem.format;
        }
      } catch (e) {
        console.warn('[AvatarModelService] Error fetching cloud model for sync:', e);
      }
    }

    if (!buffer) return null;

    // Detectar formato si aún es genérico
    if (!format || format === 'glb') {
      const nameLower = (avatar.name || '').toLowerCase();
      if (nameLower.endsWith('.obj')) format = 'obj';
      else if (nameLower.endsWith('.stl')) format = 'stl';
      else if (nameLower.endsWith('.gltf')) format = 'gltf';
      else if (nameLower.endsWith('.vrm')) format = 'vrm';
    }

    return {
      avatarId: avatar.id,
      name: avatar.name,
      format,
      themeColor: avatar.themeColor || '#06b6d4',
      accentColor: avatar.accentColor || '#38bdf8',
      previewImage: avatar.previewImage,
      trackingProfile: avatar.trackingProfile,
      debugParams: avatar.debugParams,
      buffer,
    };
  }

  /**
   * Registra un modelo 3D recibido en vivo de un compañero en la sala de chat
   */
  async registerRemoteAvatar(packet: {
    avatarId: string;
    name: string;
    format: string;
    themeColor?: string;
    accentColor?: string;
    previewImage?: string;
    trackingProfile?: any;
    debugParams?: any;
    buffer: ArrayBuffer;
  }): Promise<AvatarDefinition> {
    const { avatarId, name, format, themeColor, accentColor, previewImage, trackingProfile, debugParams, buffer } = packet;

    let mimeType = 'model/gltf-binary';
    if (format === 'obj') mimeType = 'text/plain';
    else if (format === 'stl') mimeType = 'model/stl';
    else if (format === 'gltf') mimeType = 'model/gltf+json';

    const blob = new Blob([buffer], { type: mimeType });
    const modelUrl = URL.createObjectURL(blob);

    const remoteAvatar: AvatarDefinition = {
      id: avatarId,
      name: name || 'Modelo 3D Remoto',
      tagline: 'Avatar 3D compartido por integrante de la sala',
      category: 'Compartidos en Sala',
      themeColor: themeColor || '#06b6d4',
      accentColor: accentColor || '#38bdf8',
      badge: (format || '3D').toUpperCase(),
      emoji: '👤',
      isCustom: true,
      format,
      modelUrl,
      previewImage: previewImage || getAvatarThumbnail(avatarId),
      trackingProfile,
      debugParams,
      createdAt: Date.now(),
    };

    if (trackingProfile) {
      registerAvatarTrackingProfile(avatarId, trackingProfile);
    }

    // Actualizar o insertar en customAvatars
    const existingIndex = this.customAvatars.findIndex((a) => a.id === avatarId);
    if (existingIndex >= 0) {
      this.customAvatars[existingIndex] = remoteAvatar;
    } else {
      this.customAvatars.push(remoteAvatar);
    }

    // Guardar en IndexedDB para caché local
    try {
      await indexedDbService.saveModel({
        id: avatarId,
        name: remoteAvatar.name,
        tagline: remoteAvatar.tagline,
        category: remoteAvatar.category,
        themeColor: remoteAvatar.themeColor,
        accentColor: remoteAvatar.accentColor,
        badge: remoteAvatar.badge,
        createdAt: remoteAvatar.createdAt || Date.now(),
        blob,
        format,
        previewImage: remoteAvatar.previewImage,
        debugParams,
      });
    } catch (_) {}

    this.notify();
    return remoteAvatar;
  }
}

export const avatarModelServiceSingleton = new AvatarModelService();
