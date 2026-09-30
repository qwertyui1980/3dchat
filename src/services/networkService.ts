import { io, Socket } from 'socket.io-client';
import mqtt, { MqttClient } from 'mqtt';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { RealtimeChannel } from '@supabase/supabase-js';
import { User, RoomInfo, FaceFeatures, ChatMessage, AvatarId } from '../types';
import { getSupabaseClient } from './supabaseClient';

const PUBLIC_MQTT_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

export class NetworkService {
  private socket: Socket | null = null;
  private mqttClient: MqttClient | null = null;
  private mqttBrokerIndex: number = 0;
  private mqttTopic: string = '';
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: RealtimeChannel | null = null;

  // PeerJS WebRTC direct mesh
  private peer: Peer | null = null;
  private peerDataConnections: Map<string, DataConnection> = new Map();
  private peerMediaCalls: Map<string, MediaConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();

  // Socket.io WebRTC fallback
  private socketPeerConnections: Map<string, RTCPeerConnection> = new Map();

  private localAudioStream: MediaStream | null = null;
  private presenceInterval: any = null;
  private burstTimeouts: any[] = [];
  private peerHeartbeats: Map<string, number> = new Map();

  public currentUser: User | null = null;
  public currentRoom: RoomInfo | null = null;
  private lastSentTime: number = 0;

  // Event callbacks
  public onRoomJoined: ((room: RoomInfo, user: User) => void) | null = null;
  public onUserJoined: ((user: User, participants: User[]) => void) | null = null;
  public onUserLeft: ((userId: string, participants: User[]) => void) | null = null;
  public onUserUpdated: ((user: User) => void) | null = null;
  public onPeerFaceData: ((userId: string, features: FaceFeatures) => void) | null = null;
  public onChatMessage: ((message: ChatMessage) => void) | null = null;
  public onRoomLockChanged: ((isLocked: boolean) => void) | null = null;
  public onKicked: ((reason: string) => void) | null = null;
  public onForceMute: ((isMuted: boolean) => void) | null = null;
  public onRoomStatusChanged: ((status: { isOpen: boolean; room: any }) => void) | null = null;
  public onError: ((error: string) => void) | null = null;

  constructor() {
    this.initBroadcastChannel();
  }

  private initBroadcastChannel() {
    try {
      if (!this.broadcastChannel && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('xstreamx_mesh_channel');
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      }
    } catch (e) {
      console.warn('[Network] BroadcastChannel notice:', e);
    }
  }

  connect() {
    this.initBroadcastChannel();

    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    const signalingUrl = (import.meta as any).env?.VITE_SIGNALING_URL;
    const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io');

    if (signalingUrl || !isGitHubPages) {
      try {
        this.socket = io(signalingUrl || undefined, {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: 2,
          timeout: 4000,
        });

        this.socket.on('connect', () => {
          console.log('[XStreamX] Socket connected:', this.socket?.id);
        });

        this.socket.on('user_joined', ({ user, participants }: { user: User; participants: User[] }) => {
          if (this.currentRoom) {
            this.currentRoom.participants = [...participants];
          }
          if (this.onUserJoined) this.onUserJoined(user, [...participants]);
        });

        this.socket.on('user_left', ({ userId, participants }: { userId: string; participants: User[] }) => {
          if (this.currentRoom) {
            this.currentRoom.participants = [...participants];
          }
          this.closePeer(userId);
          if (this.onUserLeft) this.onUserLeft(userId, [...participants]);
        });

        this.socket.on('user_updated', ({ user }: { user: User }) => {
          if (this.currentRoom) {
            this.currentRoom.participants = this.currentRoom.participants.map((p) =>
              p.id === user.id ? user : p
            );
          }
          if (this.currentUser && this.currentUser.id === user.id) {
            this.currentUser = user;
          }
          if (this.onUserUpdated) this.onUserUpdated(user);
        });

        this.socket.on('peer_face_data', ({ userId, data }: { userId: string; data: FaceFeatures }) => {
          if (this.onPeerFaceData) this.onPeerFaceData(userId, data);
        });

        this.socket.on('chat_message', (message: ChatMessage) => {
          if (this.onChatMessage) this.onChatMessage(message);
        });

        this.socket.on('room_lock_changed', ({ isLocked }: { isLocked: boolean }) => {
          if (this.currentRoom) this.currentRoom.isLocked = isLocked;
          if (this.onRoomLockChanged) this.onRoomLockChanged(isLocked);
        });

        this.socket.on('force_mute', ({ isMuted }: { isMuted: boolean }) => {
          if (this.currentUser) this.currentUser.isMuted = isMuted;
          if (this.onForceMute) this.onForceMute(isMuted);
        });

        this.socket.on('kicked_from_room', ({ reason }: { reason: string }) => {
          this.cleanup();
          if (this.onKicked) this.onKicked(reason);
        });

        this.socket.on('room_status_changed', (status: { isOpen: boolean; room: any }) => {
          if (this.onRoomStatusChanged) this.onRoomStatusChanged(status);
        });
      } catch (err) {
        console.warn('[Network] Socket initialization skipped:', err);
      }
    }
  }

