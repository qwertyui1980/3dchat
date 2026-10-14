import { AvatarDefinition, AvatarId } from '../types';
import { AVATAR_LIST as DEFAULT_AVATARS } from '../components/avatars/avatarConfigs';
import { getAvatarTrackingProfile } from '../components/avatars/avatarTrackingProfiles';

const STORAGE_CUSTOM_AVATARS = 'xstreamx_custom_avatars_v1';
const STORAGE_DISABLED_AVATARS = 'xstreamx_disabled_avatars_v1';
const STORAGE_DELETED_AVATARS = 'xstreamx_deleted_avatars_v1';
const STORAGE_RENAMED_AVATARS = 'xstreamx_renamed_avatars_v1';

type Listener = () => void;

class AvatarModelService {
  private customAvatars: AvatarDefinition[] = [];
  private disabledIds: Set<string> = new Set();
  private deletedIds: Set<string> = new Set();
  private renamedNames: Record<string, string> = {};
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    try {
      const storedCustom = localStorage.getItem(STORAGE_CUSTOM_AVATARS);
      if (storedCustom) {
        this.customAvatars = JSON.parse(storedCustom);
      }

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
    } catch (e) {
      console.warn('[AvatarModelService] Error loading stored avatar state:', e);
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_CUSTOM_AVATARS, JSON.stringify(this.customAvatars));
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
    } catch (e) {
      console.warn('[AvatarModelService] Error saving avatar state:', e);
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
   * Includes metadata on whether they are disabled and reflects custom renamed names.
   */
  getAllAvatars(): AvatarDefinition[] {
    const defaultFiltered = DEFAULT_AVATARS.filter((a) => !this.deletedIds.has(a.id)).map(
      (a) => ({
        ...a,
        name: this.renamedNames[a.id] || a.name,
        disabled: this.disabledIds.has(a.id),
      })
    );

    const customFiltered = this.customAvatars
      .filter((a) => !this.deletedIds.has(a.id))
      .map((a) => ({
        ...a,
        name: this.renamedNames[a.id] || a.name,
        disabled: this.disabledIds.has(a.id),
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
    this.saveToStorage();
    this.notify();
  }

  /**
   * Rename any model (predefined or custom) with permanent LocalStorage persistence
   */
  renameModel(avatarId: string, newName: string): boolean {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    this.renamedNames[avatarId] = trimmed;

    // Also sync inside customAvatars in memory if present
    const custom = this.customAvatars.find((a) => a.id === avatarId);
    if (custom) {
      custom.name = trimmed;
    }

    this.saveToStorage();
    this.notify();
    return true;
  }

  /**
   * Delete a model from the platform (1-click Admin action)
   */
  deleteModel(avatarId: string): boolean {
    this.deletedIds.add(avatarId);
    // If it was custom, also remove from custom list
    this.customAvatars = this.customAvatars.filter((a) => a.id !== avatarId);
    delete this.renamedNames[avatarId];
    this.saveToStorage();
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
    this.saveToStorage();
    this.notify();
  }

  /**
   * Add a newly uploaded 3D model file (GLB, GLTF, VRM, etc.)
   */
  async addCustomModel(params: {
    name: string;
    tagline?: string;
    category?: string;
    themeColor?: string;
    accentColor?: string;
    badge?: string;
    file: File;
  }): Promise<AvatarDefinition> {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const modelUrl = URL.createObjectURL(params.file);

    // Convert small files to data URL for persistence if possible (< 8MB)
    let fileData: string | undefined;
    if (params.file.size < 8 * 1024 * 1024) {
      try {
        fileData = await this.readFileAsDataUrl(params.file);
      } catch (_) {}
    }

    const newAvatar: AvatarDefinition = {
      id,
      name: params.name.trim() || 'Modelo 3D Personalizado',
      tagline:
        params.tagline?.trim() ||
        `Modelo 3D (${params.file.name}) subido por el administrador con seguimiento facial`,
      category: params.category || 'Personalizados',
      themeColor: params.themeColor || '#06b6d4',
      accentColor: params.accentColor || '#3b82f6',
      badge: params.badge?.trim() || '3D CUSTOM',
      emoji: '✨',
      isCustom: true,
      modelUrl: fileData || modelUrl,
      fileData,
      createdAt: Date.now(),
      trackingProfile: getAvatarTrackingProfile('three_robot'),
    };

    this.customAvatars.push(newAvatar);
    this.saveToStorage();
    this.notify();
    return newAvatar;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

export const avatarModelServiceSingleton = new AvatarModelService();
