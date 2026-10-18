/**
 * XStreamX - IndexedDB Service
 *
 * Base de datos cliente local de alto rendimiento y cero costo, 100% compatible
 * con entornos estáticos como GitHub Pages. Almacena binarios pesados (.glb, texturas,
 * imágenes), usuarios con credenciales y elementos/configuraciones sin los límites de 5MB de LocalStorage.
 *
 * Privacy by Design: Toda la información permanece en el almacenamiento local del navegador.
 */

import { PREDEFINED_AVATAR_THUMBNAILS } from './avatarThumbnails';
import { dbServiceSingleton } from '../dbService';

export interface StoredCustomModel {
  id: string;
  name: string;
  tagline?: string;
  category?: string;
  themeColor?: string;
  accentColor?: string;
  badge?: string;
  createdAt: number;
  blob?: Blob;
  fileData?: string; // Fallback dataUrl
  isPredefined?: boolean;
  isPublic?: boolean;
  previewImage?: string;
  originalImage?: string;
  debugParams?: any;
  format?: 'glb' | 'gltf' | 'obj' | 'stl' | 'vrm' | string;
  ownerId?: string; // Username or user ID that created/owns this avatar
}

export interface StoredElement<T = any> {
  key: string;
  value: T;
  updatedAt: number;
}

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'participant';
  provider: 'local';
  password: string;
  avatarId: string;
  createdAt: number;
  bio?: string;
  createdAvatars?: string[];
}

export const SEED_USERS: UserAccount[] = [
  {
    id: 'user_admin',
    username: 'admin',
    name: 'Administrador Presidencial',
    role: 'admin',
    provider: 'local',
    password: 'Pr3siZ2027',
    avatarId: 'lincoln_3d',
    createdAt: Date.now(),
  },
  {
    id: 'user_presi1',
    username: 'presi1',
    name: 'Presidente 1 (Lincoln)',
    role: 'participant',
    provider: 'local',
    password: 'Avatar1',
    avatarId: 'lincoln_3d',
    createdAt: Date.now(),
  },
  {
    id: 'user_presi2',
    username: 'presi2',
    name: 'Presidente 2 (Biden)',
    role: 'participant',
    provider: 'local',
    password: 'Avatar2',
    avatarId: 'biden_3d',
    createdAt: Date.now(),
  },
  {
    id: 'user_presi3',
    username: 'presi3',
    name: 'Presidente 3 (Obama)',
    role: 'participant',
    provider: 'local',
    password: 'Avatar3',
    avatarId: 'obama_3d',
    createdAt: Date.now(),
  },
  {
    id: 'user_presi4',
    username: 'presi4',
    name: 'Presidente 4 (Trump)',
    role: 'participant',
    provider: 'local',
    password: 'Avatar4',
    avatarId: 'trump_3d',
    createdAt: Date.now(),
  },
  {
    id: 'user_presi5',
    username: 'presi5',
    name: 'Presidente 5 (Cyber)',
    role: 'participant',
    provider: 'local',
    password: 'Avatar5',
    avatarId: 'neon_holo',
    createdAt: Date.now(),
  },
  {
    id: 'user_presi6',
    username: 'presi6',
    name: 'Presidente 6 (Robot)',
    role: 'participant',
    provider: 'local',
    password: 'Avatar6',
    avatarId: 'three_robot',
    createdAt: Date.now(),
  },
];

