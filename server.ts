import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface User {
  id: string;
  name: string;
  avatarId: string;
  role: 'admin' | 'participant';
  roomId: string;
  isMuted: boolean;
  isCameraActive: boolean;
}

interface Room {
  id: string;
  name: string;
  adminId: string;
  isLocked: boolean;
  users: Map<string, User>;
  createdAt: number;
  mediaState?: any;
}

const rooms = new Map<string, Room>();

const DEFAULT_INITIAL_YOUTUBE_VIDEO = {
  id: 'v_init_dead_president',
  url: 'https://www.youtube.com/watch?v=SGvxjfK1t9A',
  videoId: 'SGvxjfK1t9A',
  title: 'Nas - Dead president',
  thumbnailUrl: 'https://i.ytimg.com/vi/SGvxjfK1t9A/hqdefault.jpg',
  durationSec: 284,
  addedByUserId: 'system',
  addedByUserName: 'XStreamX',
  addedAt: 1700000000000,
};

function createInitialMediaState() {
  return {
    currentVideo: DEFAULT_INITIAL_YOUTUBE_VIDEO,
    queue: [DEFAULT_INITIAL_YOUTUBE_VIDEO],
    isPlaying: false,
    playbackTime: 0,
    lastSyncTimestamp: Date.now(),
    syncedByUserId: 'system',
  };
}

// Helper to determine the single active admin in a room
function getRoomActiveAdmin(room: Room, io?: Server): { user: User; socketId: string } | undefined {
  for (const [sId, u] of room.users.entries()) {
    if (u.role === 'admin') {
      if (io) {
        const sock = io.sockets.sockets.get(sId);
        if (sock && sock.connected) {
          return { user: u, socketId: sId };
        }
      } else {
        return { user: u, socketId: sId };
      }
    }
  }
  return undefined;
}

// Ensure default main single room is always active and open
rooms.set('main', {
  id: 'main',
  name: 'Espacio Principal en Vivo',
  adminId: 'admin',
  isLocked: false,
  users: new Map(),
  createdAt: Date.now(),
});

