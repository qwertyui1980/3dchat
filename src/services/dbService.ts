import { AvatarId } from '../types';
import { getSupabaseClient } from './supabaseClient';

export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'participant';
  provider: 'local' | 'x';
  avatarId: AvatarId;
  createdAt: number;
}

export interface RoomRecord {
  id: string;
  name: string;
  adminId: string;
  isLocked: boolean;
  participantCount: number;
  createdAt: number;
  lastActive: number;
}

const STORAGE_USERS_KEY = 'xstreamx_db_users';
const STORAGE_ROOMS_KEY = 'xstreamx_db_rooms';

// Default initial users
const DEFAULT_USERS: UserRecord[] = [
  {
    id: 'user_admin',
    username: 'admin',
    name: 'Admin',
    role: 'admin',
    provider: 'local',
    avatarId: 'three_robot',
    createdAt: Date.now(),
  },
  {
    id: 'user_avatar',
    username: 'avatar',
    name: 'Avatar',
    role: 'participant',
    provider: 'local',
    avatarId: 'cat_3d',
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

    // Load local rooms
    try {
      const storedRooms = localStorage.getItem(STORAGE_ROOMS_KEY);
      if (storedRooms) {
        const parsed: RoomRecord[] = JSON.parse(storedRooms);
        parsed.forEach((r) => this.localRooms.set(r.id.toLowerCase(), r));
      } else {
        const defaultRoom: RoomRecord = {
          id: 'alpha',
          name: 'Sala ALPHA',
          adminId: 'user_admin',
          isLocked: false,
          participantCount: 0,
          createdAt: Date.now(),
          lastActive: Date.now(),
        };
        this.localRooms.set('alpha', defaultRoom);
        this.saveLocalRooms();
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

        if (!error && data && data.length > 0) {
          const mapped: RoomRecord[] = data.map((row: any) => ({
            id: row.id,
            name: row.name || `Sala ${row.id.toUpperCase()}`,
            adminId: row.admin_id || '',
            isLocked: !!row.is_locked,
            participantCount: row.participant_count || 0,
            createdAt: row.created_at || Date.now(),
            lastActive: row.last_active || Date.now(),
          }));

          // Sync local map
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
            name: data.name || `Sala ${data.id.toUpperCase()}`,
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

  async getActiveRoom(): Promise<RoomRecord> {
    this.initLocal();
    const supabase = getSupabaseClient();

    if (supabase) {
      try {
        // First check if there is an explicit active_room or get the most recent room
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .order('last_active', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          const room: RoomRecord = {
            id: data.id,
            name: data.name || `Sala ${data.id.toUpperCase()}`,
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

    const defaultRoom: RoomRecord = {
      id: 'alpha',
      name: 'Sala ALPHA (En Vivo)',
      adminId: 'user_admin',
      isLocked: false,
      participantCount: 0,
      createdAt: Date.now(),
      lastActive: Date.now(),
    };
    this.localRooms.set('alpha', defaultRoom);
    this.saveLocalRooms();
    return defaultRoom;
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
  // USERS (Supabase Cloud + Local Fallback)
  // ==========================================
  async getUserByUsername(username: string): Promise<UserRecord | null> {
    this.initLocal();
    const cleanUsername = username.trim().toLowerCase();
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
            avatarId: data.avatar_id || 'three_robot',
            createdAt: data.created_at || Date.now(),
          };
          this.localUsers.set(cleanUsername, user);
          this.saveLocalUsers();
          return user;
        }
      } catch (err) {
        console.warn('[Supabase] Error fetching user:', err);
      }
    }

    return this.localUsers.get(cleanUsername) || null;
  }

  async upsertUser(user: UserRecord): Promise<UserRecord> {
    this.initLocal();
    const cleanUsername = user.username.trim().toLowerCase();

    // 1. Save to local cache
    this.localUsers.set(cleanUsername, user);
    this.saveLocalUsers();

    // 2. Persist to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('users').upsert({
          id: user.id,
          username: cleanUsername,
          name: user.name,
          role: user.role,
          provider: user.provider,
          avatar_id: user.avatarId,
          created_at: user.createdAt,
        });
      } catch (err) {
        console.warn('[Supabase] Error saving user:', err);
      }
    }

    return user;
  }

  async registerXUser(xHandle: string, displayName?: string): Promise<UserRecord> {
    this.initLocal();
    const cleanHandle = xHandle.replace(/^@/, '').trim().toLowerCase();
    const existing = await this.getUserByUsername(cleanHandle);

    if (existing) {
      return existing;
    }

    const newUser: UserRecord = {
      id: `x_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      username: cleanHandle,
      name: displayName || `@${cleanHandle}`,
      role: 'participant',
      provider: 'x',
      avatarId: 'cat_3d',
      createdAt: Date.now(),
    };

    return this.upsertUser(newUser);
  }
}

export const dbServiceSingleton = new DatabaseService();