export const PREDEFINED_MODELS_SEED: Omit<StoredCustomModel, 'blob' | 'fileData'>[] = [
  {
    id: 'three_robot',
    name: 'Robot 3D',
    tagline: 'Robot mecha 3D interactivo con huesos esqueléticos y morph targets',
    category: 'Robot',
    themeColor: '#10b981',
    accentColor: '#06b6d4',
    badge: '3D MECHA',
    createdAt: 1710000000000,
    isPredefined: true,
  },
  {
    id: 'cat_3d',
    name: 'Gato 3D',
    tagline: 'Felino 3D con orejas activas, bigotes, ojos expresivos y cascabel',
    category: 'Animals',
    themeColor: '#f59e0b',
    accentColor: '#fbbf24',
    badge: '3D FELINO',
    createdAt: 1710000000001,
    isPredefined: true,
  },
  {
    id: 'dog_3d',
    name: 'Perro 3D',
    tagline: 'Cachorro 3D alegre con orejas rebotantes, hocico húmedo y lengua',
    category: 'Animals',
    themeColor: '#3b82f6',
    accentColor: '#60a5fa',
    badge: '3D CANINO',
    createdAt: 1710000000002,
    isPredefined: true,
  },
  {
    id: 'female_3d',
    name: 'Chica 3D',
    tagline: 'Personaje 3D anime femenina con peinado dinámico y pestañas',
    category: 'Character',
    themeColor: '#ec4899',
    accentColor: '#f43f5e',
    badge: '3D ANIME',
    createdAt: 1710000000003,
    isPredefined: true,
  },
  {
    id: 'horse_3d',
    name: 'Caballo 3D',
    tagline: 'Caballo 3D majestuoso con hocico esculpido, crin ondeante y orejas alertas',
    category: 'Animals',
    themeColor: '#8b5cf6',
    accentColor: '#a855f7',
    badge: '3D EQUINO',
    createdAt: 1710000000004,
    isPredefined: true,
  },
  {
    id: 'fox_sensei',
    name: 'Kitsune Fox 3D',
    tagline: 'Zorro místico 3D con marcas espirituales y mandíbula animada',
    category: 'Fantasy',
    themeColor: '#f97316',
    accentColor: '#ea580c',
    badge: '3D SPIRIT',
    createdAt: 1710000000005,
    isPredefined: true,
  },
  {
    id: 'mesh_outline',
    name: 'Holo Mesh 3D',
    tagline: 'Malla wireframe holográfica con captura completa de expresiones y puntos',
    category: 'Sci-Fi',
    themeColor: '#06b6d4',
    accentColor: '#38bdf8',
    badge: '3D MESH',
    createdAt: 1710000000006,
    isPredefined: true,
  },
  {
    id: 'neon_holo',
    name: 'Neon Cyber 3D',
    tagline: 'Avatar holográfico de líneas de neón reactivo a todos los puntos de tracking facial',
    category: 'Sci-Fi',
    themeColor: '#00f0ff',
    accentColor: '#3b82f6',
    badge: 'NEON HOLO',
    createdAt: 1710000000007,
    isPredefined: true,
  },
  {
    id: 'cyber_nova',
    name: 'Cyber Nova 3D',
    tagline: 'Androide cibernético con visor holográfico y circuitos reactivos',
    category: 'Sci-Fi',
    themeColor: '#06b6d4',
    accentColor: '#3b82f6',
    badge: '3D CYBER',
    createdAt: 1710000000008,
    isPredefined: true,
  },
  {
    id: 'face_cap',
    name: 'Face Cap 3D',
    tagline: 'Rostro humano 3D de alta precisión con 52 morph targets ARKit sincronizados',
    category: 'Character',
    themeColor: '#38bdf8',
    accentColor: '#818cf8',
    badge: '52 PTS ARKIT',
    createdAt: 1710000000009,
    isPredefined: true,
  },
  {
    id: 'lincoln_3d',
    name: 'Lincoln 3D',
    tagline: 'Busto estilizado de Abraham Lincoln con sombrero de copa y seguimiento en vivo',
    category: 'Líderes',
    themeColor: '#3b82f6',
    accentColor: '#60a5fa',
    badge: '3D GLB',
    createdAt: 1710000000010,
    isPredefined: true,
  },
  {
    id: 'biden_3d',
    name: 'Biden 3D',
    tagline: 'Personaje 3D interactivo con huesos esqueléticos y seguimiento facial',
    category: 'Líderes',
    themeColor: '#2563eb',
    accentColor: '#38bdf8',
    badge: '3D RIGGED',
    createdAt: 1710000000011,
    isPredefined: true,
  },
  {
    id: 'obama_3d',
    name: 'Obama 3D',
    tagline: 'Busto 3D presidencial con textura fotorealista y orientación en vivo',
    category: 'Líderes',
    themeColor: '#0ea5e9',
    accentColor: '#38bdf8',
    badge: '3D BUSTO',
    createdAt: 1710000000012,
    isPredefined: true,
  },
  {
    id: 'trump_3d',
    name: 'Trump 3D',
    tagline: 'Busto 3D presidencial estilizado con traje, corbata y seguimiento en vivo',
    category: 'Líderes',
    themeColor: '#e11d48',
    accentColor: '#f59e0b',
    badge: '3D GLB',
    createdAt: 1710000000013,
    isPredefined: true,
  },
  {
    id: 'mipipi',
    name: 'Mipipi 3D',
    tagline: 'Personaje 3D con morph targets faciales, parpadeo y sincronización de voz',
    category: 'Character',
    themeColor: '#10b981',
    accentColor: '#34d399',
    badge: '3D MORPH',
    createdAt: 1710000000014,
    isPredefined: true,
  },
];

