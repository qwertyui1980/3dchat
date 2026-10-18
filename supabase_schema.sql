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
    password TEXT DEFAULT '',
    avatar_id TEXT DEFAULT 'three_robot',
    bio TEXT DEFAULT '',
    created_avatars JSONB DEFAULT '[]'::jsonb,
    created_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT,
    updated_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- Migrations for existing setups:
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_avatars JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_id TEXT DEFAULT 'three_robot';

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
    model_data TEXT DEFAULT '',
    debug_params JSONB DEFAULT '{}'::jsonb,
    created_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- Migrations for existing setups:
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS model_data TEXT DEFAULT '';
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS debug_params JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE public.avatars ADD COLUMN IF NOT EXISTS owner_id TEXT DEFAULT '';

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

-- 7. Insert all default platform avatars into public collection
INSERT INTO public.avatars (id, name, tagline, category, theme_color, accent_color, badge, owner_id, preview_image, format, is_public, created_at)
VALUES
('three_robot', 'Robot 3D', 'Robot mecha 3D interactivo con huesos esqueléticos y morph targets', 'Robot', '#10b981', '#06b6d4', '3D MECHA', 'system', '', 'glb', true, 1700000000000),
('cat_3d', 'Gato 3D', 'Felino 3D con orejas activas, bigotes, ojos expresivos y cascabel', 'Animals', '#f59e0b', '#fbbf24', '3D FELINO', 'system', '', 'glb', true, 1700000000000),
('dog_3d', 'Perro 3D', 'Cachorro 3D alegre con orejas rebotantes, hocico húmedo y lengua', 'Animals', '#3b82f6', '#60a5fa', '3D CANINO', 'system', '', 'glb', true, 1700000000000),
('female_3d', 'Chica 3D', 'Personaje 3D anime femenina con peinado dinámico y pestañas', 'Character', '#ec4899', '#f43f5e', '3D ANIME', 'system', '', 'glb', true, 1700000000000),
('horse_3d', 'Caballo 3D', 'Caballo 3D majestuoso con hocico esculpido, crin ondeante y orejas alertas', 'Animals', '#8b5cf6', '#a855f7', '3D EQUINO', 'system', '', 'glb', true, 1700000000000),
('fox_sensei', 'Kitsune Fox 3D', 'Zorro místico 3D con marcas espirituales y mandíbula animada', 'Fantasy', '#f97316', '#ea580c', '3D SPIRIT', 'system', '', 'glb', true, 1700000000000),
('mesh_outline', 'Holo Mesh 3D', 'Malla wireframe holográfica con captura completa de expresiones y puntos', 'Sci-Fi', '#06b6d4', '#38bdf8', '3D MESH', 'system', '', 'glb', true, 1700000000000),
('neon_holo', 'Neon Cyber 3D', 'Avatar holográfico de líneas de neón reactivo a todos los puntos de tracking facial', 'Sci-Fi', '#00f0ff', '#3b82f6', 'NEON HOLO', 'system', '', 'glb', true, 1700000000000),
('cyber_nova', 'Cyber Nova 3D', 'Androide cibernético con visor holográfico y circuitos reactivos', 'Sci-Fi', '#06b6d4', '#3b82f6', '3D CYBER', 'system', '', 'glb', true, 1700000000000),
('face_cap', 'Face Cap 3D', 'Rostro humano 3D de alta precisión con 52 morph targets ARKit sincronizados', 'Character', '#38bdf8', '#818cf8', '52 PTS ARKIT', 'system', '', 'glb', true, 1700000000000),
('lincoln_3d', 'Lincoln 3D', 'Busto estilizado de Abraham Lincoln con sombrero de copa y seguimiento en vivo', 'Líderes', '#3b82f6', '#60a5fa', '3D GLB', 'system', '', 'glb', true, 1700000000000),
('biden_3d', 'Biden 3D', 'Personaje 3D interactivo con huesos esqueléticos y seguimiento facial', 'Líderes', '#2563eb', '#38bdf8', '3D RIGGED', 'system', '', 'glb', true, 1700000000000),
('obama_3d', 'Obama 3D', 'Busto 3D presidencial con textura fotorealista y orientación en vivo', 'Líderes', '#0ea5e9', '#38bdf8', '3D BUSTO', 'system', '', 'glb', true, 1700000000000),
('trump_3d', 'Trump 3D', 'Busto 3D presidencial estilizado con traje, corbata y seguimiento en vivo', 'Líderes', '#e11d48', '#f59e0b', '3D GLB', 'system', '', 'glb', true, 1700000000000),
('mipipi', 'Mipipi 3D', 'Personaje 3D con morph targets faciales, parpadeo y sincronización de voz', 'Character', '#10b981', '#34d399', '3D MORPH', 'system', '', 'glb', true, 1700000000000)
ON CONFLICT (id) DO NOTHING;

-- 8. Insert initial default users into public.users table
INSERT INTO public.users (id, username, name, role, provider, password, avatar_id, bio, created_avatars, created_at)
VALUES
('user_admin', 'admin', 'Administrador Presidencial', 'admin', 'local', 'Pr3siZ2027', 'lincoln_3d', 'Cuenta Maestra de Administración XStreamX', '[]'::jsonb, 1700000000000),
('user_presi1', 'presi1', 'Presidente 1 (Lincoln)', 'participant', 'local', 'Avatar1', 'lincoln_3d', 'Sala Presidencial XStreamX', '[]'::jsonb, 1700000000000),
('user_presi2', 'presi2', 'Presidente 2 (Biden)', 'participant', 'local', 'Avatar2', 'biden_3d', 'Sala Presidencial XStreamX', '[]'::jsonb, 1700000000000),
('user_presi3', 'presi3', 'Presidente 3 (Obama)', 'participant', 'local', 'Avatar3', 'obama_3d', 'Sala Presidencial XStreamX', '[]'::jsonb, 1700000000000),
('user_presi4', 'presi4', 'Presidente 4 (Trump)', 'participant', 'local', 'Avatar4', 'trump_3d', 'Sala Presidencial XStreamX', '[]'::jsonb, 1700000000000),
('user_presi5', 'presi5', 'Presidente 5 (Cyber)', 'participant', 'local', 'Avatar5', 'neon_holo', 'Sala Presidencial XStreamX', '[]'::jsonb, 1700000000000),
('user_presi6', 'presi6', 'Presidente 6 (Robot)', 'participant', 'local', 'Avatar6', 'three_robot', 'Sala Presidencial XStreamX', '[]'::jsonb, 1700000000000)
ON CONFLICT (id) DO UPDATE SET
  password = EXCLUDED.password,
  name = EXCLUDED.name,
  role = EXCLUDED.role;