  joinRoom(roomId: string, userName: string, avatarId: AvatarId, createAsAdmin: boolean) {
    this.connect();

    const cleanRoomId = roomId.trim().toLowerCase() || 'alpha';
    const cleanUserName = userName.trim() || 'Participante';

    // Create a unique local user identity
    const localUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanUserName,
      avatarId: avatarId,
      role: createAsAdmin ? 'admin' : 'participant',
      roomId: cleanRoomId,
      isMuted: false,
      isCameraActive: true,
    };

    const localRoom: RoomInfo = {
      id: cleanRoomId,
      name: `Sala ${cleanRoomId.toUpperCase()}`,
      adminId: createAsAdmin ? localUser.id : '',
      isLocked: false,
      participants: [localUser],
    };

    this.currentUser = localUser;
    this.currentRoom = localRoom;

    if (this.onRoomJoined && this.currentRoom && this.currentUser) {
      this.onRoomJoined(this.currentRoom, this.currentUser);
    }

    // 1. Initialize PeerJS WebRTC Layer (P2P direct audio + blendshapes data channel)
    this.initPeerJS(cleanRoomId, localUser);

    // 2. Initialize Universal Real-time Global Mesh (MQTT WebSockets with multi-broker failover)
    this.initGlobalMesh(cleanRoomId, localUser);

    // 3. Initialize Supabase Realtime Channel if configured
    this.initSupabaseRealtime(cleanRoomId, localUser);

    // 4. Announce presence across local browser tabs
    this.broadcastChannel?.postMessage({
      type: 'tab_who_is_in_room',
      roomId: cleanRoomId,
      user: localUser,
    });

    this.broadcastChannel?.postMessage({
      type: 'tab_user_joined',
      roomId: cleanRoomId,
      user: localUser,
    });

