import { AvatarId, AvatarTrackingProfile } from '../../types';

/**
 * Registry of Avatar Tracking Profiles
 * Modifies the points, quantity, positions, and contours of the mesh
 * dynamically based on the selected 3D avatar model.
 */
export const AVATAR_TRACKING_PROFILES: Record<AvatarId, AvatarTrackingProfile> = {
  // 1. Robot 3D: Visor HUD + 7-Bar LED Mouth Strip + Head Pose (18 Puntos)
  three_robot: {
    avatarId: 'three_robot',
    name: 'Robot 3D (Mecha)',
    pointsCount: 18,
    badge: '18 Pts Mecha',
    description: 'Captura centrada en visor ocular, matriz LED bucal y orientación esquelética',
    color: '#06b6d4',
    dotColor: '#22d3ee',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    activeIndices: [
      // Pose orientation
      10, 1, 152, 234, 454,
      // Visor eye reticles & pupils
      33, 133, 362, 263, 468, 473,
      // 7-LED mouth strip
      61, 78, 13, 14, 308, 291, 17,
    ],
    contours: [
      { name: 'visor', indices: [33, 468, 133, 168, 362, 473, 263], color: '#22d3ee', width: 2.2 },
      { name: 'mouth_led', indices: [61, 78, 13, 308, 291], color: '#06b6d4', width: 2.4 },
      { name: 'lower_mouth', indices: [61, 14, 291], color: '#06b6d4', width: 1.6 },
    ],
    mesh3DPoints: [
      { name: 'visor_L', localPos: [-0.003, 0.005, 0.009], color: '#22d3ee' },
      { name: 'visor_C', localPos: [0, 0.005, 0.0095], color: '#22d3ee' },
      { name: 'visor_R', localPos: [0.003, 0.005, 0.009], color: '#22d3ee' },
      { name: 'antenna', localPos: [0, 0.016, 0.002], color: '#06b6d4' },
      { name: 'mouth_led', localPos: [0, -0.0098, 0.006], color: '#06b6d4' },
    ],
  },

  // 2. Gato 3D: Orejas felinas + Ojos rasgados + Bigotes / Hocico (26 Puntos)
  cat_3d: {
    avatarId: 'cat_3d',
    name: 'Gato 3D (Felino)',
    pointsCount: 26,
    badge: '26 Pts Felino',
    description: 'Captura de bases de orejas, ojos almendrados y comisuras de bigotes',
    color: '#f59e0b',
    dotColor: '#fbbf24',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    activeIndices: [
      // Cat ear peaks & bases (temples)
      67, 109, 103, 332, 297, 338,
      // Almond eyes & pupils
      33, 159, 145, 133, 362, 386, 374, 263, 468, 473,
      // Button nose
      1, 2, 98, 327,
      // Whiskers anchors & lips
      61, 291, 13, 14, 0, 17,
    ],
    contours: [
      { name: 'ear_L', indices: [67, 109, 103], color: '#f59e0b', width: 2.2 },
      { name: 'ear_R', indices: [297, 338, 332], color: '#f59e0b', width: 2.2 },
      { name: 'eye_L', indices: [33, 159, 133, 145, 33], isClosed: true, color: '#fbbf24', width: 1.8 },
      { name: 'eye_R', indices: [362, 386, 263, 374, 362], isClosed: true, color: '#fbbf24', width: 1.8 },
      { name: 'nose', indices: [98, 1, 327, 2, 98], isClosed: true, color: '#f43f5e', width: 1.8 },
      { name: 'lips', indices: [61, 13, 291, 14, 61], isClosed: true, color: '#f59e0b', width: 2.0 },
    ],
    mesh3DPoints: [
      { name: 'ear_tip_L', localPos: [-0.7, 0.85, -0.05], color: '#fbbf24' },
      { name: 'ear_tip_R', localPos: [0.7, 0.85, -0.05], color: '#fbbf24' },
      { name: 'cat_eye_L', localPos: [-0.42, 0.18, 0.9], color: '#10b981' },
      { name: 'cat_eye_R', localPos: [0.42, 0.18, 0.9], color: '#10b981' },
      { name: 'button_nose', localPos: [0, -0.08, 1.05], color: '#f43f5e' },
      { name: 'whiskers_L', localPos: [-0.55, -0.15, 0.85], color: '#fbbf24' },
      { name: 'whiskers_R', localPos: [0.55, -0.15, 0.85], color: '#fbbf24' },
      { name: 'feline_mouth', localPos: [0, -0.32, 0.95], color: '#f59e0b' },
    ],
  },

  // 3. Perro 3D: Orejas caídas + Hocico prominente + Mandíbula/Lengua (28 Puntos)
  dog_3d: {
    avatarId: 'dog_3d',
    name: 'Perro 3D (Canino)',
    pointsCount: 28,
    badge: '28 Pts Canino',
    description: 'Captura de orejas rebotantes, puente nasal canino y apertura de hocico',
    color: '#3b82f6',
    dotColor: '#60a5fa',
    glowColor: 'rgba(59, 130, 246, 0.4)',
    activeIndices: [
      // Ear bounce temples
      127, 234, 356, 454, 10,
      // Eyes & pupils
      33, 133, 362, 263, 468, 473,
      // Canine snout bridge
      168, 6, 197, 195, 5, 4, 1, 2, 98, 327,
      // Dog mouth & tongue
      61, 291, 13, 14, 87, 317, 17,
    ],
    contours: [
      { name: 'ears_top', indices: [127, 234, 10, 454, 356], color: '#3b82f6', width: 2.0 },
      { name: 'snout_bridge', indices: [168, 197, 5, 1], color: '#60a5fa', width: 2.4 },
      { name: 'snout_base', indices: [98, 1, 327, 2, 98], isClosed: true, color: '#1e3a8a', width: 2.0 },
      { name: 'dog_mouth', indices: [61, 13, 291, 317, 14, 87, 61], isClosed: true, color: '#f43f5e', width: 2.0 },
    ],
    mesh3DPoints: [
      { name: 'ear_drop_L', localPos: [-0.95, 0.35, 0.05], color: '#60a5fa' },
      { name: 'ear_drop_R', localPos: [0.95, 0.35, 0.05], color: '#60a5fa' },
      { name: 'dog_snout_tip', localPos: [0, -0.15, 1.25], color: '#1e3a8a' },
      { name: 'dog_jaw', localPos: [0, -0.45, 1.05], color: '#f43f5e' },
      { name: 'dog_eye_L', localPos: [-0.38, 0.22, 0.85], color: '#3b82f6' },
      { name: 'dog_eye_R', localPos: [0.38, 0.22, 0.85], color: '#3b82f6' },
    ],
  },

  // 4. Chica Anime 3D: Ojos grandes + Cejas estilizadas + Sonrisa (36 Puntos)
  female_3d: {
    avatarId: 'female_3d',
    name: 'Chica 3D (Anime)',
    pointsCount: 36,
    badge: '36 Pts Anime',
    description: 'Captura de ojos grandes hiper-expresivos, arqueo de cejas y labios sutiles',
    color: '#ec4899',
    dotColor: '#f472b6',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    activeIndices: [
      // Fine eyebrows
      70, 63, 105, 107, 300, 293, 334, 336,
      // Large eyes & pupils
      33, 7, 163, 144, 145, 153, 154, 133,
      362, 382, 381, 380, 374, 373, 390, 263,
      468, 473,
      // Tiny nose
      1, 2,
      // Delicate lips & smile corners
      61, 291, 78, 308, 13, 14, 0, 17, 82, 312,
    ],
    contours: [
      { name: 'brow_L', indices: [70, 63, 105, 107], color: '#ec4899', width: 2.0 },
      { name: 'brow_R', indices: [300, 293, 334, 336], color: '#ec4899', width: 2.0 },
      { name: 'eye_L', indices: [33, 163, 145, 133, 154, 7, 33], isClosed: true, color: '#f472b6', width: 2.0 },
      { name: 'eye_R', indices: [362, 381, 374, 263, 373, 382, 362], isClosed: true, color: '#f472b6', width: 2.0 },
      { name: 'lips', indices: [61, 82, 13, 312, 291, 14, 61], isClosed: true, color: '#fb7185', width: 2.0 },
    ],
    mesh3DPoints: [
      { name: 'anime_eye_L', localPos: [-0.36, 0.15, 0.88], color: '#f472b6' },
      { name: 'anime_eye_R', localPos: [0.36, 0.15, 0.88], color: '#f472b6' },
      { name: 'anime_chin', localPos: [0, -0.65, 0.75], color: '#ec4899' },
      { name: 'anime_mouth', localPos: [0, -0.35, 0.85], color: '#fb7185' },
    ],
  },

  // 5. Caballo 3D: Cresta de orejas + Puente nasal largo + Belfos (30 Puntos)
  horse_3d: {
    avatarId: 'horse_3d',
    name: 'Caballo 3D (Equino)',
    pointsCount: 30,
    badge: '30 Pts Equino',
    description: 'Captura de orejas alertas, puente craneal alargado y belfos',
    color: '#8b5cf6',
    dotColor: '#a78bfa',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    activeIndices: [
      10, 67, 109, 297, 338, // Ears
      33, 133, 362, 263, 468, 473, // Lateral eyes
      168, 6, 197, 195, 5, 4, 1, 2, // Elongated muzzle bridge
      98, 327, // Nostrils
      61, 291, 13, 14, 0, 17, 84, 314, // Muzzle lips
    ],
    contours: [
      { name: 'ears_crest', indices: [67, 109, 10, 338, 297], color: '#8b5cf6', width: 2.2 },
      { name: 'muzzle_bridge', indices: [10, 168, 6, 197, 195, 5, 4, 1], color: '#a78bfa', width: 2.4 },
      { name: 'nostrils', indices: [98, 1, 327, 2, 98], isClosed: true, color: '#c4b5fd', width: 1.8 },
      { name: 'muzzle_lips', indices: [61, 13, 291, 314, 14, 84, 61], isClosed: true, color: '#f43f5e', width: 2.0 },
      { name: 'eye_L', indices: [33, 133], color: '#8b5cf6', width: 1.8 },
      { name: 'eye_R', indices: [362, 263], color: '#8b5cf6', width: 1.8 },
    ],
    mesh3DPoints: [
      { name: 'horse_ear_L', localPos: [-0.45, 1.15, -0.1], color: '#a78bfa' },
      { name: 'horse_ear_R', localPos: [0.45, 1.15, -0.1], color: '#a78bfa' },
      { name: 'horse_snout_tip', localPos: [0, -0.65, 1.45], color: '#8b5cf6' },
      { name: 'horse_nostril_L', localPos: [-0.18, -0.62, 1.48], color: '#f43f5e' },
      { name: 'horse_nostril_R', localPos: [0.18, -0.62, 1.48], color: '#f43f5e' },
      { name: 'horse_eye_L', localPos: [-0.65, 0.35, 0.45], color: '#a78bfa' },
      { name: 'horse_eye_R', localPos: [0.65, 0.35, 0.45], color: '#a78bfa' },
      { name: 'horse_lips', localPos: [0, -0.80, 1.35], color: '#f43f5e' },
    ],
  },

  // 6. Zorro Místico Kitsune: Orejas puntiagudas + Ojos rasgados + Hocico afilado (28 Puntos)
  fox_sensei: {
    avatarId: 'fox_sensei',
    name: 'Zorro Kitsune',
    pointsCount: 28,
    badge: '28 Pts Kitsune',
    description: 'Captura de orejas místicas Kitsune, ojos rasgados y vértice agudo del hocico',
    color: '#ea580c',
    dotColor: '#fb923c',
    glowColor: 'rgba(234, 88, 12, 0.4)',
    activeIndices: [
      67, 109, 103, 332, 297, 338, 10, // Tall fox ears
      33, 160, 133, 362, 385, 263, 468, 473, // Sleek slanted eyes
      168, 197, 1, 2, 98, 327, // Sharp snout
      61, 291, 13, 14, 0, 17, 82, 312, // Fox mouth
    ],
    contours: [
      { name: 'ear_L', indices: [67, 109, 103, 67], isClosed: true, color: '#ea580c', width: 2.2 },
      { name: 'ear_R', indices: [297, 338, 332, 297], isClosed: true, color: '#ea580c', width: 2.2 },
      { name: 'snout_taper', indices: [168, 197, 1, 98, 327, 2, 1], color: '#fb923c', width: 2.2 },
      { name: 'slanted_eye_L', indices: [33, 160, 133, 33], isClosed: true, color: '#fed7aa', width: 1.8 },
      { name: 'slanted_eye_R', indices: [362, 385, 263, 362], isClosed: true, color: '#fed7aa', width: 1.8 },
      { name: 'lips', indices: [61, 13, 291, 14, 61], isClosed: true, color: '#ea580c', width: 2.0 },
    ],
    mesh3DPoints: [
      { name: 'fox_ear_L', localPos: [-0.65, 0.95, -0.05], color: '#fb923c' },
      { name: 'fox_ear_R', localPos: [0.65, 0.95, -0.05], color: '#fb923c' },
      { name: 'fox_snout', localPos: [0, -0.22, 1.25], color: '#ea580c' },
      { name: 'fox_mouth', localPos: [0, -0.38, 1.05], color: '#fb923c' },
    ],
  },

  // 7. Malla Wireframe Completa: Topología Facial Geométrica (68 Puntos)
  mesh_outline: {
    avatarId: 'mesh_outline',
    name: 'Mesh Facial 3D',
    pointsCount: 68,
    badge: '68 Pts Topología',
    description: 'Captura integral de curvas topológicas de referencia biométrica',
    color: '#10b981',
    dotColor: '#34d399',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    activeIndices: [
      // Oval contour (17 pts)
      10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
      152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
      // Brows (10 pts)
      70, 63, 105, 66, 107, 300, 293, 334, 296, 336,
      // Eyes & Pupils (14 pts)
      33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380, 468, 473,
      // Nose (9 pts)
      168, 6, 197, 195, 5, 4, 1, 98, 327,
      // Lips (18 pts)
      61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 14, 17, 13, 78, 308, 82, 312,
    ],
    contours: [
      { name: 'face_oval', indices: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10], isClosed: true, color: '#10b981', width: 1.8 },
      { name: 'brow_L', indices: [70, 63, 105, 66, 107], color: '#34d399', width: 2.0 },
      { name: 'brow_R', indices: [300, 293, 334, 296, 336], color: '#34d399', width: 2.0 },
      { name: 'eye_L', indices: [33, 160, 158, 133, 153, 144, 33], isClosed: true, color: '#34d399', width: 1.8 },
      { name: 'eye_R', indices: [362, 385, 387, 263, 373, 380, 362], isClosed: true, color: '#34d399', width: 1.8 },
      { name: 'nose_ridge', indices: [168, 6, 197, 195, 5, 4, 1], color: '#10b981', width: 2.0 },
      { name: 'lips_outer', indices: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 14, 17, 61], isClosed: true, color: '#f43f5e', width: 2.2 },
    ],
  },

  // 8. Cyber Nova: HUD Cibernético + Sensores Pómulos (32 Puntos)
  cyber_nova: {
    avatarId: 'cyber_nova',
    name: 'Cyber Nova',
    pointsCount: 32,
    badge: '32 Pts Cyber HUD',
    description: 'Captura de visor cibernético, sensores de pómulo y rejilla bucal synth',
    color: '#06b6d4',
    dotColor: '#67e8f9',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    activeIndices: [
      10, 152, 234, 454, // Corners
      33, 133, 362, 263, 468, 473, 168, // Visor brackets
      123, 352, 205, 425, // Cheek sensors
      1, 2, 98, 327, // Sensor nose
      61, 291, 78, 308, 13, 14, 82, 312, 17, 0, // Synth mouth grid
    ],
    contours: [
      { name: 'hud_visor', indices: [234, 33, 168, 263, 454], color: '#06b6d4', width: 2.2 },
      { name: 'cheek_brackets', indices: [123, 205, 425, 352], color: '#67e8f9', width: 1.8 },
      { name: 'mouth_grid', indices: [61, 78, 13, 308, 291, 312, 14, 82, 61], isClosed: true, color: '#06b6d4', width: 2.0 },
    ],
  },


  // 10. Pixel Punk: Gafas HUD Pixeladas + Comisuras Reticuladas (26 Puntos)
  pixel_punk: {
    avatarId: 'pixel_punk',
    name: 'Pixel Punk',
    pointsCount: 26,
    badge: '26 Pts 8-Bit',
    description: 'Captura con coordenadas ortogonales estilizadas tipo videojuego retro',
    color: '#8b5cf6',
    dotColor: '#c4b5fd',
    glowColor: 'rgba(139, 92, 246, 0.4)',
    activeIndices: [
      10, 152, 234, 454,
      33, 133, 362, 263, 468, 473, 168, 6,
      1, 2,
      61, 291, 13, 14, 78, 308, 17, 0,
    ],
    contours: [
      { name: 'pixel_glasses', indices: [234, 33, 133, 168, 362, 263, 454], color: '#8b5cf6', width: 2.4 },
      { name: 'mouth_block', indices: [61, 78, 13, 308, 291, 14, 61], isClosed: true, color: '#c4b5fd', width: 2.0 },
    ],
  },

  // 11. Bot 9000: Retro Mecha Visor + Display de Audio (20 Puntos)
  bot_9000: {
    avatarId: 'bot_9000',
    name: 'Bot 9000 (Retro Mecha)',
    pointsCount: 20,
    badge: '20 Pts Retro',
    description: 'Captura centrada en visor retroiluminado, display de audio y sensores laterales',
    color: '#10b981',
    dotColor: '#34d399',
    glowColor: 'rgba(16, 185, 129, 0.4)',
    activeIndices: [
      10, 152, 234, 454,
      33, 133, 362, 263, 468, 473,
      168, 1, 2,
      61, 291, 13, 14, 78, 308, 17,
    ],
    contours: [
      { name: 'retro_visor', indices: [234, 33, 133, 168, 362, 263, 454], color: '#10b981', width: 2.2 },
      { name: 'audio_display', indices: [61, 78, 13, 308, 291, 14, 61], isClosed: true, color: '#34d399', width: 2.0 },
    ],
    mesh3DPoints: [
      { name: 'screen_L', localPos: [-0.003, 0.005, 0.009], color: '#34d399' },
      { name: 'screen_R', localPos: [0.003, 0.005, 0.009], color: '#34d399' },
      { name: 'led_mouth', localPos: [0, -0.0098, 0.006], color: '#10b981' },
    ],
  },

  // 12. Astro Cadet: Casco Espacial + Telemetría HUD (24 Puntos)
  astro_cadet: {
    avatarId: 'astro_cadet',
    name: 'Astro Cadet (Casco)',
    pointsCount: 24,
    badge: '24 Pts Casco',
    description: 'Arco de visor esférico de astronauta y telemetría de comunicaciones',
    color: '#f59e0b',
    dotColor: '#fbbf24',
    glowColor: 'rgba(245, 158, 11, 0.4)',
    activeIndices: [
      10, 338, 297, 67, 109, 152, 234, 454,
      33, 133, 362, 263, 468, 473,
      168, 1, 2,
      61, 291, 13, 14, 0, 17,
    ],
    contours: [
      { name: 'helmet_arc', indices: [234, 67, 10, 297, 454], color: '#f59e0b', width: 2.4 },
      { name: 'visor_ring', indices: [33, 133, 362, 263, 33], isClosed: true, color: '#fbbf24', width: 2.0 },
      { name: 'comms_mic', indices: [61, 13, 291, 14, 61], isClosed: true, color: '#f59e0b', width: 1.8 },
    ],
    mesh3DPoints: [
      { name: 'helmet_top', localPos: [0, 0.95, 0], color: '#fbbf24' },
      { name: 'visor_L', localPos: [-0.4, 0.2, 0.85], color: '#f59e0b' },
      { name: 'visor_R', localPos: [0.4, 0.2, 0.85], color: '#f59e0b' },
      { name: 'mic_mouth', localPos: [0, -0.3, 0.9], color: '#fbbf24' },
    ],
  },

  // 11. Face Cap 3D: 52 Morph Targets ARKit Calibrados de Alta Precisión (52 Puntos)
  face_cap: {
    avatarId: 'face_cap',
    name: 'Face Cap 3D (ARKit)',
    pointsCount: 52,
    badge: '52 Pts ARKit',
    description: 'Inervación precisa de los 52 blendshapes faciales estándar de la industria (Boca, Ojos, Cejas, Mejillas)',
    color: '#0284c7',
    dotColor: '#38bdf8',
    glowColor: 'rgba(2, 132, 199, 0.4)',
    activeIndices: [
      // Cejas (10 pts: browInnerUp, browDown L/R, browOuterUp L/R)
      70, 63, 105, 66, 107, 300, 293, 334, 296, 336,
      // Ojos y Pupilas (16 pts: eyeBlink, eyeWide, eyeSquint, gaze look in/out/up/down)
      33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380, 468, 473, 159, 386,
      // Nariz y Sneer (6 pts: noseSneer L/R, puente y punta)
      168, 6, 197, 4, 98, 327,
      // Mejillas (4 pts: cheekPuff, cheekSquint L/R)
      205, 50, 425, 280,
      // Labios y Mandíbula (16 pts: jawOpen, mouthSmile, mouthFrown, mouthPucker, mouthDimple, mouthStretch)
      61, 291, 13, 14, 0, 17, 78, 308, 82, 87, 312, 317, 84, 314, 91, 321,
    ],
    contours: [
      { name: 'brow_L', indices: [70, 63, 105, 66, 107], color: '#818cf8', width: 2.0 },
      { name: 'brow_R', indices: [300, 293, 334, 296, 336], color: '#818cf8', width: 2.0 },
      { name: 'eye_L', indices: [33, 160, 158, 133, 153, 144, 33], isClosed: true, color: '#38bdf8', width: 1.8 },
      { name: 'eye_R', indices: [362, 385, 387, 263, 373, 380, 362], isClosed: true, color: '#38bdf8', width: 1.8 },
      { name: 'nose_sneer', indices: [168, 6, 197, 4, 98, 327], color: '#60a5fa', width: 1.8 },
      { name: 'cheeks', indices: [50, 205, 4, 425, 280], color: '#818cf8', width: 1.6 },
      { name: 'lips_outer', indices: [61, 82, 0, 312, 291, 317, 17, 87, 61], isClosed: true, color: '#38bdf8', width: 2.2 },
      { name: 'lips_inner', indices: [78, 82, 13, 312, 308, 314, 14, 84, 78], isClosed: true, color: '#0284c7', width: 1.6 },
      { name: 'jawline', indices: [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454], color: '#60a5fa', width: 1.4 },
    ],
  },

  // 12. Trump 3D: Escultura Presidencial (32 Puntos)
  trump_3d: {
    avatarId: 'trump_3d',
    name: 'Trump 3D (Busto)',
    pointsCount: 32,
    badge: '32 Pts Busto',
    description: 'Orientación de cabeza y gesticulación facial para escultura 3D',
    color: '#e11d48',
    dotColor: '#f59e0b',
    glowColor: 'rgba(225, 29, 72, 0.4)',
    activeIndices: [
      10, 1, 152, 234, 454,
      33, 133, 362, 263, 468, 473,
      70, 105, 300, 334,
      168, 197, 2,
      61, 291, 13, 14, 0, 17, 78, 308, 82, 312, 87, 317,
    ],
    contours: [
      { name: 'brows', indices: [70, 105, 300, 334], color: '#f59e0b', width: 2.0 },
      { name: 'eyes', indices: [33, 133, 168, 362, 263], color: '#e11d48', width: 2.0 },
      { name: 'lips', indices: [61, 82, 13, 312, 291, 317, 14, 87, 61], isClosed: true, color: '#f59e0b', width: 2.2 },
    ],
  },

  // 13. Putin 3D: Escultura Fotorealista (32 Puntos)
  putin_3d: {
    avatarId: 'putin_3d',
    name: 'Putin 3D (Busto)',
    pointsCount: 32,
    badge: '32 Pts Busto',
    description: 'Seguimiento de pose y rotación de busto 3D con textura original',
    color: '#2563eb',
    dotColor: '#38bdf8',
    glowColor: 'rgba(37, 99, 235, 0.4)',
    activeIndices: [
      10, 1, 152, 234, 454,
      33, 133, 362, 263, 468, 473,
      70, 105, 300, 334,
      168, 197, 2,
      61, 291, 13, 14, 0, 17, 78, 308, 82, 312, 87, 317,
    ],
    contours: [
      { name: 'brows', indices: [70, 105, 300, 334], color: '#38bdf8', width: 2.0 },
      { name: 'eyes', indices: [33, 133, 168, 362, 263], color: '#2563eb', width: 2.0 },
      { name: 'lips', indices: [61, 82, 13, 312, 291, 317, 14, 87, 61], isClosed: true, color: '#38bdf8', width: 2.2 },
    ],
  },

  // 14. Xi Jinping 3D: Escultura Ceremonial (32 Puntos)
  jinping_3d: {
    avatarId: 'jinping_3d',
    name: 'Xi Jinping 3D (Busto)',
    pointsCount: 32,
    badge: '32 Pts Busto',
    description: 'Seguimiento de orientación y rotación tridimensional en mármol',
    color: '#dc2626',
    dotColor: '#fbbf24',
    glowColor: 'rgba(220, 38, 38, 0.4)',
    activeIndices: [
      10, 1, 152, 234, 454,
      33, 133, 362, 263, 468, 473,
      70, 105, 300, 334,
      168, 197, 2,
      61, 291, 13, 14, 0, 17, 78, 308, 82, 312, 87, 317,
    ],
    contours: [
      { name: 'brows', indices: [70, 105, 300, 334], color: '#fbbf24', width: 2.0 },
      { name: 'eyes', indices: [33, 133, 168, 362, 263], color: '#dc2626', width: 2.0 },
      { name: 'lips', indices: [61, 82, 13, 312, 291, 317, 14, 87, 61], isClosed: true, color: '#fbbf24', width: 2.2 },
    ],
  },

  // 15. Bush 3D: Escultura Presidencial (32 Puntos)
  bush_3d: {
    avatarId: 'bush_3d',
    name: 'Bush 3D (Busto)',
    pointsCount: 32,
    badge: '32 Pts Busto',
    description: 'Seguimiento de orientación y rotación en vivo de busto clásico',
    color: '#1d4ed8',
    dotColor: '#60a5fa',
    glowColor: 'rgba(29, 78, 216, 0.4)',
    activeIndices: [
      10, 1, 152, 234, 454,
      33, 133, 362, 263, 468, 473,
      70, 105, 300, 334,
      168, 197, 2,
      61, 291, 13, 14, 0, 17, 78, 308, 82, 312, 87, 317,
    ],
    contours: [
      { name: 'brows', indices: [70, 105, 300, 334], color: '#60a5fa', width: 2.0 },
      { name: 'eyes', indices: [33, 133, 168, 362, 263], color: '#1d4ed8', width: 2.0 },
      { name: 'lips', indices: [61, 82, 13, 312, 291, 317, 14, 87, 61], isClosed: true, color: '#60a5fa', width: 2.2 },
    ],
  },

  // 16. Thatcher 3D: Escultura Histórica (32 Puntos)
  thatcher_3d: {
    avatarId: 'thatcher_3d',
    name: 'Thatcher 3D (Busto)',
    pointsCount: 32,
    badge: '32 Pts Busto',
    description: 'Seguimiento tridimensional de busto histórico con textura',
    color: '#7c3aed',
    dotColor: '#c084fc',
    glowColor: 'rgba(124, 58, 237, 0.4)',
    activeIndices: [
      10, 1, 152, 234, 454,
      33, 133, 362, 263, 468, 473,
      70, 105, 300, 334,
      168, 197, 2,
      61, 291, 13, 14, 0, 17, 78, 308, 82, 312, 87, 317,
    ],
    contours: [
      { name: 'brows', indices: [70, 105, 300, 334], color: '#c084fc', width: 2.0 },
      { name: 'eyes', indices: [33, 133, 168, 362, 263], color: '#7c3aed', width: 2.0 },
      { name: 'lips', indices: [61, 82, 13, 312, 291, 317, 14, 87, 61], isClosed: true, color: '#c084fc', width: 2.2 },
    ],
  },
};