// Cache en memoria para paquetes de modelos 3D personalizados (distribución instantánea sin cuellos de botella)
const avatarModelCache = new Map<string, any>();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 50 * 1024 * 1024, // 50MB for 3D model synchronization
  });

  const PORT = Number(process.env.PORT) || 3000;

  // Broadcast real-time room status to all clients
  function broadcastRoomStatus(room: Room) {
    const activeAdmin = getRoomActiveAdmin(room, io);
    io.emit('room_status_changed', {
      isOpen: true,
      hasActiveAdmin: !!activeAdmin,
      activeAdminName: activeAdmin ? activeAdmin.user.name : null,
      activeAdminId: activeAdmin ? activeAdmin.user.id : null,
      room: {
        id: room.id,
        name: room.name,
        adminId: activeAdmin ? activeAdmin.user.id : room.adminId,
        isLocked: room.isLocked,
        userCount: room.users.size,
        hasActiveAdmin: !!activeAdmin,
        activeAdminName: activeAdmin ? activeAdmin.user.name : null,
      },
    });
  }

  app.use(express.json());

  // Serve public static assets (favicon.svg, models, wasm, etc.)
  app.use(express.static(path.resolve(__dirname, 'public')));
  app.use('/wasm', express.static(path.resolve(__dirname, 'public/wasm')));
  app.use('/3dchat', express.static(path.resolve(__dirname, 'public')));
  app.use('/3dchat/wasm', express.static(path.resolve(__dirname, 'public/wasm')));

  // Static 3D model assets
  app.use('/models', express.static(path.resolve(__dirname, 'public/models')));
  app.use('/models', express.static(path.resolve(__dirname, 'models')));
  app.use('/3dchat/models', express.static(path.resolve(__dirname, 'public/models')));
  app.use('/3dchat/models', express.static(path.resolve(__dirname, 'models')));

  // Explicit favicon handler to prevent 404s on /favicon.ico and /favicon.svg
  app.get(['/favicon.ico', '/favicon.svg', '/3dchat/favicon.ico', '/3dchat/favicon.svg'], (req, res) => {
    const isIco = req.path.endsWith('.ico');
    const filePath = isIco
      ? path.resolve(__dirname, 'public/favicon.ico')
      : path.resolve(__dirname, 'public/favicon.svg');
    if (fs.existsSync(filePath)) {
      res.type(isIco ? 'image/x-icon' : 'image/svg+xml').sendFile(filePath);
    } else {
      res.status(204).end();
    }
  });

  // --- TELEMETRY & PRODUCTION ERROR LOGGING SYSTEM (AI-CONSUMABLE) ---
  const logsDir = path.resolve(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const jsonlLogPath = path.join(logsDir, 'production_errors.jsonl');
  const aiDigestPath = path.join(logsDir, 'ai_error_digest.md');

  // In-memory ring buffer (last 200 production error events)
  const serverErrorTelemetry: any[] = [];

  // Restore recent logs from disk on startup if available
  try {
    if (fs.existsSync(jsonlLogPath)) {
      const lines = fs.readFileSync(jsonlLogPath, 'utf-8').trim().split('\n').filter(Boolean);
      for (const line of lines.slice(-100)) {
        try {
          serverErrorTelemetry.unshift(JSON.parse(line));
        } catch (_) {}
      }
    }
  } catch (_) {}

  function generateAiDigestMarkdown(logs: any[]): string {
    const now = new Date().toISOString();
    const total = logs.length;
    const categories: Record<string, number> = {};
    const severities: Record<string, number> = {};

    logs.forEach((l) => {
      const cat = l.category || 'general';
      const sev = l.severity || 'error';
      categories[cat] = (categories[cat] || 0) + (l.count || 1);
      severities[sev] = (severities[sev] || 0) + (l.count || 1);
    });

    let md = `# Reporte Unificado de Errores en Producción (XStreamX AI Diagnostic Digest)\n\n`;
    md += `> **Generado:** ${now}  \n`;
    md += `> **Total de Incidentes:** ${total} eventos  \n`;
    md += `> **Estado Global:** ${total === 0 ? '🟢 Normal / Sin Fallos' : severities['fatal'] ? '🔴 Crítico' : '🟡 Alertas Activas'}  \n\n`;

    md += `## 1. Desglose por Componente\n\n`;
    md += `| Módulo | Eventos | Severidad Predominante |\n`;
    md += `| :--- | :--- | :--- |\n`;
    for (const [cat, count] of Object.entries(categories)) {
      md += `| **${cat.toUpperCase()}** | ${count} | \`${logs.find((l) => l.category === cat)?.severity || 'error'}\` |\n`;
    }

    md += `\n---\n\n## 2. Clúster de Errores Recientes (Para Inspección de la IA)\n\n`;
    if (logs.length === 0) {
      md += `*No hay errores registrados en producción actualmente.*\n`;
    } else {
      logs.slice(0, 25).forEach((err, i) => {
        md += `### [${i + 1}] [${(err.severity || 'ERROR').toUpperCase()}] [${(err.category || 'GENERAL').toUpperCase()}] ${String(err.message || '').slice(0, 140)}\n\n`;
        md += `* **Ocurrencias:** ${err.count || 1}  \n`;
        md += `* **Marca de Tiempo:** ${err.isoTime || new Date(err.timestamp || Date.now()).toISOString()}  \n`;
        if (err.route) md += `* **Ruta/Página:** \`${err.route}${err.hash || ''}\`  \n`;
        if (err.context?.userName) md += `* **Usuario / Rol:** \`${err.context.userName} (${err.context.userRole || 'user'})\` en sala \`${err.context.roomId || 'main'}\`  \n`;
        if (err.context?.avatarId) md += `* **Avatar / Modo:** \`${err.context.avatarId}\` | \`${err.context.trackingMode || 'auto'}\`  \n`;
        if (err.context?.deviceInfo) md += `* **Dispositivo / GPU:** \`${err.context.deviceInfo.platform} | ${err.context.deviceInfo.gpuRenderer || 'N/A'}\`  \n`;
        if (err.sourceFile) md += `* **Ubicación:** \`${err.sourceFile}:${err.lineNumber || 0}\`  \n`;
        if (err.stack) md += `\n**Stack Trace:**\n\`\`\`text\n${String(err.stack).slice(0, 700)}\n\`\`\`\n`;
        if (err.breadcrumbs?.length) {
          md += `\n**Acciones Previas (Breadcrumbs):**\n`;
          err.breadcrumbs.slice(-4).forEach((b: any) => {
            md += `- \`[${new Date(b.timestamp).toLocaleTimeString()}] [${b.category}]\` ${b.message}\n`;
          });
        }
        md += `\n`;
      });
    }

    md += `---\n\n## 3. Guía de Diagnóstico Rápido para la IA\n\n`;
    md += `- **WebGL / Three.js:** Comprobar si hubo 'context lost', modelos con buffers ausentes o fallos de shader.\n`;
    md += `- **MediaPipe / WASM:** Comprobar si 'face_landmarker.task' o binarios WASM arrojaron 404 o timeout de red.\n`;
    md += `- **WebRTC / Red:** Comprobar si PeerJS o los brokers MQTT fallaron en handshake o paquetes excedieron cuotas.\n`;

    return md;
  }

  function recordServerTelemetry(entry: any) {
    serverErrorTelemetry.unshift(entry);
    if (serverErrorTelemetry.length > 200) {
      serverErrorTelemetry.pop();
    }
    try {
      fs.appendFileSync(jsonlLogPath, JSON.stringify(entry) + '\n', 'utf-8');
      fs.writeFileSync(aiDigestPath, generateAiDigestMarkdown(serverErrorTelemetry), 'utf-8');
    } catch (_) {}
  }

  // Generate initial digest file if not exists
  try {
    if (!fs.existsSync(aiDigestPath)) {
      fs.writeFileSync(aiDigestPath, generateAiDigestMarkdown(serverErrorTelemetry), 'utf-8');
    }
  } catch (_) {}

  // Server-side global exception logging
  process.on('uncaughtException', (err) => {
    console.error('[Server UncaughtException]', err);
    recordServerTelemetry({
      id: `srv_err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      severity: 'fatal',
      category: 'server',
      message: err?.message || 'Server Uncaught Exception',
      stack: err?.stack,
      count: 1,
      route: 'server.ts',
    });
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error('[Server UnhandledRejection]', reason);
    recordServerTelemetry({
      id: `srv_rej_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      severity: 'error',
      category: 'server',
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      count: 1,
      route: 'server.ts',
    });
  });

  // Ingest client errors telemetry batch
  app.post('/api/logs/telemetry', (req, res) => {
    try {
      const { errors } = req.body || {};
      if (Array.isArray(errors)) {
        for (const err of errors) {
          recordServerTelemetry(err);
        }
      }
      res.json({ ok: true, received: Array.isArray(errors) ? errors.length : 0 });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Failed to ingest telemetry' });
    }
  });

  // AI Summary endpoint: returns structured AI report
  app.get('/api/logs/ai-summary', (req, res) => {
    const format = req.query.format;
    if (format === 'json') {
      res.json({
        totalErrors: serverErrorTelemetry.length,
        errors: serverErrorTelemetry.slice(0, 50),
      });
      return;
    }
    if (fs.existsSync(aiDigestPath)) {
      res.type('text/markdown; charset=utf-8').sendFile(aiDigestPath);
    } else {
      res.type('text/markdown; charset=utf-8').send(generateAiDigestMarkdown(serverErrorTelemetry));
    }
  });

  // Raw logs endpoint
  app.get('/api/logs/raw', (req, res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const severity = req.query.severity as string | undefined;
    const category = req.query.category as string | undefined;

    let filtered = serverErrorTelemetry;
    if (severity) filtered = filtered.filter((l) => l.severity === severity);
    if (category) filtered = filtered.filter((l) => l.category === category);

    res.json({
      total: serverErrorTelemetry.length,
      returned: Math.min(filtered.length, limit),
      logs: filtered.slice(0, limit),
    });
  });

  // Clear logs endpoint
  app.post('/api/logs/clear', (req, res) => {
    serverErrorTelemetry.length = 0;
    try {
      if (fs.existsSync(jsonlLogPath)) fs.writeFileSync(jsonlLogPath, '', 'utf-8');
      fs.writeFileSync(aiDigestPath, generateAiDigestMarkdown([]), 'utf-8');
    } catch (_) {}
    res.json({ ok: true, cleared: true });
  });

  // API endpoints
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeRooms: rooms.size,
      errorCount: serverErrorTelemetry.length,
      timestamp: Date.now(),
    });
  });

  app.get('/api/rooms', (req, res) => {
    const publicRooms = Array.from(rooms.values()).map(r => {
      const activeAdmin = getRoomActiveAdmin(r, io);
      return {
        id: r.id,
        name: r.name,
        adminId: activeAdmin ? activeAdmin.user.id : r.adminId,
        userCount: r.users.size,
        isLocked: r.isLocked,
        hasActiveAdmin: !!activeAdmin,
        activeAdminName: activeAdmin ? activeAdmin.user.name : null,
      };
    });
    res.json({ rooms: publicRooms });
  });

  app.get('/api/room/status', (req, res) => {
    const mainRoom = rooms.get('main') || Array.from(rooms.values())[0];
    const activeAdmin = mainRoom ? getRoomActiveAdmin(mainRoom, io) : undefined;
    res.json({
      isOpen: !!mainRoom,
      hasActiveAdmin: !!activeAdmin,
      activeAdminName: activeAdmin ? activeAdmin.user.name : null,
      activeAdminId: activeAdmin ? activeAdmin.user.id : null,
      room: mainRoom
        ? {
            id: mainRoom.id,
            name: mainRoom.name,
            adminId: activeAdmin ? activeAdmin.user.id : mainRoom.adminId,
            isLocked: mainRoom.isLocked,
            userCount: mainRoom.users.size,
            hasActiveAdmin: !!activeAdmin,
            activeAdminName: activeAdmin ? activeAdmin.user.name : null,
          }
        : null,
    });
  });

  // Socket.IO Room & Coordinate Streaming Logic
  io.on('connection', (socket: Socket) => {
    let currentUser: User | null = null;

    // Check single room status
    socket.on('check_room_status', (callback) => {
      const mainRoom = rooms.get('main') || Array.from(rooms.values())[0];
      const activeAdmin = mainRoom ? getRoomActiveAdmin(mainRoom, io) : undefined;
      if (callback) {
        callback({
          isOpen: !!mainRoom,
          hasActiveAdmin: !!activeAdmin,
          activeAdminName: activeAdmin ? activeAdmin.user.name : null,
          activeAdminId: activeAdmin ? activeAdmin.user.id : null,
          room: mainRoom
            ? {
                id: mainRoom.id,
                name: mainRoom.name,
                adminId: activeAdmin ? activeAdmin.user.id : mainRoom.adminId,
                isLocked: mainRoom.isLocked,
                userCount: mainRoom.users.size,
                hasActiveAdmin: !!activeAdmin,
                activeAdminName: activeAdmin ? activeAdmin.user.name : null,
              }
            : null,
        });
      }
    });

    // Admin creates room
    socket.on('admin_create_room', ({ roomId, name }, callback) => {
      const cleanId = (roomId || 'main').trim().toLowerCase();
      let room = rooms.get(cleanId);
      if (room) {
        const activeAdmin = getRoomActiveAdmin(room, io);
        if (activeAdmin && activeAdmin.socketId !== socket.id) {
          if (callback) {
            callback({
              success: false,
              error: `Ya hay un Administrador activo en la sala (${activeAdmin.user.name}). No puede haber más de un Administrador al mismo tiempo.`,
            });
          }
          return;
        }
      }
      if (!room) {
        room = {
          id: cleanId,
          name: name || 'Sala Principal en Vivo',
          adminId: socket.id,
          isLocked: false,
          users: new Map(),
          createdAt: Date.now(),
          mediaState: createInitialMediaState(),
        };
        rooms.set(cleanId, room);
      }
      broadcastRoomStatus(room);
      if (callback) callback({ success: true, room });
    });

    // Join room
    socket.on('join_room', ({ roomId, userId, userName, avatarId, createAsAdmin }, callback) => {
      const trimmedRoomId = (roomId || 'main').trim().toLowerCase();
      let room = rooms.get(trimmedRoomId);

      const isAdminRequested = createAsAdmin === true;

      // If no room created yet and caller is not an admin
      if (!room && !isAdminRequested) {
        if (callback) {
          callback({
            error: 'No hay ninguna sala creada en este momento. Espera a que un administrador inicie la sala.',
          });
        }
        return;
      }

      if (room?.isLocked && (!room.users.has(socket.id) && !isAdminRequested)) {
        if (callback) callback({ error: 'La sala está bloqueada por el administrador.' });
        return;
      }

      if (!room) {
        room = {
          id: trimmedRoomId,
          name: 'Sala Principal en Vivo',
          adminId: socket.id,
          isLocked: false,
          users: new Map(),
          createdAt: Date.now(),
          mediaState: createInitialMediaState(),
        };
        rooms.set(trimmedRoomId, room);
      }

      const finalUserId = (userId && typeof userId === 'string') ? userId.trim() : socket.id;
      const cleanName = (userName || `Usuario_${finalUserId.slice(0, 4)}`).trim();

      // STRICT VALIDATION: Exactly one Admin can be active at the same time in the room
      if (isAdminRequested) {
        const activeAdmin = getRoomActiveAdmin(room, io);
        if (activeAdmin && activeAdmin.socketId !== socket.id) {
          const isSameUserReconnecting = activeAdmin.user.id === finalUserId;
          if (!isSameUserReconnecting) {
            console.warn(
              `[XStreamX] Intento de acceso admin rechazado para "${cleanName}": ya existe el admin "${activeAdmin.user.name}" (${activeAdmin.socketId}) en ${trimmedRoomId}`
            );
            const errMsg = `Ya hay un Administrador activo en la sala (${activeAdmin.user.name}). No puede haber más de un Administrador al mismo tiempo en la sala.`;
            if (callback) {
              callback({ success: false, error: errMsg });
            }
            socket.emit('join_room_error', { message: errMsg });
            return;
          }
        }
      }

      // Deduplicate: Purge any existing connection with the same user ID or same name
      for (const [existingSocketId, existingUser] of room.users.entries()) {
        if (
          existingSocketId === socket.id ||
          existingUser.id === finalUserId ||
          (cleanName && existingUser.name.toLowerCase() === cleanName.toLowerCase())
        ) {
          room.users.delete(existingSocketId);
        }
      }

      const finalRole: 'admin' | 'participant' = isAdminRequested ? 'admin' : 'participant';
      if (finalRole === 'admin') {
        room.adminId = finalUserId;
      }

      currentUser = {
        id: finalUserId,
        name: cleanName,
        avatarId: avatarId || 'three_robot',
        role: finalRole,
        roomId: trimmedRoomId,
        isMuted: true,
        isCameraActive: true,
      };

      room.users.set(socket.id, currentUser);
      socket.join(trimmedRoomId);

      // Notify caller
      const participantsList = Array.from(room.users.values());
      if (callback) {
        callback({
          success: true,
          user: currentUser,
          room: {
            id: room.id,
            name: room.name,
            adminId: room.adminId,
            isLocked: room.isLocked,
            participants: participantsList,
          },
        });
      }

      // Send active media state to newcomer
      if (room.mediaState) {
        socket.emit('media_state_sync', room.mediaState);
      }

      // Entregar inmediatamente al nuevo participante cualquier modelo 3D personalizado activo en la sala
      for (const p of participantsList) {
        if (p.avatarId && avatarModelCache.has(p.avatarId)) {
          socket.emit('avatar_model_data', avatarModelCache.get(p.avatarId));
        }
      }

      // Notify others in room
      socket.to(trimmedRoomId).emit('user_joined', {
        user: currentUser,
        participants: participantsList,
      });

      broadcastRoomStatus(room);

      console.log(`[XStreamX] User ${currentUser.name} (${currentUser.role}) joined ${trimmedRoomId}`);
    });

    // Stream facial coordinates / blendshapes
    socket.on('face_data', (facePacket) => {
      if (!currentUser) return;
      socket.to(currentUser.roomId).emit('peer_face_data', {
        userId: socket.id,
        data: facePacket,
        timestamp: Date.now(),
      });
    });

    // WebRTC Signaling for Live Audio Mesh
    socket.on('webrtc_signal', ({ targetUserId, signal }) => {
      if (!currentUser) return;
      io.to(targetUserId).emit('webrtc_signal', {
        fromUserId: socket.id,
        signal,
      });
    });

    // Update avatar preference
    socket.on('update_avatar', ({ avatarId }) => {
      if (!currentUser) return;
      currentUser.avatarId = avatarId;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        room.users.set(socket.id, currentUser);
        io.to(currentUser.roomId).emit('user_updated', { user: currentUser });

        // Si tenemos el modelo 3D en caché del servidor, transmitirlo inmediatamente
        if (avatarId && avatarModelCache.has(avatarId)) {
          io.to(currentUser.roomId).emit('avatar_model_data', avatarModelCache.get(avatarId));
        }
      }
    });

    // P2P / Server Relay for Custom 3D Avatar Models (e.g., created in 3ds Max / Face Studio)
    socket.on('request_avatar_model', ({ targetUserId, avatarId }) => {
      if (!currentUser) return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      // 1. Responder de inmediato desde la caché en memoria del servidor si ya está disponible (0ms)
      if (avatarId && avatarModelCache.has(avatarId)) {
        socket.emit('avatar_model_data', avatarModelCache.get(avatarId));
        return;
      }

      // 2. Si no estaba en caché, dirigir solicitud al usuario destino
      if (targetUserId) {
        let targetSocketId: string | undefined;
        for (const [sId, u] of room.users.entries()) {
          if (u.id === targetUserId || sId === targetUserId) {
            targetSocketId = sId;
            break;
          }
        }
        if (targetSocketId) {
          io.to(targetSocketId).emit('request_avatar_model', {
            fromUserId: currentUser.id,
            fromSocketId: socket.id,
            avatarId,
          });
          return;
        }
      }

      // 3. Difundir a la sala si no se especificó o no se encontró socket puntual
      socket.to(currentUser.roomId).emit('request_avatar_model', {
        fromUserId: currentUser.id,
        fromSocketId: socket.id,
        avatarId,
      });
    });

    socket.on('send_avatar_model', ({ targetSocketId, targetUserId, modelPacket }) => {
      if (!currentUser || !modelPacket) return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      // Almacenar en la caché central de memoria del servidor
      if (modelPacket.avatarId) {
        avatarModelCache.set(modelPacket.avatarId, modelPacket);
      }

      if (targetSocketId) {
        io.to(targetSocketId).emit('avatar_model_data', modelPacket);
      } else if (targetUserId) {
        let destSocketId: string | undefined;
        for (const [sId, u] of room.users.entries()) {
          if (u.id === targetUserId || sId === targetUserId) {
            destSocketId = sId;
            break;
          }
        }
        if (destSocketId) {
          io.to(destSocketId).emit('avatar_model_data', modelPacket);
        } else {
          socket.to(currentUser.roomId).emit('avatar_model_data', modelPacket);
        }
      } else {
        socket.to(currentUser.roomId).emit('avatar_model_data', modelPacket);
      }
    });

    // Transmisión proactiva de modelos 3D al crearse o equiparse
    socket.on('share_avatar_model', (modelPacket) => {
      if (!currentUser || !modelPacket) return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      if (modelPacket.avatarId) {
        avatarModelCache.set(modelPacket.avatarId, modelPacket);
        if (currentUser.avatarId !== modelPacket.avatarId) {
          currentUser.avatarId = modelPacket.avatarId;
          room.users.set(socket.id, currentUser);
          io.to(currentUser.roomId).emit('user_updated', { user: currentUser });
        }
      }
      socket.to(currentUser.roomId).emit('avatar_model_data', modelPacket);
    });

    // Mic state toggle
    socket.on('toggle_mute', ({ isMuted }) => {
      if (!currentUser) return;
      currentUser.isMuted = isMuted;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        room.users.set(socket.id, currentUser);
        io.to(currentUser.roomId).emit('user_updated', { user: currentUser });
      }
    });

    // Camera state toggle
    socket.on('toggle_camera', ({ isCameraActive }) => {
      if (!currentUser) return;
      currentUser.isCameraActive = isCameraActive;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        room.users.set(socket.id, currentUser);
        io.to(currentUser.roomId).emit('user_updated', { user: currentUser });
      }
    });

    // Text Chat & Reactions
    socket.on('send_chat', ({ text, reaction }) => {
      if (!currentUser) return;
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId: socket.id,
        userName: currentUser.name,
        role: currentUser.role,
        text,
        reaction,
        timestamp: Date.now(),
      };
      io.to(currentUser.roomId).emit('chat_message', message);
    });

    // ADMIN CONTROLS: Mute participant
    socket.on('admin_mute_user', ({ targetUserId, muteState }) => {
      if (!currentUser || currentUser.role !== 'admin') return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      let targetSocketId: string | undefined;
      let target: User | undefined;
      for (const [sId, u] of room.users.entries()) {
        if (u.id === targetUserId || sId === targetUserId) {
          targetSocketId = sId;
          target = u;
          break;
        }
      }

      if (target && targetSocketId) {
        target.isMuted = muteState !== undefined ? muteState : true;
        io.to(targetSocketId).emit('force_mute', { isMuted: target.isMuted, targetUserId: target.id });
        io.to(currentUser.roomId).emit('user_updated', { user: target });
      }
    });

    // ADMIN CONTROLS: Mute all participants
    socket.on('admin_mute_all', ({ muteState }) => {
      if (!currentUser || currentUser.role !== 'admin') return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      const shouldMute = muteState !== undefined ? muteState : true;
      (room as any).isAllMuted = shouldMute;
      room.users.forEach((user, socketId) => {
        if (user.role !== 'admin') {
          user.isMuted = shouldMute;
          io.to(socketId).emit('force_mute', { isMuted: shouldMute, targetUserId: user.id });
        }
      });

      io.to(currentUser.roomId).emit('force_mute_all', { isMuted: shouldMute });
      io.to(currentUser.roomId).emit('all_users_updated', {
        participants: Array.from(room.users.values()),
      });
    });

    // ADMIN CONTROLS: Kick participant
    socket.on('admin_kick_user', ({ targetUserId, reason }) => {
      if (!currentUser || currentUser.role !== 'admin') return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      io.to(targetUserId).emit('kicked_from_room', {
        reason: reason || 'El administrador te ha retirado de la sala.',
      });

      const targetSocket = io.sockets.sockets.get(targetUserId);
      if (targetSocket) {
        targetSocket.leave(currentUser.roomId);
      }
      room.users.delete(targetUserId);

      io.to(currentUser.roomId).emit('user_left', {
        userId: targetUserId,
        participants: Array.from(room.users.values()),
      });
      broadcastRoomStatus(room);
    });

    // ADMIN CONTROLS: Lock room
    socket.on('admin_toggle_lock', ({ isLocked }) => {
      if (!currentUser || currentUser.role !== 'admin') return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      room.isLocked = isLocked;
      io.to(currentUser.roomId).emit('room_lock_changed', { isLocked });
      broadcastRoomStatus(room);
    });

    // MEDIA THEATER: Synchronize video & cue playlist for all members
    socket.on('media_state_sync', (state) => {
      if (!currentUser?.roomId) return;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        room.mediaState = state;
      }
      socket.to(currentUser.roomId).emit('media_state_sync', state);
    });

    socket.on('media_queue_add', ({ item, state }) => {
      if (!currentUser?.roomId) return;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        if (state) {
          room.mediaState = state;
        } else if (item) {
          if (!room.mediaState?.currentVideo) {
            room.mediaState = {
              currentVideo: item,
              queue: [],
              isPlaying: true,
              playbackTime: 0,
              lastSyncTimestamp: Date.now(),
              syncedByUserId: item.addedByUserId,
            };
          } else {
            const queue = room.mediaState.queue || [];
            if (!queue.some((q: any) => q.id === item.id)) {
              room.mediaState.queue = [...queue, item];
            }
          }
        }
        io.to(currentUser.roomId).emit('media_state_sync', room.mediaState);
      }
    });

    socket.on('media_queue_remove', ({ itemId, state }) => {
      if (!currentUser?.roomId) return;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        if (state) {
          room.mediaState = state;
        } else if (itemId && room.mediaState?.queue) {
          room.mediaState.queue = room.mediaState.queue.filter((q: any) => q.id !== itemId);
        }
        io.to(currentUser.roomId).emit('media_state_sync', room.mediaState);
      }
    });

    socket.on('media_queue_skip', ({ state }) => {
      if (!currentUser?.roomId) return;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        if (state) {
          room.mediaState = state;
        } else if (room.mediaState?.queue) {
          const next = room.mediaState.queue.shift() || null;
          room.mediaState.currentVideo = next;
          room.mediaState.isPlaying = !!next;
          room.mediaState.playbackTime = 0;
          room.mediaState.lastSyncTimestamp = Date.now();
        }
        io.to(currentUser.roomId).emit('media_state_sync', room.mediaState);
      }
    });

    socket.on('request_media_sync', () => {
      if (!currentUser?.roomId) return;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        if (!room.mediaState) {
          room.mediaState = createInitialMediaState();
        }
        socket.emit('media_state_sync', room.mediaState);
      }
    });

    // WHITEBOARD: Synchronize drawing strokes and board clear across room members
    socket.on('whiteboard_stroke', (stroke) => {
      if (!currentUser?.roomId) return;
      socket.to(currentUser.roomId).emit('whiteboard_stroke', stroke);
    });

    socket.on('whiteboard_clear', () => {
      if (!currentUser?.roomId) return;
      socket.to(currentUser.roomId).emit('whiteboard_clear');
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (!currentUser) return;
      const room = rooms.get(currentUser.roomId);
      if (room) {
        const wasAdmin = currentUser.role === 'admin';
        room.users.delete(socket.id);

        if (wasAdmin) {
          const remainingAdmin = getRoomActiveAdmin(room, io);
          if (!remainingAdmin) {
            room.adminId = '';
          }
        }

        io.to(currentUser.roomId).emit('user_left', {
          userId: currentUser.id,
          participants: Array.from(room.users.values()),
        });

        broadcastRoomStatus(room);

        if (room.users.size === 0 && room.id !== 'main') {
          rooms.delete(room.id);
        }
      }
    });
  });

  // Setup Vite in Dev or Static Serving in Prod
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(__dirname, 'dist');

  // Favicon handler: ensure /favicon.ico always returns 200 OK
  app.get('/favicon.ico', (req, res) => {
    const icoPath = path.resolve(__dirname, 'public', 'favicon.ico');
    if (fs.existsSync(icoPath)) {
      res.type('image/x-icon').sendFile(icoPath);
    } else {
      const svgPath = path.resolve(__dirname, 'public', 'favicon.svg');
      if (fs.existsSync(svgPath)) {
        res.type('image/svg+xml').sendFile(svgPath);
      } else {
        res.status(204).end();
      }
    }
  });

  // Handle stale cached CSS/JS bundle requests gracefully (e.g. index-BD_-xWaB.css)
  app.get(['/assets/:file', '/:file'], (req, res, next) => {
    const file = req.params.file;
    if (file && (file.endsWith('.css') || file.endsWith('.js'))) {
      const directDist = path.resolve(distPath, 'assets', file);
      if (fs.existsSync(directDist)) {
        return res.sendFile(directDist);
      }
      // If a stale hashed CSS bundle was requested, serve current active stylesheet
      if (file.endsWith('.css') && file.startsWith('index-')) {
        const assetsDir = path.resolve(distPath, 'assets');
        if (fs.existsSync(assetsDir)) {
          const files = fs.readdirSync(assetsDir);
          const currentCss = files.find((f) => f.startsWith('index-') && f.endsWith('.css'));
          if (currentCss) {
            return res.type('text/css').sendFile(path.resolve(assetsDir, currentCss));
          }
        }
      }
    }
    next();
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Explicit route handler for 3D Mask Studio app (/3dchat/faces) and its aliases
    app.get(['/3dchat/faces', '/3dchat/faces/*', '/faces', '/faces/*'], (_req, res) => {
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
      return res.status(404).send('Build not found. Run npm run build first.');
    });

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build not found. Run npm run build first.');
      }
    });
  }

  // Primary port: 3000 in dev (required by AI Studio), or process.env.PORT (8080) in prod
  const primaryPort = isProd ? (Number(process.env.PORT) || 8080) : 3000;

  httpServer.listen(primaryPort, '0.0.0.0', () => {
    console.log(`[XStreamX] Server running on http://0.0.0.0:${primaryPort}`);
  });

  // In dev environment, also listen on secondary port (8080) if specified in env
  const envPort = Number(process.env.PORT);
  if (!isProd && envPort && envPort !== 3000) {
    try {
      const secondaryServer = createServer(app);
      io.attach(secondaryServer);
      secondaryServer.listen(envPort, '0.0.0.0', () => {
        console.log(`[XStreamX] Dual-listen on port ${envPort}`);
      });
    } catch (e) {
      console.warn('[XStreamX] Secondary port listen skipped:', e);
    }
  }
}

startServer().catch((err) => {
  console.error('[XStreamX] Fatal server startup error:', err);
});
