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

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
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

  // Serve public static assets (favicon.svg, models, etc.)
  app.use(express.static(path.resolve(__dirname, 'public')));

  // Static 3D model assets
  app.use('/models', express.static(path.resolve(__dirname, 'public/models')));
  app.use('/models', express.static(path.resolve(__dirname, 'models')));

  // Explicit favicon handler to prevent 404s on /favicon.ico and /favicon.svg
  app.get(['/favicon.ico', '/favicon.svg'], (_req, res) => {
    const svgPath = path.resolve(__dirname, 'public/favicon.svg');
    if (fs.existsSync(svgPath)) {
      res.type('image/svg+xml').sendFile(svgPath);
    } else {
      res.status(204).end();
    }
  });

  // API endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', activeRooms: rooms.size, timestamp: Date.now() });
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

  // X.com (Twitter) OAuth endpoint
  app.get('/api/auth/x/status', (req, res) => {
    const clientId = process.env.X_CLIENT_ID || process.env.X_CONSUMER_KEY;
    const clientSecret = process.env.X_CLIENT_SECRET || process.env.X_CONSUMER_SECRET;
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/auth/callback`;

    res.json({
      configured: !!(clientId && clientSecret),
      clientIdMasked: clientId ? `${clientId.slice(0, 5)}...${clientId.slice(-4)}` : null,
      redirectUri,
    });
  });

  app.get('/api/auth/x/url', (req, res) => {
    const clientId = process.env.X_CLIENT_ID || process.env.X_CONSUMER_KEY;
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl}/auth/callback`;

    if (!clientId) {
      return res.json({
        configured: false,
        redirectUri,
        message: 'Claves de X.com Developer no configuradas en variables de entorno.',
      });
    }

    const state = Math.random().toString(36).substring(2, 12);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'tweet.read users.read offline.access',
      state: state,
      code_challenge: 'challenge',
      code_challenge_method: 'plain',
    });

    res.json({
      configured: true,
      redirectUri,
      url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
    });
  });

  // OAuth Callback Handler (Popup receiver)
  app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code, state, error } = req.query;
    let handle = '';
    let displayName = '';
    let authError = error ? String(error) : '';

    if (code) {
      const clientId = process.env.X_CLIENT_ID || process.env.X_CONSUMER_KEY;
      const clientSecret = process.env.X_CLIENT_SECRET || process.env.X_CONSUMER_SECRET;
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const redirectUri = `${baseUrl}/auth/callback`;

      try {
        const tokenParams = new URLSearchParams({
          code: String(code),
          grant_type: 'authorization_code',
          client_id: clientId || '',
          redirect_uri: redirectUri,
          code_verifier: 'challenge',
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/x-www-form-urlencoded',
        };

        if (clientId && clientSecret) {
          const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          headers['Authorization'] = `Basic ${basicAuth}`;
        }

        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers,
          body: tokenParams.toString(),
        });

        if (tokenRes.ok) {
          const tokenData: any = await tokenRes.json();
          if (tokenData.access_token) {
            const userRes = await fetch('https://api.twitter.com/2/users/me', {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
              },
            });
            if (userRes.ok) {
              const userData: any = await userRes.json();
              if (userData.data) {
                handle = userData.data.username || '';
                displayName = userData.data.name || `@${handle}`;
              }
            }
          }
        }
      } catch (err: any) {
        console.warn('[X OAuth] Code exchange warning:', err?.message || err);
      }
    }

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>XStreamX - Conectado con X</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              background: #020617;
              color: #f8fafc;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .card {
              text-align: center;
              padding: 24px;
              background: #0f172a;
              border: 1px solid #1e293b;
              border-radius: 16px;
              max-width: 320px;
            }
            .spinner {
              width: 32px;
              height: 32px;
              border: 3px solid #334155;
              border-top-color: #22d3ee;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
              margin: 16px auto;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <h3>Autenticación con X.com</h3>
            <div class="spinner"></div>
            <p style="font-size: 13px; color: #94a3b8;">
              ${handle ? `Conectado como @${handle}. Redirigiendo...` : 'Finalizando conexión con XStreamX...'}
            </p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                provider: 'x',
                handle: ${JSON.stringify(handle)},
                name: ${JSON.stringify(displayName)},
                code: ${JSON.stringify(code || '')},
                error: ${JSON.stringify(authError)}
              }, '*');
              setTimeout(() => window.close(), 500);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
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
        isMuted: false,
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
      }
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

      const target = room.users.get(targetUserId);
      if (target) {
        target.isMuted = muteState !== undefined ? muteState : true;
        io.to(targetUserId).emit('force_mute', { isMuted: target.isMuted });
        io.to(currentUser.roomId).emit('user_updated', { user: target });
      }
    });

    // ADMIN CONTROLS: Mute all participants
    socket.on('admin_mute_all', ({ muteState }) => {
      if (!currentUser || currentUser.role !== 'admin') return;
      const room = rooms.get(currentUser.roomId);
      if (!room) return;

      const shouldMute = muteState !== undefined ? muteState : true;
      room.users.forEach((user, userId) => {
        if (user.role !== 'admin') {
          user.isMuted = shouldMute;
          io.to(userId).emit('force_mute', { isMuted: shouldMute });
        }
      });

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
      if (room?.mediaState) {
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

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
