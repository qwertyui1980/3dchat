-- ==============================================================================
-- XStreamX - Supabase SQL Schema for Persistent Rooms and Users
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/zhlhyasefzwnecszazlf/sql)
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
    created_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Allow public read/write access for real-time room creation & joining
CREATE POLICY "Allow public read on rooms" ON public.rooms
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update on rooms" ON public.rooms
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on users" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert/update on users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Insert initial default ALPHA room
INSERT INTO public.rooms (id, name, admin_id, is_locked, participant_count, created_at, last_active)
VALUES ('alpha', 'Sala ALPHA', 'user_admin', false, 0, (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT, (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT)
ON CONFLICT (id) DO UPDATE SET last_active = EXCLUDED.last_active;
