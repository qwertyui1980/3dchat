import { AvatarId } from '../types';
import { getSupabaseClient } from './supabaseClient';

export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'participant';
  provider: 'local';
  avatarId: AvatarId;
  password?: string;
  createdAt: number;
  bio?: string;
  createdAvatars?: string[];
}

export type UserAccount = UserRecord;

export interface RoomRecord {
  id: string;
  name: string;
  adminId: string;
  isLocked: boolean;
  participantCount: number;
  createdAt: number;
  lastActive: number;
  hasActiveAdmin?: boolean;
  activeAdminName?: string;
}

const STORAGE_USERS_KEY = 'xstreamx_db_users';
const STORAGE_ROOMS_KEY = 'xstreamx_db_rooms';

// Default initial users
const DEFAULT_USERS: UserRecord[] = [
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

class DatabaseService {
  private localUsers: Map<string, UserRecord> = new Map();
  private localRooms: Map<string, RoomRecord> = new Map();
  private initialized = false;

  constructor() {
    this.initLocal();
  }

  private initLocal() {
    if (this.initialized || typeof window === 'undefined') return;

    // Load local users
    try {
      const storedUsers = localStorage.getItem(STORAGE_USERS_KEY);
      if (storedUsers) {
        const parsed: UserRecord[] = JSON.parse(storedUsers);
        parsed.forEach((u) => this.localUsers.set(u.username.toLowerCase(), u));
      } else {
        DEFAULT_USERS.forEach((u) => this.localUsers.set(u.username.toLowerCase(), u));
        this.saveLocalUsers();
      }
    } catch (e) {
      DEFAULT_USERS.forEach((u) => this.localUsers.set(u.username.toLowerCase(), u));
    }

    // Load local rooms (empty by default until an admin creates one)
    try {
      const storedRooms = localStorage.getItem(STORAGE_ROOMS_KEY);
      if (storedRooms) {
        const parsed: RoomRecord[] = JSON.parse(storedRooms);
        parsed.forEach((r) => this.localRooms.set(r.id.toLowerCase(), r));
      }
    } catch (e) {
      // Ignore
    }

    this.initialized = true;
  }

  private saveLocalUsers() {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.localUsers.values());
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[DB] Failed to persist local users:', e);
    }
  }

  private saveLocalRooms() {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.localRooms.values());
      localStorage.setItem(STORAGE_ROOMS_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[DB] Failed to persist local rooms:', e);
    }
  }

  // ==========================================
  // ROOMS (Supabase Cloud + Local Fallback)
  // ==========================================
  async getRooms(): Promise<RoomRecord[]> {
    this.initLocal();
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('last_active', { ascending: false })
          .limit(20);

        if (!error && data) {
          const mapped: RoomRecord[] = data.map((row: any) => ({
            id: row.id,
            name: row.name || `Espacio ${row.id.toUpperCase()}`,
            adminId: row.admin_id || '',
            isLocked: !!row.is_locked,
            participantCount: row.participant_count || 0,
            createdAt: row.created_at || Date.now(),
            lastActive: row.last_active || Date.now(),
          }));

          // Sync local map
          this.localRooms.clear();
          mapped.forEach((r) => this.localRooms.set(r.id.toLowerCase(), r));
          this.saveLocalRooms();

          return mapped;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching rooms, using local cache:', err);
      }
    }

    return Array.from(this.localRooms.values()).sort((a, b) => b.lastActive - a.lastActive);
  }

  async getRoom(id: string): Promise<RoomRecord | null> {
    this.initLocal();
    const cleanId = id.trim().toLowerCase();
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', cleanId)
          .maybeSingle();

        if (!error && data) {
          const room: RoomRecord = {
            id: data.id,
            name: data.name || `Espacio ${data.id.toUpperCase()}`,
            adminId: data.admin_id || '',
            isLocked: !!data.is_locked,
            participantCount: data.participant_count || 0,
            createdAt: data.created_at || Date.now(),
            lastActive: data.last_active || Date.now(),
          };
          this.localRooms.set(cleanId, room);
          this.saveLocalRooms();
          return room;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching room:', err);
      }
    }

    return this.localRooms.get(cleanId) || null;
  }

  async saveRoom(room: RoomRecord): Promise<RoomRecord> {
    this.initLocal();
    const cleanId = room.id.trim().toLowerCase();
    const now = Date.now();

    const updatedRoom: RoomRecord = {
      ...room,
      id: cleanId,
      lastActive: now,
      createdAt: room.createdAt || now,
    };

    // 1. Update local cache immediately
    this.localRooms.set(cleanId, updatedRoom);
    this.saveLocalRooms();

    // 2. Persist to Supabase if connected
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('rooms').upsert({
          id: cleanId,
          name: updatedRoom.name,
          admin_id: updatedRoom.adminId,
          is_locked: updatedRoom.isLocked,
          participant_count: updatedRoom.participantCount,
          created_at: updatedRoom.createdAt,
          last_active: updatedRoom.lastActive,
        });

        if (error) {
          console.warn('[Supabase] Room upsert warning:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase] Error saving room:', err);
      }
    }

    return updatedRoom;
  }

  async getActiveRoom(): Promise<RoomRecord | null> {
    this.initLocal();
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('last_active', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const room: RoomRecord = {
            id: data.id,
            name: data.name || `Espacio ${data.id.toUpperCase()}`,
            adminId: data.admin_id || '',
            isLocked: !!data.is_locked,
            participantCount: data.participant_count || 0,
            createdAt: data.created_at || Date.now(),
            lastActive: data.last_active || Date.now(),
          };
          this.localRooms.set(room.id.toLowerCase(), room);
          this.saveLocalRooms();
          return room;
        }
      } catch (err) {
        console.warn('[Supabase] Error getting active room:', err);
      }
    }

    const all = Array.from(this.localRooms.values()).sort((a, b) => b.lastActive - a.lastActive);
    if (all.length > 0) {
      return all[0];
    }

    return null;
  }

  async createOrActivateRoom(name?: string, adminId?: string): Promise<RoomRecord> {
    const defaultRoom: RoomRecord = {
      id: 'main',
      name: name || 'Espacio Principal en Vivo',
      adminId: adminId || 'admin',
      isLocked: false,
      participantCount: 1,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    return this.saveRoom(defaultRoom);
  }

  async setActiveRoom(room: RoomRecord): Promise<RoomRecord> {
    const saved = await this.saveRoom(room);
    return saved;
  }

  async deleteRoom(id: string): Promise<void> {
    this.initLocal();
    const cleanId = id.trim().toLowerCase();
    this.localRooms.delete(cleanId);
    this.saveLocalRooms();

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('rooms').delete().eq('id', cleanId);
      } catch (err) {
        console.warn('[Supabase] Error deleting room:', err);
      }
    }
  }

  // ==========================================
  // USERS (Supabase Cloud + Local Cache)
  // ==========================================
  async getUserByUsername(username: string): Promise<UserRecord | null> {
    this.initLocal();
    const cleanUsername = username.trim().toLowerCase();

    // Check local memory first for instant 0ms response
    const local = this.localUsers.get(cleanUsername);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', cleanUsername)
          .maybeSingle();

        if (!error && data) {
          const user: UserRecord = {
            id: data.id,
            username: data.username,
            name: data.name,
            role: data.role || 'participant',
            provider: data.provider || 'local',
            password: data.password || local?.password || '',
            avatarId: data.avatar_id || 'three_robot',
            createdAt: data.created_at || Date.now(),
            bio: data.bio || '',
            createdAvatars: Array.isArray(data.created_avatars) ? data.created_avatars : [],
          };
          this.localUsers.set(cleanUsername, user);
          this.saveLocalUsers();
          return user;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching user:', err);
      }
    }

    return local || null;
  }

  async getUser(username: string): Promise<UserRecord | null> {
    return this.getUserByUsername(username);
  }

  async authenticateUser(username: string, password: string): Promise<UserRecord | null> {
    this.initLocal();
    const cleanUser = username.trim().toLowerCase();
    const trimmedPass = password.trim();

    // 1. Fetch user from Supabase or local cache
    const user = await this.getUserByUsername(cleanUser);
    if (!user) return null;

    // 2. Validate password
    // First, check if stored password matches
    if (user.password && user.password === trimmedPass) {
      return user;
    }

    // Check against DEFAULT_USERS seed fallback (e.g. if Supabase record had empty password)
    const seed = DEFAULT_USERS.find((u) => u.username.toLowerCase() === cleanUser);
    if (seed && seed.password === trimmedPass) {
      // Update password in Supabase and cache if missing
      if (!user.password) {
        user.password = trimmedPass;
        this.upsertUser(user).catch(() => {});
      }
      return user;
    }

    return null;
  }

  async getAllUsers(): Promise<UserRecord[]> {
    this.initLocal();
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          data.forEach((row: any) => {
            const existingLocal = this.localUsers.get(row.username.toLowerCase());
            const u: UserRecord = {
              id: row.id,
              username: row.username,
              name: row.name,
              role: row.role || 'participant',
              provider: row.provider || 'local',
              password: row.password || existingLocal?.password || '',
              avatarId: row.avatar_id || 'three_robot',
              createdAt: row.created_at || Date.now(),
              bio: row.bio || '',
              createdAvatars: Array.isArray(row.created_avatars) ? row.created_avatars : [],
            };
            this.localUsers.set(u.username.toLowerCase(), u);
          });
          this.saveLocalUsers();
        }
      } catch (err) {
        console.warn('[Supabase] Error listing users:', err);
      }
    }

    return Array.from(this.localUsers.values());
  }

  async isUsernameAvailable(username: string): Promise<boolean> {
    const existing = await this.getUserByUsername(username);
    return !existing;
  }

  async upsertUser(user: UserRecord): Promise<UserRecord> {
    this.initLocal();
    const cleanUsername = user.username.trim().toLowerCase();

    // 1. Save to local cache immediately
    const recordToSave: UserRecord = {
      ...user,
      username: cleanUsername,
      password: user.password || this.localUsers.get(cleanUsername)?.password || '',
    };
    this.localUsers.set(cleanUsername, recordToSave);
    this.saveLocalUsers();

    // 2. Persist to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { error } = await supabase.from('users').upsert({
          id: recordToSave.id,
          username: cleanUsername,
          name: recordToSave.name,
          role: recordToSave.role,
          provider: recordToSave.provider,
          password: recordToSave.password || '',
          avatar_id: recordToSave.avatarId,
          bio: recordToSave.bio || '',
          created_avatars: recordToSave.createdAvatars || [],
          created_at: recordToSave.createdAt,
          updated_at: Date.now(),
        });

        if (error) {
          console.warn('[Supabase] User upsert notice:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase] Error saving user to Supabase:', err);
      }
    }

    return recordToSave;
  }

  async saveUser(user: UserRecord): Promise<UserRecord> {
    return this.upsertUser(user);
  }

  async adminUpdateUser(
    oldUsername: string,
    updates: {
      newUsername?: string;
      newPassword?: string;
      newName?: string;
      newRole?: 'admin' | 'participant';
    }
  ): Promise<UserRecord | null> {
    this.initLocal();
    const cleanOld = oldUsername.trim().toLowerCase();
    const existing = await this.getUserByUsername(cleanOld);
    if (!existing) return null;

    const cleanNew = updates.newUsername ? updates.newUsername.trim().toLowerCase() : cleanOld;
    const updated: UserRecord = {
      ...existing,
      username: cleanNew,
      password: updates.newPassword !== undefined ? updates.newPassword : existing.password,
      name: updates.newName && updates.newName.trim() ? updates.newName.trim() : existing.name,
      role: updates.newRole || existing.role,
    };

    if (cleanNew !== cleanOld) {
      this.localUsers.delete(cleanOld);
      this.localUsers.set(cleanNew, updated);
    } else {
      this.localUsers.set(cleanOld, updated);
    }
    this.saveLocalUsers();

    // Supabase sync
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        if (cleanNew !== cleanOld) {
          await supabase.from('users').delete().eq('username', cleanOld);
        }
        await this.upsertUser(updated);
      } catch (e) {
        console.warn('[Supabase] Error updating user in adminUpdateUser:', e);
      }
    }

    return updated;
  }

  async deleteUser(username: string): Promise<boolean> {
    this.initLocal();
    const cleanUser = username.trim().toLowerCase();
    this.localUsers.delete(cleanUser);
    this.saveLocalUsers();

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('users').delete().eq('username', cleanUser);
      } catch (err) {
        console.warn('[Supabase] Error deleting user:', err);
      }
    }
    return true;
  }

  async addAvatarToUser(username: string, avatarId: string): Promise<void> {
    const user = await this.getUserByUsername(username);
    if (!user) return;

    const existingList = Array.isArray(user.createdAvatars) ? user.createdAvatars : [];
    if (!existingList.includes(avatarId)) {
      user.createdAvatars = [...existingList, avatarId];
    }
    user.avatarId = avatarId as AvatarId;
    await this.upsertUser(user);
  }

  async deleteAvatar(avatarId: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('avatars').delete().eq('id', avatarId);
      } catch (err) {
        console.warn('[Supabase] Error deleting avatar from cloud:', err);
      }
    }

    // Also update any user having this in createdAvatars
    for (const [username, u] of this.localUsers.entries()) {
      if (u.createdAvatars && u.createdAvatars.includes(avatarId)) {
        u.createdAvatars = u.createdAvatars.filter((id) => id !== avatarId);
        if (u.avatarId === avatarId) {
          u.avatarId = 'face_cap';
        }
        this.upsertUser(u).catch(() => {});
      }
    }
  }

  async ensureSeedUsersInCloud(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      for (const seed of DEFAULT_USERS) {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('username', seed.username.toLowerCase())
          .maybeSingle();

        if (!data) {
          await supabase.from('users').insert({
            id: seed.id,
            username: seed.username.toLowerCase(),
            name: seed.name,
            role: seed.role,
            provider: seed.provider,
            password: seed.password || '',
            avatar_id: seed.avatarId,
            bio: seed.bio || '',
            created_avatars: seed.createdAvatars || [],
            created_at: seed.createdAt,
          });
        }
      }
    } catch (e) {
      console.warn('[Supabase] Notice ensuring seed users in cloud:', e);
    }
  }

  // ==========================================
  // AVATARS (Supabase Cloud + Local Sync)
  // ==========================================
  async saveAvatarRecord(avatar: {
    id: string;
    name: string;
    tagline?: string;
    category?: string;
    themeColor?: string;
    accentColor?: string;
    badge?: string;
    ownerId?: string;
    previewImage?: string;
    format?: string;
    isPublic?: boolean;
    createdAt?: number;
    modelData?: string;
    debugParams?: any;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      const payload: any = {
        id: avatar.id,
        name: avatar.name,
        tagline: avatar.tagline || '',
        category: avatar.category || (avatar.isPublic ? 'Catálogo Público' : 'Personalizados'),
        theme_color: avatar.themeColor || '#06b6d4',
        accent_color: avatar.accentColor || '#3b82f6',
        badge: avatar.badge || (avatar.isPublic ? 'PÚBLICO' : '3D'),
        owner_id: (avatar.ownerId || '').trim().toLowerCase(),
        preview_image: avatar.previewImage || '',
        format: avatar.format || 'glb',
        is_public: !!avatar.isPublic,
        created_at: avatar.createdAt || Date.now(),
      };

      if (avatar.modelData) {
        payload.model_data = avatar.modelData;
      }
      if (avatar.debugParams) {
        payload.debug_params = avatar.debugParams;
      }

      const { error } = await supabase.from('avatars').upsert(payload);
      if (error) {
        console.warn('[Supabase] Avatar upsert warning:', error.message);
      } else {
        console.info(`[Supabase] Avatar ${avatar.id} (${avatar.isPublic ? 'PÚBLICO' : 'PERSONAL'}) sincronizado en la nube.`);
      }
    } catch (err) {
      console.warn('[Supabase] Error saving avatar record:', err);
    }
  }

  async getPublicAvatarsFromCloud(): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching public avatars from cloud:', err);
    }
    return [];
  }

  async getAllAvatarsFromCloud(): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching all avatars from cloud:', err);
    }
    return [];
  }

  async getAvatarByIdFromCloud(avatarId: string): Promise<any | null> {
    const supabase = getSupabaseClient();
    if (!supabase || !avatarId) return null;

    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('id', avatarId)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching avatar by id:', err);
    }
    return null;
  }

  async getUserAvatarsFromCloud(ownerId: string): Promise<any[]> {
    const supabase = getSupabaseClient();
    if (!supabase || !ownerId) return [];

    try {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .eq('owner_id', ownerId.trim().toLowerCase())
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data;
      }
    } catch (err) {
      console.warn('[Supabase] Error fetching avatars from cloud:', err);
    }
    return [];
  }
}

export const dbServiceSingleton = new DatabaseService();