/**
 * Anatomical Transformation Engine
 * Morphs 2D/3D human MediaPipe landmarks into the physical anatomy of the target avatar
 * (e.g. horse elongated muzzle & tall ears, cat upright ears & slanted eyes, dog floppy ears & snout,
 * robot cyber-visor & LED equalizer bar, anime giant eyes & sharp V-chin).
 */
export function transformAvatarLandmark(
  profile: AvatarTrackingProfile,
  idx: number,
  pt: { x: number; y: number; z?: number },
  landmarks: Array<{ x: number; y: number; z?: number }>
): { x: number; y: number; z?: number } {
  if (!landmarks || landmarks.length < 400) return pt;

  const nose = landmarks[1];
  const topHead = landmarks[10];
  const chin = landmarks[152];
  const leftEdge = landmarks[234];
  const rightEdge = landmarks[454];

  if (!nose || !topHead || !chin) return pt;

  const cx = nose.x;
  const cy = nose.y;
  const faceW = Math.max(0.15, Math.abs((rightEdge?.x || 0.7) - (leftEdge?.x || 0.3)));
  const faceH = Math.max(0.15, Math.abs(chin.y - topHead.y));

  let x = pt.x;
  let y = pt.y;
  const z = pt.z || 0;

  const dx = x - cx;

  const earIndices = [67, 109, 103, 332, 297, 338, 54, 284, 21, 251, 10, 127, 356];
  const snoutIndices = [1, 2, 98, 327, 168, 6, 197, 195, 5, 4];
  const lipIndices = [61, 291, 13, 14, 0, 17, 78, 308, 82, 312, 87, 317, 84, 314, 91, 321, 185, 40, 39, 37, 267, 269, 270, 409, 375, 405, 181, 146];
  const eyeLIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 468];
  const eyeRIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 473];

  switch (profile.avatarId) {
    // ----------------------------------------------------
    // CABALLO (Equine): Hocico largo + Orejas altas y juntas + Ojos laterales
    // ----------------------------------------------------
    case 'horse_3d': {
      if (earIndices.includes(idx)) {
        // Orejas equinas altas y convergentes en la cresta superior
        y = topHead.y - faceH * 0.38 + (y - topHead.y) * 0.45;
        x = cx + dx * 0.65;
      } else if (lipIndices.includes(idx)) {
        // Belfos y boca estirada hacia abajo en el hocico largo
        y = cy + faceH * 0.32 + (y - cy) * 1.35;
        x = cx + dx * 0.70;
      } else if (snoutIndices.includes(idx)) {
        // Puente nasal y ollares alargados hacia el hocico
        y = cy + faceH * 0.18 + (y - cy) * 1.30;
        x = cx + dx * 0.68;
      } else if (eyeLIndices.includes(idx) || eyeRIndices.includes(idx)) {
        // Ojos laterales en los flancos de la cabeza
        x = cx + dx * 1.35;
        y = y - faceH * 0.04;
      } else if (idx === 152) {
        // Mandíbula inferior alargada del caballo
        y = chin.y + faceH * 0.28;
      }
      break;
    }

    // ----------------------------------------------------
    // GATO 3D (Feline): Orejas puntiagudas + Ojos rasgados + Bigotes
    // ----------------------------------------------------
    case 'cat_3d': {
      if (earIndices.includes(idx)) {
        // Orejas felinas puntiagudas que sobresalen arriba a los lados
        y = topHead.y - faceH * 0.28 + (y - topHead.y) * 0.5;
        x = cx + dx * 1.55;
      } else if (eyeLIndices.includes(idx)) {
        // Ojo izquierdo rasgado hacia arriba en la esquina exterior
        const isOuter = [33, 7, 246, 161, 160].includes(idx);
        if (isOuter) y -= faceH * 0.035;
        x = cx + dx * 1.15;
      } else if (eyeRIndices.includes(idx)) {
        // Ojo derecho rasgado
        const isOuter = [263, 466, 388, 387, 398].includes(idx);
        if (isOuter) y -= faceH * 0.035;
        x = cx + dx * 1.15;
      } else if (snoutIndices.includes(idx)) {
        // Nariz chata compacta de gato
        y = cy - faceH * 0.03 + (y - cy) * 0.75;
        x = cx + dx * 0.85;
      } else if (lipIndices.includes(idx)) {
        // Boquita felina compacta
        y = cy + faceH * 0.12 + (y - cy) * 0.75;
        x = cx + dx * 0.75;
      } else if ([93, 234, 454, 323, 58, 288].includes(idx)) {
        // Almohadillas de bigotes hacia afuera
        x = cx + dx * 1.38;
      }
      break;
    }

    // ----------------------------------------------------
    // PERRO (Canine): Orejas caídas + Hocico prominente + Mandíbula
    // ----------------------------------------------------
    case 'dog_3d': {
      if (earIndices.includes(idx)) {
        // Orejas caídas laterales
        y = y + faceH * 0.16;
        x = cx + dx * 1.30;
      } else if (snoutIndices.includes(idx)) {
        // Hocico canino ancho y proyectado hacia adelante
        y = cy + faceH * 0.09 + (y - cy) * 1.22;
        x = cx + dx * 1.25;
      } else if (lipIndices.includes(idx) || idx === 152) {
        // Mandíbula canina que cae
        y = y + faceH * 0.08;
        x = cx + dx * 1.10;
      }
      break;
    }

    // ----------------------------------------------------
    // ROBOT 3D (Mecha): Visor ocular rectilíneo + Barra LED bucal
    // ----------------------------------------------------
    case 'three_robot': {
      if (eyeLIndices.includes(idx) || eyeRIndices.includes(idx) || idx === 168) {
        // Alineación en barra de visor horizontal
        const visorY = cy - faceH * 0.17;
        y = visorY + (y - visorY) * 0.25;
        x = cx + dx * 0.95;
      } else if (lipIndices.includes(idx)) {
        // Barra ecualizadora LED horizontal
        const mouthBarY = cy + faceH * 0.24;
        y = mouthBarY;
        const colIndex = (dx / (faceW * 0.45));
        x = cx + Math.round(colIndex * 3) * (faceW * 0.075);
      } else if (idx === 10) {
        // Antena superior
        y = topHead.y - faceH * 0.22;
      } else if ([234, 454].includes(idx)) {
        // Auriculares mecha rectangulares
        x = cx + (dx > 0 ? faceW * 0.65 : -faceW * 0.65);
      }
      break;
    }

    // ----------------------------------------------------
    // CHICA ANIME (Female 3D): Ojos gigantes + Mentón en V + Nariz diminuta
    // ----------------------------------------------------
    case 'female_3d': {
      if (eyeLIndices.includes(idx) || eyeRIndices.includes(idx)) {
        // Ojos anime grandes (escalados 1.45x)
        const eyeCenterY = cy - faceH * 0.16;
        y = eyeCenterY + (y - eyeCenterY) * 1.45;
        x = cx + dx * 1.25;
      } else if (snoutIndices.includes(idx)) {
        // Nariz diminuta kawaii
        y = cy - faceH * 0.03;
        x = cx + dx * 0.45;
      } else if (lipIndices.includes(idx)) {
        // Labios anime pequeños
        y = cy + faceH * 0.18 + (y - cy) * 0.7;
        x = cx + dx * 0.65;
      } else if ([152, 172, 397, 148, 377].includes(idx)) {
        // Mentón en V afilado
        x = cx + dx * 0.55;
      }
      break;
    }

    // ----------------------------------------------------
    // ZORRO KITSUNE (Fox Sensei): Orejas largas + Hocico puntiagudo
    // ----------------------------------------------------
    case 'fox_sensei': {
      if (earIndices.includes(idx)) {
        y = topHead.y - faceH * 0.32 + (y - topHead.y) * 0.45;
        x = cx + dx * 1.40;
      } else if (snoutIndices.includes(idx) || lipIndices.includes(idx)) {
        y = cy + faceH * 0.14 + (y - cy) * 1.15;
        x = cx + dx * 0.60;
      } else if (eyeLIndices.includes(idx) || eyeRIndices.includes(idx)) {
        x = cx + dx * 1.25;
        y = y - faceH * 0.03;
      }
      break;
    }

    // ----------------------------------------------------
    // CYBER NOVA & PIXEL PUNK: HUD Cibernético angular
    // ----------------------------------------------------
    case 'cyber_nova':
    case 'pixel_punk': {
      if (eyeLIndices.includes(idx) || eyeRIndices.includes(idx)) {
        x = cx + Math.round(dx / 0.02) * 0.02;
        y = cy + Math.round((y - cy) / 0.02) * 0.02;
      }
      break;
    }

    // ----------------------------------------------------
    // FACE CAP 3D (ARKit 52 morph topology)
    // ----------------------------------------------------
    case 'face_cap':
    case 'mesh_outline':
    default: {
      break;
    }
  }

  return { x, y, z };
}

