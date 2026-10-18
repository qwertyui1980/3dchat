import { AvatarDefinition } from '../../types';
import { AVATAR_TRACKING_PROFILES, getAvatarTrackingProfile } from './avatarTrackingProfiles';

const BASE_AVATAR_LIST: Omit<AvatarDefinition, 'trackingProfile'>[] = [
  {
    id: 'three_robot',
    name: 'Robot 3D',
    tagline: 'Robot mecha 3D interactivo con huesos esqueléticos y morph targets',
    category: 'Robot',
    themeColor: '#10b981',
    accentColor: '#06b6d4',
    badge: '3D MECHA',
    emoji: '🤖',
  },
  {
    id: 'cat_3d',
    name: 'Gato 3D',
    tagline: 'Felino 3D con orejas activas, bigotes, ojos expresivos y cascabel',
    category: 'Animals',
    themeColor: '#f59e0b',
    accentColor: '#fbbf24',
    badge: '3D FELINO',
    emoji: '🐱',
  },
  {
    id: 'dog_3d',
    name: 'Perro 3D',
    tagline: 'Cachorro 3D alegre con orejas rebotantes, hocico húmedo y lengua',
    category: 'Animals',
    themeColor: '#3b82f6',
    accentColor: '#60a5fa',
    badge: '3D CANINO',
    emoji: '🐶',
  },
  {
    id: 'mesh_outline',
    name: 'Holo Mesh 3D',
    tagline: 'Malla wireframe holográfica con captura completa de expresiones y puntos',
    category: 'Sci-Fi',
    themeColor: '#06b6d4',
    accentColor: '#38bdf8',
    badge: '3D MESH',
    emoji: '🌐',
  },
  {
    id: 'neon_holo',
    name: 'Neon Cyber 3D',
    tagline: 'Avatar holográfico de líneas de neón reactivo a todos los puntos de tracking facial',
    category: 'Sci-Fi',
    themeColor: '#00f0ff',
    accentColor: '#3b82f6',
    badge: 'NEON HOLO',
    emoji: '💠',
  },
  {
    id: 'cyber_nova',
    name: 'Robota',
    tagline: 'Androide cibernético con visor holográfico y circuitos reactivos',
    category: 'Sci-Fi',
    themeColor: '#06b6d4',
    accentColor: '#3b82f6',
    badge: '3D CYBER',
    emoji: '🤖',
  },
  {
    id: 'face_cap',
    name: 'El Real',
    tagline: 'Rostro biomimético de alta precisión con 52 morph targets ARKit sincronizados',
    category: 'Humano',
    themeColor: '#38bdf8',
    accentColor: '#818cf8',
    badge: '52 PTS ARKIT',
    emoji: '👤',
  },
];

export const ALL_KNOWN_BUILTIN_IDS: string[] = [
  'three_robot',
  'cat_3d',
  'dog_3d',
  'mesh_outline',
  'neon_holo',
  'cyber_nova',
  'face_cap',
  'female_3d',
  'horse_3d',
  'fox_sensei',
  'lincoln_3d',
  'biden_3d',
  'obama_3d',
  'trump_3d',
  'mipipi',
];

export const AVATAR_LIST: AvatarDefinition[] = BASE_AVATAR_LIST.map((avatar) => ({
  ...avatar,
  trackingProfile: getAvatarTrackingProfile(avatar.id),
}));

export const DEFAULT_AVATAR = AVATAR_LIST.find((a) => a.id === 'face_cap') || AVATAR_LIST[0];