    // 5. Try socket.io emit if socket server is active
    if (this.socket?.connected) {
      this.socket.emit('join_room', {
        roomId: cleanRoomId,
        userName: cleanUserName,
        avatarId,
        createAsAdmin,
      });
    }
  }

  // --- 1. PEERJS WEBRTC P2P LAYER ---
  private getPeerJsId(roomId: string, userId: string): string {
    const cleanU = userId.replace(/[^a-zA-Z0-9]/g, '');
    const cleanR = roomId.replace(/[^a-zA-Z0-9]/g, '');
    return `xs_${cleanR}_${cleanU}`;
  }

  private initPeerJS(roomId: string, user: User) {
    try {
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }

      const peerId = this.getPeerJsId(roomId, user.id);
      const peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
        },
      });

      peer.on('open', (id) => {
        console.log('[PeerJS] Online with P2P Peer ID:', id);
      });

      // Handle incoming direct DataConnections for 60fps face tracking
      peer.on('connection', (conn) => {
        this.setupDataConnection(conn);
      });

      // Handle incoming direct Audio Calls
      peer.on('call', (call) => {
        if (this.localAudioStream) {
          call.answer(this.localAudioStream);
        } else {
          call.answer();
        }
        this.setupMediaCall(call);
      });

      peer.on('error', (err) => {
        console.warn('[PeerJS] Notice:', err.type || err.message);
      });

      this.peer = peer;
    } catch (e) {
      console.warn('[PeerJS] Init error, continuing with WebSocket mesh:', e);
    }
  }

  private setupDataConnection(conn: DataConnection) {
    conn.on('open', () => {
      this.peerDataConnections.set(conn.peer, conn);
    });

    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;
      if (data.type === 'peer_face_data' && data.userId && data.features) {
        if (this.onPeerFaceData) {
          this.onPeerFaceData(data.userId, data.features);
        }
      }
    });

    conn.on('close', () => {
      this.peerDataConnections.delete(conn.peer);
    });

    conn.on('error', () => {
      this.peerDataConnections.delete(conn.peer);
    });
  }

  private setupMediaCall(call: MediaConnection) {
    call.on('stream', (remoteStream) => {
      let audioEl = this.remoteAudioElements.get(call.peer);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        this.remoteAudioElements.set(call.peer, audioEl);
      }
      audioEl.srcObject = remoteStream;
      audioEl.play().catch((e) => console.warn('[Audio] Autoplay notice:', e));
    });

    call.on('close', () => {
      this.peerMediaCalls.delete(call.peer);
    });

    call.on('error', () => {
      this.peerMediaCalls.delete(call.peer);
    });

    this.peerMediaCalls.set(call.peer, call);
  }

  private connectToPeerP2P(targetUser: User) {
    if (!this.peer || !this.currentUser || !this.currentRoom) return;
    if (targetUser.id === this.currentUser.id) return;

    const targetPeerId = this.getPeerJsId(this.currentRoom.id, targetUser.id);

    // Deterministic connection initiator (only one peer initiates to prevent collisions)
    if (this.currentUser.id > targetUser.id) {
      if (!this.peerDataConnections.has(targetPeerId)) {
        try {
          const conn = this.peer.connect(targetPeerId, { reliable: false });
          this.setupDataConnection(conn);
        } catch (e) {
          // Fallback to mesh
        }
      }

      if (this.localAudioStream && !this.peerMediaCalls.has(targetPeerId)) {
        try {
          const call = this.peer.call(targetPeerId, this.localAudioStream);
          this.setupMediaCall(call);
        } catch (e) {
          // Fallback to mesh
        }
      }
    }
  }

  // --- 2. UNIVERSAL GLOBAL MESH (MQTT WebSockets) ---
  private initGlobalMesh(roomId: string, user: User) {
    try {
      if (this.mqttClient) {
        this.mqttClient.end(true);
        this.mqttClient = null;
      }

      this.mqttTopic = `xstreamx/v1/rooms/${roomId}`;
      const clientId = `xs_${user.id}_${Math.random().toString(36).slice(2, 7)}`;
      const brokerUrl = PUBLIC_MQTT_BROKERS[this.mqttBrokerIndex % PUBLIC_MQTT_BROKERS.length];

      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        keepalive: 30,
        reconnectPeriod: 2000,
        connectTimeout: 5000,
      });

      client.on('connect', () => {
        console.log('[Global Mesh] Connected to WebSocket broker:', brokerUrl, 'for room:', roomId);
        client.subscribe(this.mqttTopic, { qos: 0 }, (err) => {
          if (!err) {
            // Triple-burst presence broadcast to guarantee zero packet loss on connection
            this.sendPresenceAnnouncement(roomId, user);
          }
        });
      });

      client.on('message', (_topic, messageBuffer) => {
        try {
          const raw = messageBuffer.toString();
          const msg = JSON.parse(raw);
          this.handleMeshMessage(msg);
        } catch (e) {
          // Invalid payload ignored
        }
      });

      client.on('error', (err) => {
        console.warn('[Global Mesh] Broker notice:', err.message);
        // Failover to alternate broker if needed
        this.mqttBrokerIndex++;
      });

      this.mqttClient = client;

      // Clear any previous burst timeouts
      this.burstTimeouts.forEach((t) => clearTimeout(t));
      this.burstTimeouts = [];

      // Burst announcements at 0ms, 400ms, and 1200ms
      this.burstTimeouts.push(
        setTimeout(() => this.sendPresenceAnnouncement(roomId, user), 400)
      );
      this.burstTimeouts.push(
        setTimeout(() => this.sendPresenceAnnouncement(roomId, user), 1200)
      );

      // Periodic presence beacon every 2.5 seconds
      if (this.presenceInterval) {
        clearInterval(this.presenceInterval);
      }
      this.presenceInterval = setInterval(() => {
        if (this.currentUser && this.currentRoom) {
          this.publishMeshMessage({
            type: 'presence_beacon',
            roomId: this.currentRoom.id,
            user: this.currentUser,
          });

          // Prune peers who haven't sent a heartbeat in 12 seconds
          const now = Date.now();
          this.peerHeartbeats.forEach((lastSeen, peerId) => {
            if (peerId !== this.currentUser?.id && now - lastSeen > 12000) {
              this.peerHeartbeats.delete(peerId);
              if (this.currentRoom) {
                const updatedList = this.currentRoom.participants.filter(
                  (p) => p.id !== peerId
                );
                this.currentRoom.participants = updatedList;
                this.closePeer(peerId);
                this.onUserLeft?.(peerId, updatedList);
              }
            }
          });
        }
      }, 2500);
    } catch (err) {
      console.warn('[Global Mesh] Init failed, relying on local fallback:', err);
    }
  }

  private sendPresenceAnnouncement(roomId: string, user: User) {
    this.publishMeshMessage({
      type: 'who_is_here',
      roomId,
      user,
    });

    this.publishMeshMessage({
      type: 'user_joined',
      roomId,
      user,
    });
  }

  private publishMeshMessage(payload: any) {
    if (this.mqttClient && this.mqttClient.connected && this.mqttTopic) {
      try {
        this.mqttClient.publish(this.mqttTopic, JSON.stringify(payload), { qos: 0 });
      } catch (e) {
        // Ignored
      }
    }
  }

  private handleMeshMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    if (!this.currentRoom || !this.currentUser) return;
    if (msg.roomId && msg.roomId !== this.currentRoom.id) return;

    // Ignore self-sent messages
    const senderId = msg.user?.id || msg.userId || msg.message?.userId;
    if (senderId === this.currentUser.id) return;

    if (senderId) {
      this.peerHeartbeats.set(senderId, Date.now());
    }

    switch (msg.type) {
      case 'who_is_here': {
        if (msg.user && msg.user.id !== this.currentUser.id) {
          // Immediately respond with our presence so the new peer discovers us
          this.publishMeshMessage({
            type: 'presence_sync',
            roomId: this.currentRoom.id,
            user: this.currentUser,
          });

          // Add new user if not already in participants
          if (!this.currentRoom.participants.some((p) => p.id === msg.user.id)) {
            const nextList = [...this.currentRoom.participants, msg.user];
            this.currentRoom.participants = nextList;
            this.connectToPeerP2P(msg.user);
            if (this.onUserJoined) {
              this.onUserJoined(msg.user, nextList);
            }
          }
        }
        break;
      }

      case 'presence_sync':
      case 'presence_beacon':
      case 'user_joined': {
        if (msg.user && msg.user.id !== this.currentUser.id) {
          const existingIdx = this.currentRoom.participants.findIndex((p) => p.id === msg.user.id);
          if (existingIdx === -1) {
            const nextList = [...this.currentRoom.participants, msg.user];
            this.currentRoom.participants = nextList;
            this.connectToPeerP2P(msg.user);
            if (this.onUserJoined) {
              this.onUserJoined(msg.user, nextList);
            }
          } else {
            // Update participant details if changed
            const updated = [...this.currentRoom.participants];
            updated[existingIdx] = msg.user;
            this.currentRoom.participants = updated;
            if (this.onUserUpdated) {
              this.onUserUpdated(msg.user);
            }
          }
        }
        break;
      }

      case 'user_left': {
        if (msg.userId && msg.userId !== this.currentUser.id) {
          const nextList = this.currentRoom.participants.filter(
            (p) => p.id !== msg.userId
          );
          this.currentRoom.participants = nextList;
          this.closePeer(msg.userId);
          if (this.onUserLeft) {
            this.onUserLeft(msg.userId, nextList);
          }
        }
        break;
      }

      case 'user_updated': {
        if (msg.user && msg.user.id !== this.currentUser.id) {
          const nextList = this.currentRoom.participants.map((p) =>
            p.id === msg.user.id ? msg.user : p
          );
          this.currentRoom.participants = nextList;
          if (this.onUserUpdated) {
            this.onUserUpdated(msg.user);
          }
        }
        break;
      }

      case 'peer_face_data': {
        if (msg.userId && msg.userId !== this.currentUser.id) {
          if (this.onPeerFaceData) {
            this.onPeerFaceData(msg.userId, msg.features);
          }
        }
        break;
      }

      case 'chat_message': {
        if (msg.message && msg.message.userId !== this.currentUser.id) {
          if (this.onChatMessage) {
            this.onChatMessage(msg.message);
          }
        }
        break;
      }

      case 'room_lock': {
        this.currentRoom.isLocked = !!msg.isLocked;
        if (this.onRoomLockChanged) {
          this.onRoomLockChanged(!!msg.isLocked);
        }
        break;
      }

      case 'force_mute': {
        if (msg.targetUserId === this.currentUser.id) {
          this.currentUser.isMuted = !!msg.isMuted;
          if (this.onForceMute) {
            this.onForceMute(!!msg.isMuted);
          }
        }
        break;
      }

      case 'kick_user': {
        if (msg.targetUserId === this.currentUser.id) {
          this.cleanup();
          if (this.onKicked) {
            this.onKicked(msg.reason || 'Has sido expulsado de la sala');
          }
        }
        break;
      }
    }
  }

  // --- 3. SUPABASE REALTIME CHANNEL INTEGRATION ---
  private initSupabaseRealtime(roomId: string, user: User) {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      if (this.supabaseChannel) {
        supabase.removeChannel(this.supabaseChannel);
        this.supabaseChannel = null;
      }

      const channel = supabase.channel(`room_${roomId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: user.id },
        },
      });

      channel
        .on('broadcast', { event: 'peer_face_data' }, ({ payload }) => {
          if (payload && payload.userId && payload.userId !== this.currentUser?.id) {
            if (this.onPeerFaceData) {
              this.onPeerFaceData(payload.userId, payload.features);
            }
          }
        })
        .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
          if (payload && payload.message && payload.message.userId !== this.currentUser?.id) {
            if (this.onChatMessage) {
              this.onChatMessage(payload.message);
            }
          }
        })
        .on('broadcast', { event: 'user_updated' }, ({ payload }) => {
          if (payload && payload.user && payload.user.id !== this.currentUser?.id) {
            if (this.currentRoom) {
              this.currentRoom.participants = this.currentRoom.participants.map((p) =>
                p.id === payload.user.id ? payload.user : p
              );
            }
            if (this.onUserUpdated) {
              this.onUserUpdated(payload.user);
            }
          }
        })
        .on('broadcast', { event: 'room_lock' }, ({ payload }) => {
          if (this.currentRoom) {
            this.currentRoom.isLocked = !!payload.isLocked;
          }
          if (this.onRoomLockChanged) {
            this.onRoomLockChanged(!!payload.isLocked);
          }
        })
        .on('broadcast', { event: 'force_mute' }, ({ payload }) => {
          if (payload.targetUserId === this.currentUser?.id) {
            if (this.currentUser) this.currentUser.isMuted = !!payload.isMuted;
            if (this.onForceMute) this.onForceMute(!!payload.isMuted);
          }
        })
        .on('broadcast', { event: 'kick_user' }, ({ payload }) => {
          if (payload.targetUserId === this.currentUser?.id) {
            this.cleanup();
            if (this.onKicked) {
              this.onKicked(payload.reason || 'Has sido expulsado por el administrador');
            }
          }
        })
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const presences = Object.values(state).flat() as any[];
          const remoteUsers: User[] = presences
            .map((p) => p.user)
            .filter((u): u is User => !!u && u.id !== this.currentUser?.id);

          if (this.currentRoom && this.currentUser) {
            const map = new Map<string, User>();
            map.set(this.currentUser.id, this.currentUser);
            remoteUsers.forEach((u) => map.set(u.id, u));
            this.currentRoom.participants = Array.from(map.values());
            if (this.onUserJoined) {
              remoteUsers.forEach((u) => {
                this.onUserJoined?.(u, this.currentRoom!.participants);
              });
            }
          }
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          newPresences.forEach((p: any) => {
            if (p.user && p.user.id !== this.currentUser?.id && this.currentRoom) {
              if (!this.currentRoom.participants.some((u) => u.id === p.user.id)) {
                this.currentRoom.participants = [...this.currentRoom.participants, p.user];
                this.onUserJoined?.(p.user, this.currentRoom.participants);
              }
            }
          });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          leftPresences.forEach((p: any) => {
            if (p.user && this.currentRoom) {
              this.currentRoom.participants = this.currentRoom.participants.filter(
                (u) => u.id !== p.user.id
              );
              this.closePeer(p.user.id);
              this.onUserLeft?.(p.user.id, this.currentRoom.participants);
            }
          });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user });
          }
        });

      this.supabaseChannel = channel;
    } catch (e) {
      console.warn('[Supabase Realtime] Channel init error:', e);
    }
  }

  setLocalAudioStream(stream: MediaStream | null) {
    this.localAudioStream = stream;

    const peer = this.peer;
    const room = this.currentRoom;
    const currentUser = this.currentUser;

    // Update all PeerJS audio calls
    if (peer && room && currentUser) {
      room.participants.forEach((p) => {
        if (p.id !== currentUser.id) {
          const targetPeerId = this.getPeerJsId(room.id, p.id);
          if (stream && !this.peerMediaCalls.has(targetPeerId)) {
            try {
              const call = peer.call(targetPeerId, stream);
              this.setupMediaCall(call);
            } catch (e) {
              // Ignored
            }
          }
        }
      });
    }
  }

  broadcastFaceData(features: FaceFeatures) {
    if (!this.currentUser || !this.currentRoom) return;
    const now = performance.now();
    // Throttle to ~35 fps (~28ms) to optimize networking and CPU
    if (now - this.lastSentTime < 28) return;
    this.lastSentTime = now;

    // 1. Send via direct PeerJS DataConnections (fastest, lowest latency WebRTC)
    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({
            type: 'peer_face_data',
            userId: this.currentUser!.id,
            features,
          });
        } catch (e) {
          // Ignored
        }
      }
    });

    // 2. Send via Global Real-time Mesh (MQTT WebSockets)
    this.publishMeshMessage({
      type: 'peer_face_data',
      roomId: this.currentRoom.id,
      userId: this.currentUser.id,
      features,
    });

    // 3. Send via Supabase Realtime Channel if available
    if (this.supabaseChannel) {
      this.supabaseChannel.send({
        type: 'broadcast',
        event: 'peer_face_data',
        payload: {
          userId: this.currentUser.id,
          features,
        },
      });
    }

    // 4. Send via Socket.io if connected
    if (this.socket?.connected) {
      this.socket.emit('face_data', features);
    }

    // 5. Send over local multi-tab / multi-window broadcast channel
    this.broadcastChannel?.postMessage({
      type: 'tab_peer_face_data',
      roomId: this.currentRoom.id,
      userId: this.currentUser.id,
      features,
    });
  }

  updateAvatar(avatarId: AvatarId) {
    if (this.currentUser) {
      this.currentUser.avatarId = avatarId;
    }
    if (this.currentRoom && this.currentUser) {
      this.currentRoom.participants = this.currentRoom.participants.map((p) =>
        p.id === this.currentUser?.id ? { ...p, avatarId } : p
      );
    }

    // Broadcast across Global Mesh
    this.publishMeshMessage({
      type: 'user_updated',
      roomId: this.currentRoom?.id,
      user: this.currentUser,
    });

    // Broadcast across Supabase Realtime
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'user_updated',
      payload: { user: this.currentUser },
    });

    this.socket?.emit('update_avatar', { avatarId });

    if (this.currentRoom && this.currentUser) {
      this.broadcastChannel?.postMessage({
        type: 'tab_user_updated',
        roomId: this.currentRoom.id,
        user: this.currentUser,
      });
    }
  }

  toggleMute(isMuted: boolean) {
    if (this.currentUser) {
      this.currentUser.isMuted = isMuted;
    }
    if (this.currentRoom && this.currentUser) {
      this.currentRoom.participants = this.currentRoom.participants.map((p) =>
        p.id === this.currentUser?.id ? { ...p, isMuted } : p
      );
    }

    this.publishMeshMessage({
      type: 'user_updated',
      roomId: this.currentRoom?.id,
      user: this.currentUser,
    });

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'user_updated',
      payload: { user: this.currentUser },
    });

    this.socket?.emit('toggle_mute', { isMuted });

    if (this.currentRoom && this.currentUser) {
      this.broadcastChannel?.postMessage({
        type: 'tab_user_updated',
        roomId: this.currentRoom.id,
        user: this.currentUser,
      });
    }
  }

  toggleCamera(isCameraActive: boolean) {
    if (this.currentUser) {
      this.currentUser.isCameraActive = isCameraActive;
    }
    if (this.currentRoom && this.currentUser) {
      this.currentRoom.participants = this.currentRoom.participants.map((p) =>
        p.id === this.currentUser?.id ? { ...p, isCameraActive } : p
      );
    }

    this.publishMeshMessage({
      type: 'user_updated',
      roomId: this.currentRoom?.id,
      user: this.currentUser,
    });

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'user_updated',
      payload: { user: this.currentUser },
    });

    this.socket?.emit('toggle_camera', { isCameraActive });

    if (this.currentRoom && this.currentUser) {
      this.broadcastChannel?.postMessage({
        type: 'tab_user_updated',
        roomId: this.currentRoom.id,
        user: this.currentUser,
      });
    }
  }

  sendChatMessage(text: string, reaction?: string) {
    if (!this.currentUser || !this.currentRoom) return;

    const chatMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: this.currentUser.id,
      userName: this.currentUser.name,
      role: this.currentUser.role,
      text,
      reaction,
      timestamp: Date.now(),
    };

    // Deliver to local UI
    if (this.onChatMessage) {
      this.onChatMessage(chatMsg);
    }

    // Broadcast across Global Mesh (Cross-device / Global)
    this.publishMeshMessage({
      type: 'chat_message',
      roomId: this.currentRoom.id,
      message: chatMsg,
    });

    // Broadcast across Supabase Realtime
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: { message: chatMsg },
    });

    // Send via socket if connected
    if (this.socket?.connected) {
      this.socket.emit('send_chat', { text, reaction });
    }

    // Broadcast across local tabs
    this.broadcastChannel?.postMessage({
      type: 'tab_chat_message',
      roomId: this.currentRoom.id,
      message: chatMsg,
    });
  }

  // Admin controls
  adminMuteUser(targetUserId: string, muteState: boolean) {
    this.publishMeshMessage({
      type: 'force_mute',
      roomId: this.currentRoom?.id,
      targetUserId,
      isMuted: muteState,
    });

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'force_mute',
      payload: { targetUserId, isMuted: muteState },
    });

    this.socket?.emit('admin_mute_user', { targetUserId, muteState });

    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_force_mute',
        roomId: this.currentRoom.id,
        targetUserId,
        isMuted: muteState,
      });
    }
  }

  adminKickUser(targetUserId: string, reason?: string) {
    this.publishMeshMessage({
      type: 'kick_user',
      roomId: this.currentRoom?.id,
      targetUserId,
      reason: reason || 'Expulsado por el administrador',
    });

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'kick_user',
      payload: { targetUserId, reason: reason || 'Expulsado por el administrador' },
    });

    this.socket?.emit('admin_kick_user', { targetUserId, reason });

    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_kick_user',
        roomId: this.currentRoom.id,
        targetUserId,
        reason: reason || 'Expulsado de la sala',
      });
      const nextList = this.currentRoom.participants.filter(
        (p) => p.id !== targetUserId
      );
      this.currentRoom.participants = nextList;
      if (this.onUserLeft) {
        this.onUserLeft(targetUserId, nextList);
      }
    }
  }

  adminToggleLock(isLocked: boolean) {
    if (this.currentRoom) {
      this.currentRoom.isLocked = isLocked;
    }

    this.publishMeshMessage({
      type: 'room_lock',
      roomId: this.currentRoom?.id,
      isLocked,
    });

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'room_lock',
      payload: { isLocked },
    });

    this.socket?.emit('admin_toggle_lock', { isLocked });

    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_room_lock',
        roomId: this.currentRoom.id,
        isLocked,
      });
    }
  }

  private closePeer(userId: string) {
    if (this.currentRoom) {
      const peerId = this.getPeerJsId(this.currentRoom.id, userId);
      const conn = this.peerDataConnections.get(peerId);
      if (conn) {
        conn.close();
        this.peerDataConnections.delete(peerId);
      }
      const call = this.peerMediaCalls.get(peerId);
      if (call) {
        call.close();
        this.peerMediaCalls.delete(peerId);
      }
    }
    const audioEl = this.remoteAudioElements.get(userId);
    if (audioEl) {
      audioEl.srcObject = null;
      this.remoteAudioElements.delete(userId);
    }
  }

  private handleBroadcastMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    if (!this.currentRoom || !this.currentUser) return;
    if (msg.roomId && msg.roomId !== this.currentRoom.id) return;

    switch (msg.type) {
      case 'tab_who_is_in_room': {
        if (msg.user && msg.user.id !== this.currentUser.id) {
          this.broadcastChannel?.postMessage({
            type: 'tab_sync_presence',
            roomId: this.currentRoom.id,
            user: this.currentUser,
          });

          if (!this.currentRoom.participants.some((p) => p.id === msg.user.id)) {
            const nextList = [...this.currentRoom.participants, msg.user];
            this.currentRoom.participants = nextList;
            if (this.onUserJoined) {
              this.onUserJoined(msg.user, nextList);
            }
          }
        }
        break;
      }

      case 'tab_sync_presence':
      case 'tab_user_joined': {
        if (msg.user && msg.user.id !== this.currentUser.id) {
          const exists = this.currentRoom.participants.some((p) => p.id === msg.user.id);
          if (!exists) {
            const nextList = [...this.currentRoom.participants, msg.user];
            this.currentRoom.participants = nextList;
            if (this.onUserJoined) {
              this.onUserJoined(msg.user, nextList);
            }
          }
        }
        break;
      }

      case 'tab_user_left': {
        if (msg.userId && msg.userId !== this.currentUser.id) {
          const nextList = this.currentRoom.participants.filter(
            (p) => p.id !== msg.userId
          );
          this.currentRoom.participants = nextList;
          this.closePeer(msg.userId);
          if (this.onUserLeft) {
            this.onUserLeft(msg.userId, nextList);
          }
        }
        break;
      }

      case 'tab_user_updated': {
        if (msg.user && msg.user.id !== this.currentUser.id) {
          const nextList = this.currentRoom.participants.map((p) =>
            p.id === msg.user.id ? msg.user : p
          );
          this.currentRoom.participants = nextList;
          if (this.onUserUpdated) {
            this.onUserUpdated(msg.user);
          }
        }
        break;
      }

      case 'tab_peer_face_data': {
        if (msg.userId && msg.userId !== this.currentUser.id) {
          if (this.onPeerFaceData) {
            this.onPeerFaceData(msg.userId, msg.features);
          }
        }
        break;
      }

      case 'tab_chat_message': {
        if (msg.message && msg.message.userId !== this.currentUser.id) {
          if (this.onChatMessage) {
            this.onChatMessage(msg.message);
          }
        }
        break;
      }

      case 'tab_room_lock': {
        this.currentRoom.isLocked = !!msg.isLocked;
        if (this.onRoomLockChanged) {
          this.onRoomLockChanged(!!msg.isLocked);
        }
        break;
      }

      case 'tab_force_mute': {
        if (msg.targetUserId === this.currentUser.id) {
          this.currentUser.isMuted = !!msg.isMuted;
          if (this.onForceMute) {
            this.onForceMute(!!msg.isMuted);
          }
        }
        break;
      }

      case 'tab_kick_user': {
        if (msg.targetUserId === this.currentUser.id) {
          this.cleanup();
          if (this.onKicked) {
            this.onKicked(msg.reason || 'Has sido expulsado de la sala');
          }
        }
        break;
      }
    }
  }

  cleanup() {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }

    this.burstTimeouts.forEach((t) => clearTimeout(t));
    this.burstTimeouts = [];

    if (this.mqttClient && this.currentRoom && this.currentUser) {
      try {
        this.publishMeshMessage({
          type: 'user_left',
          roomId: this.currentRoom.id,
          userId: this.currentUser.id,
        });
        this.mqttClient.end(true);
      } catch (e) {
        // Ignored
      }
      this.mqttClient = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        // Ignored
      }
      this.peer = null;
    }

    this.peerDataConnections.clear();
    this.peerMediaCalls.clear();

    if (this.supabaseChannel) {
      const supabase = getSupabaseClient();
      if (supabase) {
        supabase.removeChannel(this.supabaseChannel);
      }
      this.supabaseChannel = null;
    }

    if (this.currentRoom && this.currentUser) {
      try {
        this.broadcastChannel?.postMessage({
          type: 'tab_user_left',
          roomId: this.currentRoom.id,
          userId: this.currentUser.id,
        });
      } catch (e) {
        // Ignored
      }
    }

    this.socketPeerConnections.forEach((pc) => pc.close());
    this.socketPeerConnections.clear();
    this.remoteAudioElements.forEach((el) => {
      el.srcObject = null;
    });
    this.remoteAudioElements.clear();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentUser = null;
    this.currentRoom = null;
    this.peerHeartbeats.clear();
  }
}

export const networkServiceSingleton = new NetworkService();