const DB_NAME = 'xstreamx_db';
const DB_VERSION = 2; // Version bumped to support users store and seed data

// Object Store Names
const STORE_MODELS = 'custom_models';
const STORE_ELEMENTS = 'elements';
const STORE_METADATA = 'metadata';
const STORE_USERS = 'users';

class IndexedDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isSeeded = false;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.init().then(() => this.seedInitialData()).catch(() => {});
    }
  }

  /**
   * Inicializa y abre la conexión a la base de datos IndexedDB
   */
  public init(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB no está soportado en este entorno.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Store para modelos 3D (.glb / avatares)
        if (!db.objectStoreNames.contains(STORE_MODELS)) {
          const modelStore = db.createObjectStore(STORE_MODELS, { keyPath: 'id' });
          modelStore.createIndex('createdAt', 'createdAt', { unique: false });
          modelStore.createIndex('name', 'name', { unique: false });
          modelStore.createIndex('category', 'category', { unique: false });
        }

        // 2. Store genérico para elementos de la aplicación (presets, configuraciones, estados)
        if (!db.objectStoreNames.contains(STORE_ELEMENTS)) {
          const elementStore = db.createObjectStore(STORE_ELEMENTS, { keyPath: 'key' });
          elementStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 3. Store para metadatos del sistema (avatares deshabilitados, eliminados, renombrados)
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }

        // 4. Store para cuentas de usuarios y credenciales
        if (!db.objectStoreNames.contains(STORE_USERS)) {
          const userStore = db.createObjectStore(STORE_USERS, { keyPath: 'username' });
          userStore.createIndex('role', 'role', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[IndexedDbService] Error abriendo la base de datos:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Helper privado para ejecutar transacciones en IndexedDB
   */
  private async getStore(
    storeName: string,
    mode: IDBTransactionMode
  ): Promise<{ store: IDBObjectStore; tx: IDBTransaction }> {
    const db = await this.init();
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    return { store, tx };
  }

  /**
   * Guarda los modelos predefinidos y usuarios iniciales si no existen aún en la base de datos
   */
  public async seedInitialData(): Promise<void> {
    if (this.isSeeded || typeof window === 'undefined') return;

    try {
      // 1. Sembrar usuarios (admin y presi1 al presi6)
      for (const u of SEED_USERS) {
        const existing = await this.getUser(u.username);
        if (!existing) {
          await this.saveUser(u);
        } else if (u.username === 'admin' && existing.password !== u.password) {
          existing.password = u.password;
          await this.saveUser(existing);
        }
      }

      // 2. Sembrar catálogo de modelos predefinidos en STORE_MODELS
      for (const m of PREDEFINED_MODELS_SEED) {
        const previewImage = PREDEFINED_AVATAR_THUMBNAILS[m.id];
        const existing = await this.getModel(m.id);
        if (!existing) {
          await this.saveModel({ ...m, previewImage } as StoredCustomModel);
        } else if (!existing.previewImage && previewImage) {
          existing.previewImage = previewImage;
          await this.saveModel(existing);
        }
      }

      this.isSeeded = true;
    } catch (err) {
      console.warn('[IndexedDbService] Error en seed de datos iniciales:', err);
    }
  }

  // ==========================================
  // USUARIOS Y AUTENTICACIÓN
  // ==========================================

  /**
   * Guarda o actualiza un usuario en la base de datos (Supabase Cloud + Local Cache)
   */
  async saveUser(user: UserAccount): Promise<void> {
    try {
      const normalized = {
        ...user,
        username: user.username.trim().toLowerCase(),
      };

      // 1. Persist directly in online Supabase centralized DB
      await dbServiceSingleton.upsertUser({
        id: normalized.id,
        username: normalized.username,
        name: normalized.name,
        role: normalized.role,
        provider: 'local',
        password: normalized.password,
        avatarId: normalized.avatarId as any,
        bio: normalized.bio,
        createdAvatars: normalized.createdAvatars,
        createdAt: normalized.createdAt,
      });

      // 2. Update local store
      try {
        const { store, tx } = await this.getStore(STORE_USERS, 'readwrite');
        store.put(normalized);
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch (_) {}
    } catch (err) {
      console.error('[IndexedDbService] Error guardando usuario:', err);
      throw err;
    }
  }

  /**
   * Obtiene un usuario por su nombre de usuario desde Supabase Cloud con fallback local
   */
  async getUser(username: string): Promise<UserAccount | null> {
    const cleanUser = username.trim().toLowerCase();

    // 1. Consultar Supabase DB
    try {
      const cloud = await dbServiceSingleton.getUserByUsername(cleanUser);
      if (cloud) {
        return cloud as unknown as UserAccount;
      }
    } catch (_) {}

    // 2. Fallback local store
    try {
      const { store, tx } = await this.getStore(STORE_USERS, 'readonly');
      const request = store.get(cleanUser);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(request.result || null);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`[IndexedDbService] Error obteniendo usuario '${username}':`, err);
      return null;
    }
  }

  /**
   * Elimina un usuario por su nombre de usuario en Supabase y localmente
   */
  async deleteUser(username: string): Promise<void> {
    const cleanUser = username.trim().toLowerCase();

    try {
      await dbServiceSingleton.deleteUser(cleanUser);
    } catch (e) {
      console.warn('[IndexedDbService] Error eliminando usuario de Supabase:', e);
    }

    try {
      const { store, tx } = await this.getStore(STORE_USERS, 'readwrite');
      store.delete(cleanUser);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error(`[IndexedDbService] Error eliminando usuario '${username}':`, err);
    }
  }

  /**
   * Actualiza las credenciales y datos de un usuario por el Administrador en Supabase y localmente
   */
  async adminUpdateUser(
    oldUsername: string,
    updates: {
      newUsername?: string;
      newPassword?: string;
      newName?: string;
      newRole?: 'admin' | 'participant';
    }
  ): Promise<UserAccount> {
    const cleanOld = oldUsername.trim().toLowerCase();
    const existing = await this.getUser(cleanOld);
    if (!existing) {
      throw new Error(`El usuario '${oldUsername}' no existe en la base de datos.`);
    }

    const cleanNew = updates.newUsername ? updates.newUsername.trim().toLowerCase() : cleanOld;

    if (cleanNew !== cleanOld) {
      const alreadyTaken = await this.getUser(cleanNew);
      if (alreadyTaken) {
        throw new Error(`El nombre de usuario '${cleanNew}' ya está en uso.`);
      }
    }

    const updatedUser: UserAccount = {
      ...existing,
      username: cleanNew,
      name: updates.newName && updates.newName.trim() ? updates.newName.trim() : existing.name,
      password: updates.newPassword && updates.newPassword.trim() ? updates.newPassword.trim() : existing.password,
      role: updates.newRole || existing.role,
    };

    // Actualizar en Supabase
    await dbServiceSingleton.adminUpdateUser(cleanOld, {
      newUsername: cleanNew,
      newPassword: updatedUser.password,
      newName: updatedUser.name,
      newRole: updatedUser.role,
    });

    if (cleanNew !== cleanOld) {
      try {
        const { store, tx } = await this.getStore(STORE_USERS, 'readwrite');
        store.delete(cleanOld);
        store.put(updatedUser);
        await new Promise<void>((res, rej) => {
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      } catch (_) {}
    } else {
      try {
        const { store, tx } = await this.getStore(STORE_USERS, 'readwrite');
        store.put(updatedUser);
        await new Promise<void>((res, rej) => {
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      } catch (_) {}
    }

    return updatedUser;
  }

  /**
   * Obtiene todos los usuarios registrados en Supabase Cloud con fallback
   */
  async getAllUsers(): Promise<UserAccount[]> {
    try {
      const cloudUsers = await dbServiceSingleton.getAllUsers();
      if (cloudUsers && cloudUsers.length > 0) {
        return cloudUsers as unknown as UserAccount[];
      }
    } catch (_) {}

    try {
      const { store, tx } = await this.getStore(STORE_USERS, 'readonly');
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          const list = request.result || [];
          if (list.length === 0) {
            resolve(SEED_USERS);
          } else {
            resolve(list);
          }
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[IndexedDbService] Error listando usuarios:', err);
      return SEED_USERS;
    }
  }

  /**
   * Autentica credenciales contra la base de datos Supabase Online con fallback de memoria
   */
  async authenticateUser(username: string, password: string): Promise<UserAccount | null> {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Supabase online authentication
    try {
      const cloudAuth = await dbServiceSingleton.authenticateUser(cleanUser, cleanPass);
      if (cloudAuth) {
        return cloudAuth as unknown as UserAccount;
      }
    } catch (_) {}

    // 2. Intentar validar en local store
    try {
      const user = await this.getUser(cleanUser);
      if (user && user.password === cleanPass) {
        return user;
      }
    } catch (_) {}

    // 3. Fallback con la lista semilla instantánea (0ms)
    const seedMatch = SEED_USERS.find(
      (u) => u.username.toLowerCase() === cleanUser && u.password === cleanPass
    );
    if (seedMatch) {
      return seedMatch;
    }

    return null;
  }

  /**
   * Asocia un ID de avatar creado a la cuenta del usuario en Supabase y localmente
   */
  async addAvatarToUser(username: string, avatarId: string): Promise<UserAccount | null> {
    const user = await this.getUser(username);
    if (!user) return null;

    const existingList = user.createdAvatars || [];
    if (!existingList.includes(avatarId)) {
      user.createdAvatars = [...existingList, avatarId];
      await this.saveUser(user);
    }
    return user;
  }

  /**
   * Obtiene todos los modelos creados por un usuario específico
   */
  async getUserModels(username: string): Promise<StoredCustomModel[]> {
    const allModels = await this.getAllModels();
    const cleanUser = username.trim().toLowerCase();
    return allModels.filter(
      (m) => m.ownerId && m.ownerId.trim().toLowerCase() === cleanUser
    );
  }

  // ==========================================
  // MODELOS 3D (AVATARES .GLB Y PREDEFINIDOS)
  // ==========================================

  /**
   * Guarda o actualiza un modelo 3D en la base de datos
   */
  async saveModel(model: StoredCustomModel): Promise<void> {
    try {
      const { store, tx } = await this.getStore(STORE_MODELS, 'readwrite');
      store.put(model);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('[IndexedDbService] Error guardando modelo 3D:', err);
      throw err;
    }
  }

  /**
   * Obtiene todos los modelos 3D almacenados
   */
  async getAllModels(): Promise<StoredCustomModel[]> {
    try {
      const { store, tx } = await this.getStore(STORE_MODELS, 'readonly');
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(request.result || []);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[IndexedDbService] Error obteniendo modelos:', err);
      return [];
    }
  }

  /**
   * Obtiene un modelo 3D por su ID
   */
  async getModel(id: string): Promise<StoredCustomModel | null> {
    try {
      const { store, tx } = await this.getStore(STORE_MODELS, 'readonly');
      const request = store.get(id);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(request.result || null);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`[IndexedDbService] Error obteniendo modelo ${id}:`, err);
      return null;
    }
  }

  /**
   * Elimina un modelo 3D por su ID
   */
  async deleteModel(id: string): Promise<void> {
    try {
      const { store, tx } = await this.getStore(STORE_MODELS, 'readwrite');
      store.delete(id);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error(`[IndexedDbService] Error eliminando modelo ${id}:`, err);
      throw err;
    }
  }

  // ==========================================
  // ELEMENTOS GENÉRICOS (KEY-VALUE STORE)
  // ==========================================

  /**
   * Guarda cualquier tipo de elemento en la base de datos
   */
  async setElement<T = any>(key: string, value: T): Promise<void> {
    try {
      const { store, tx } = await this.getStore(STORE_ELEMENTS, 'readwrite');
      const record: StoredElement<T> = {
        key,
        value,
        updatedAt: Date.now(),
      };
      store.put(record);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error(`[IndexedDbService] Error guardando elemento '${key}':`, err);
      throw err;
    }
  }

  /**
   * Obtiene un elemento por su clave
   */
  async getElement<T = any>(key: string): Promise<T | null> {
    try {
      const { store, tx } = await this.getStore(STORE_ELEMENTS, 'readonly');
      const request = store.get(key);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          const result = request.result as StoredElement<T> | undefined;
          resolve(result ? result.value : null);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`[IndexedDbService] Error obteniendo elemento '${key}':`, err);
      return null;
    }
  }

  /**
   * Elimina un elemento por su clave
   */
  async deleteElement(key: string): Promise<void> {
    try {
      const { store, tx } = await this.getStore(STORE_ELEMENTS, 'readwrite');
      store.delete(key);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error(`[IndexedDbService] Error eliminando elemento '${key}':`, err);
      throw err;
    }
  }

  /**
   * Obtiene todos los elementos almacenados
   */
  async getAllElements<T = any>(): Promise<Array<{ key: string; value: T; updatedAt: number }>> {
    try {
      const { store, tx } = await this.getStore(STORE_ELEMENTS, 'readonly');
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(request.result || []);
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[IndexedDbService] Error listando elementos:', err);
      return [];
    }
  }

  // ==========================================
  // METADATOS DEL SISTEMA
  // ==========================================

  /**
   * Guarda metadatos de la aplicación
   */
  async setMetadata<T = any>(key: string, value: T): Promise<void> {
    try {
      const { store, tx } = await this.getStore(STORE_METADATA, 'readwrite');
      store.put({ key, value });
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error(`[IndexedDbService] Error guardando metadata '${key}':`, err);
      throw err;
    }
  }

  /**
   * Obtiene metadatos de la aplicación
   */
  async getMetadata<T = any>(key: string): Promise<T | null> {
    try {
      const { store, tx } = await this.getStore(STORE_METADATA, 'readonly');
      const request = store.get(key);
      return new Promise((resolve, reject) => {
        tx.oncomplete = () => {
          const res = request.result;
          resolve(res ? res.value : null);
        };
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`[IndexedDbService] Error obteniendo metadata '${key}':`, err);
      return null;
    }
  }

  // ==========================================
  // UTILIDADES & MIGRACIÓN DESDE LOCALSTORAGE
  // ==========================================

  /**
   * Convierte un Data URL Base64 a Blob de forma segura
   */
  public dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'model/gltf-binary';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * Migración transparente de modelos antiguos desde LocalStorage a IndexedDB
   * para liberar memoria de LocalStorage y evitar errores QuotaExceededError.
   */
  async migrateFromLocalStorage(legacyCustomStorageKey: string): Promise<StoredCustomModel[]> {
    if (typeof window === 'undefined') return [];

    try {
      const raw = localStorage.getItem(legacyCustomStorageKey);
      if (!raw) return [];

      const items: any[] = JSON.parse(raw);
      if (!Array.isArray(items) || items.length === 0) return [];

      console.info(`[IndexedDbService] Migrando ${items.length} modelos desde LocalStorage a IndexedDB...`);

      const migrated: StoredCustomModel[] = [];

      for (const item of items) {
        let blob: Blob | undefined;
        if (item.fileData && typeof item.fileData === 'string' && item.fileData.startsWith('data:')) {
          try {
            blob = this.dataUrlToBlob(item.fileData);
          } catch (_) {}
        }

        const model: StoredCustomModel = {
          id: item.id,
          name: item.name,
          tagline: item.tagline,
          category: item.category,
          themeColor: item.themeColor,
          accentColor: item.accentColor,
          badge: item.badge,
          createdAt: item.createdAt || Date.now(),
          blob,
          fileData: item.fileData,
        };

        await this.saveModel(model);
        migrated.push(model);
      }

      // Limpiar LocalStorage tras migrar exitosamente para no agotar la cuota de 5MB
      localStorage.removeItem(legacyCustomStorageKey);
      console.info('[IndexedDbService] Migración completada y cuota de LocalStorage liberada.');

      return migrated;
    } catch (e) {
      console.warn('[IndexedDbService] Error en migración desde LocalStorage:', e);
      return [];
    }
  }
}

export const indexedDbService = new IndexedDbService();
