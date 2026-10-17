-- ==============================================================================
-- XStreamX - Supabase SQL Schema for Persistent Rooms, Users & 3D Avatars
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/zhlhyasefzwnecszazlf/sql
-- ==============================================================================

-- 1. Create 'rooms' table
CREATE TABLE IF NOT EXISTS public.rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    admin_id TEXT DEFAULT '',
    is_locked BOOLEAN DEFAULT false,
    participant_count INTEGER DEFAULT 0,
    created_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
    last_active BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- 2. Create 'users' table
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'participant',
    provider TEXT DEFAULT 'local',
    avatar_id TEXT DEFAULT 'three_robot',
    bio TEXT DEFAULT '',
    created_avatars JSONB DEFAULT '[]'::jsonb,
    created_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- 3. Create 'avatars' table (for user-created and custom 3D avatars)
CREATE TABLE IF NOT EXISTS public.avatars (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tagline TEXT DEFAULT '',
    category TEXT DEFAULT 'Personalizados',
    theme_color TEXT DEFAULT '#06b6d4',
    accent_color TEXT DEFAULT '#3b82f6',
    badge TEXT DEFAULT '3D',
    owner_id TEXT DEFAULT '',
    preview_image TEXT DEFAULT '',
    format TEXT DEFAULT 'glb',
    is_public BOOLEAN DEFAULT false,
    created_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- 5. Policies for public access (Realtime & P2P collaboration)
CREATE POLICY "Allow public read on rooms" ON public.rooms
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on rooms" ON public.rooms
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on users" ON public.users
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on avatars" ON public.avatars
    FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update on avatars" ON public.avatars
    FOR ALL USING (true) WITH CHECK (true);

-- 6. Insert initial default main room
INSERT INTO public.rooms (id, name, admin_id, is_locked, participant_count, created_at, last_active)
VALUES ('main', 'Espacio Principal en Vivo', 'user_admin', false, 0, (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT, (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT)
ON CONFLICT (id) DO UPDATE SET last_active = EXCLUDED.last_active;