/**
 * Gets or dynamically generates a tracking profile for any current or future avatar
 */
export function getAvatarTrackingProfile(avatarId?: AvatarId): AvatarTrackingProfile {
  if (avatarId && AVATAR_TRACKING_PROFILES[avatarId]) {
    return AVATAR_TRACKING_PROFILES[avatarId];
  }

  // Dynamic extensible fallback for any new avatar added in the future
  return {
    avatarId: avatarId || 'three_robot',
    name: 'Avatar 3D',
    pointsCount: 30,
    badge: '30 Pts Dinámicos',
    description: 'Perfil de tracking facial anatómico optimizado para nuevo modelo 3D',
    color: '#06b6d4',
    dotColor: '#22d3ee',
    glowColor: 'rgba(6, 182, 212, 0.4)',
    activeIndices: [
      10, 1, 152, 234, 454, // Pose
      33, 133, 362, 263, 468, 473, // Eyes
      70, 105, 300, 334, // Brows
      168, 197, // Nose
      61, 291, 13, 14, 0, 17, 78, 308, 82, 312, // Lips
    ],
    contours: [
      { name: 'eyes', indices: [33, 133, 168, 362, 263], color: '#06b6d4', width: 2.0 },
      { name: 'lips', indices: [61, 13, 291, 14, 61], isClosed: true, color: '#22d3ee', width: 2.0 },
    ],
  };
}
