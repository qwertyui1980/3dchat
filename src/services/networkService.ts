import { io, Socket } from 'socket.io-client';
import mqtt, { MqttClient } from 'mqtt';
import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { RealtimeChannel } from '@supabase/supabase-js';
import { User, RoomInfo, FaceFeatures, ChatMessage, AvatarId, VideoQueueItem, RoomMediaState, WhiteboardStroke } from '../types';
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

  public currentMediaState: RoomMediaState = {
    currentVideo: null,
    queue: [],
    isPlaying: false,
    playbackTime: 0,
    lastSyncTimestamp: 0,
    syncedByUserId: '',
  };

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
  public onMediaStateChanged: ((state: RoomMediaState) => void) | null = null;
  public onWhiteboardStroke: ((stroke: WhiteboardStroke) => void) | null = null;
  public onWhiteboardClear: (() => void) | null = null;
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
          if (this.currentRoom && this.currentUser) {
            this.socket.emit('join_room', {
              roomId: this.currentRoom.id,
              userId: this.currentUser.id,
              userName: this.currentUser.name,
              avatarId: this.currentUser.avatarId,
              createAsAdmin: this.currentUser.role === 'admin',
            });
            this.socket.emit('request_media_sync');
          }
        });

        this.socket.on('user_joined', ({ user, participants }: { user: User; participants: User[] }) => {
          if (this.currentRoom) {
            this.currentRoom.participants = this.deduplicateParticipants(participants);
          }
          if (this.onUserJoined) this.onUserJoined(user, this.currentRoom?.participants || participants);
        });

        this.socket.on('user_left', ({ userId, participants }: { userId: string; participants: User[] }) => {
          if (this.currentRoom) {
            this.currentRoom.participants = this.deduplicateParticipants(participants);
          }
          this.closePeer(userId);
          if (this.onUserLeft) this.onUserLeft(userId, this.currentRoom?.participants || participants);
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

        this.socket.on('force_mute', ({ targetUserId, isMuted }: { targetUserId?: string; isMuted: boolean }) => {
          const targetId = targetUserId || this.currentUser?.id;
          if (this.currentRoom && targetId) {
            this.currentRoom.participants = this.currentRoom.participants.map((p) => {
              if (p.id === targetId) {
                const updated = { ...p, isMuted };
                if (this.onUserUpdated) this.onUserUpdated(updated);
                return updated;
              }
              return p;
            });
            this.updateRemoteAudioMuteState(targetId, isMuted);
          }
          if (!targetUserId || targetUserId === this.currentUser?.id) {
            if (this.currentUser) this.currentUser.isMuted = isMuted;
            if (this.onForceMute) this.onForceMute(isMuted);
          }
        });

        this.socket.on('force_mute_all', ({ isMuted }: { isMuted: boolean }) => {
          if (this.currentRoom) {
            this.currentRoom.isAllMuted = isMuted;
            this.currentRoom.participants = this.currentRoom.participants.map((p) => {
              if (p.role !== 'admin') {
                const updated = { ...p, isMuted };
                if (this.onUserUpdated) this.onUserUpdated(updated);
                return updated;
              }
              return p;
            });
            this.updateAllRemoteAudioMuteState(isMuted);
          }
          if (this.currentUser && this.currentUser.role !== 'admin') {
            if (this.currentUser) this.currentUser.isMuted = isMuted;
            if (this.onForceMute) this.onForceMute(isMuted);
          }
        });

        this.socket.on('kicked_from_room', ({ reason }: { reason: string }) => {
          this.cleanup();
          if (this.onKicked) this.onKicked(reason);
        });

        this.socket.on('all_users_updated', ({ participants }: { participants: User[] }) => {
          if (this.currentRoom) {
            this.currentRoom.participants = this.deduplicateParticipants(participants);
          }
          if (this.currentUser) {
            const selfInList = participants.find((p) => p.id === this.currentUser?.id);
            if (selfInList) {
              this.currentUser = { ...selfInList };
            }
          }
          participants.forEach((user) => {
            if (this.onUserUpdated) this.onUserUpdated(user);
          });
        });

        this.socket.on('media_state_sync', (state: RoomMediaState) => {
          if (state && typeof state === 'object') {
            this.currentMediaState = { ...state };
            if (this.onMediaStateChanged) this.onMediaStateChanged({ ...this.currentMediaState });
          }
        });

        this.socket.on('media_queue_add', ({ item, state }: { item?: VideoQueueItem; state?: RoomMediaState }) => {
          if (state) {
            this.currentMediaState = { ...state };
          } else if (item) {
            if (!this.currentMediaState.currentVideo) {
              this.currentMediaState = {
                ...this.currentMediaState,
                currentVideo: item,
                isPlaying: true,
                playbackTime: 0,
                lastSyncTimestamp: Date.now(),
                syncedByUserId: item.addedByUserId,
              };
            } else if (!this.currentMediaState.queue.some((q) => q.id === item.id)) {
              this.currentMediaState = {
                ...this.currentMediaState,
                queue: [...this.currentMediaState.queue, item],
              };
            }
          }
          if (this.onMediaStateChanged) this.onMediaStateChanged({ ...this.currentMediaState });
        });

        this.socket.on('media_queue_remove', ({ itemId, state }: { itemId?: string; state?: RoomMediaState }) => {
          if (state) {
            this.currentMediaState = { ...state };
          } else if (itemId) {
            this.currentMediaState = {
              ...this.currentMediaState,
              queue: this.currentMediaState.queue.filter((q) => q.id !== itemId),
            };
          }
          if (this.onMediaStateChanged) this.onMediaStateChanged({ ...this.currentMediaState });
        });

        this.socket.on('media_queue_skip', ({ state }: { state?: RoomMediaState }) => {
          if (state) {
            this.currentMediaState = { ...state };
          } else {
            const next = this.currentMediaState.queue.shift() || null;
            this.currentMediaState = {
              ...this.currentMediaState,
              currentVideo: next,
              queue: this.currentMediaState.queue,
              isPlaying: !!next,
              playbackTime: 0,
              lastSyncTimestamp: Date.now(),
            };
          }
          if (this.onMediaStateChanged) this.onMediaStateChanged({ ...this.currentMediaState });
        });

        this.socket.on('room_status_changed', (status: { isOpen: boolean; room: any }) => {
          if (this.onRoomStatusChanged) this.onRoomStatusChanged(status);
        });

        this.socket.on('whiteboard_stroke', (stroke: WhiteboardStroke) => {
          if (stroke && stroke.userId !== this.currentUser?.id && this.onWhiteboardStroke) {
            this.onWhiteboardStroke(stroke);
          }
        });

        this.socket.on('whiteboard_clear', () => {
          if (this.onWhiteboardClear) {
            this.onWhiteboardClear();
          }
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
      name: `Espacio ${cleanRoomId.toUpperCase()}`,
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
        userId: localUser.id,
        userName: cleanUserName,
        avatarId,
        createAsAdmin,
      });
    }
  }

  // --- PARTICIPANT DEDUPLICATION ENGINE ---
  public deduplicateParticipants(list: User[]): User[] {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const result: User[] = [];

    // Always put currentUser first if present
    const self = this.currentUser;
    if (self) {
      seenIds.add(self.id);
      if (self.name) seenNames.add(self.name.trim().toLowerCase());
      result.push(self);
    }

    for (const u of list) {
      if (!u || !u.id) continue;
      const cleanName = (u.name || '').trim().toLowerCase();
      // Skip if it represents currentUser
      if (self && (u.id === self.id || (cleanName && cleanName === self.name.trim().toLowerCase()))) {
        continue;
      }
      if (!seenIds.has(u.id) && (!cleanName || !seenNames.has(cleanName))) {
        seenIds.add(u.id);
        if (cleanName) seenNames.add(cleanName);
        result.push(u);
      }
    }
    return result;
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
      // Immediately send active media state to newcomer via WebRTC
      if (this.currentMediaState.currentVideo || this.currentMediaState.queue.length > 0) {
        try {
          conn.send({
            type: 'media_state_sync',
            state: this.currentMediaState,
          });
        } catch (_) {}
      }
    });

    conn.on('data', (data: any) => {
      if (!data || typeof data !== 'object') return;
      if (data.type === 'peer_face_data' && data.userId && data.features) {
        if (this.onPeerFaceData) {
          this.onPeerFaceData(data.userId, data.features);
        }
      } else if (data.type === 'media_state_sync' && data.state) {
        this.currentMediaState = { ...data.state };
        if (this.onMediaStateChanged) {
          this.onMediaStateChanged({ ...this.currentMediaState });
        }
      } else if (data.type === 'media_queue_add') {
        const item = data.item as VideoQueueItem;
        if (item) {
          if (!this.currentMediaState.currentVideo) {
            this.currentMediaState = {
              ...this.currentMediaState,
              currentVideo: item,
              isPlaying: true,
              playbackTime: 0,
              lastSyncTimestamp: Date.now(),
              syncedByUserId: item.addedByUserId,
            };
          } else if (!this.currentMediaState.queue.some((q) => q.id === item.id)) {
            this.currentMediaState = {
              ...this.currentMediaState,
              queue: [...this.currentMediaState.queue, item],
            };
          }
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        }
      } else if (data.type === 'media_queue_remove' && data.itemId) {
        this.currentMediaState = {
          ...this.currentMediaState,
          queue: this.currentMediaState.queue.filter((q) => q.id !== data.itemId),
        };
        if (this.onMediaStateChanged) {
          this.onMediaStateChanged({ ...this.currentMediaState });
        }
      } else if (data.type === 'media_queue_skip') {
        const nextQueue = [...this.currentMediaState.queue];
        const nextVideo = nextQueue.shift() || null;
        this.currentMediaState = {
          ...this.currentMediaState,
          currentVideo: nextVideo,
          queue: nextQueue,
          isPlaying: !!nextVideo,
          playbackTime: 0,
          lastSyncTimestamp: Date.now(),
        };
        if (this.onMediaStateChanged) {
          this.onMediaStateChanged({ ...this.currentMediaState });
        }
      } else if (data.type === 'request_media_sync') {
        if (this.currentMediaState.currentVideo || this.currentMediaState.queue.length > 0) {
          try {
            conn.send({
              type: 'media_state_sync',
              state: this.currentMediaState,
            });
          } catch (_) {}
        }
      } else if (data.type === 'whiteboard_stroke' && data.stroke) {
        if (data.stroke.userId !== this.currentUser?.id && this.onWhiteboardStroke) {
          this.onWhiteboardStroke(data.stroke);
        }
      } else if (data.type === 'whiteboard_clear') {
        if (this.onWhiteboardClear) {
          this.onWhiteboardClear();
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

  private updateRemoteAudioMuteState(userId: string, isMuted: boolean) {
    if (!this.currentRoom) return;
    const peerId = this.getPeerJsId(this.currentRoom.id, userId);
    const audioEl = this.remoteAudioElements.get(peerId);
    if (audioEl) {
      audioEl.muted = isMuted;
    }
  }

  private updateAllRemoteAudioMuteState(muteState: boolean) {
    if (!this.currentRoom || !this.currentUser) return;
    this.currentRoom.participants.forEach((p) => {
      if (p.id !== this.currentUser?.id && p.role !== 'admin') {
        const peerId = this.getPeerJsId(this.currentRoom!.id, p.id);
        const audioEl = this.remoteAudioElements.get(peerId);
        if (audioEl) {
          audioEl.muted = muteState;
        }
      }
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

      if (this.currentRoom) {
        const participant = this.currentRoom.participants.find(
          (p) => this.getPeerJsId(this.currentRoom!.id, p.id) === call.peer
        );
        if (participant) {
          audioEl.muted = !!participant.isMuted;
        }
      }

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
    const senderName = (msg.user?.name || msg.message?.userName || '').trim().toLowerCase();
    const selfName = (this.currentUser.name || '').trim().toLowerCase();
    if (senderId === this.currentUser.id || (senderName && senderName === selfName)) return;

    if (senderId) {
      this.peerHeartbeats.set(senderId, Date.now());
    }

    switch (msg.type) {
      case 'who_is_here': {
        if (msg.user && msg.user.id !== this.currentUser.id && msg.user.name?.trim().toLowerCase() !== selfName) {
          // Immediately respond with our presence so the new peer discovers us
          this.publishMeshMessage({
            type: 'presence_sync',
            roomId: this.currentRoom.id,
            user: this.currentUser,
          });

          // Add new user if not already in participants
          const exists = this.currentRoom.participants.some(
            (p) => p.id === msg.user.id || (p.name && msg.user.name && p.name.trim().toLowerCase() === msg.user.name.trim().toLowerCase())
          );
          if (!exists) {
            const nextList = this.deduplicateParticipants([...this.currentRoom.participants, msg.user]);
            this.currentRoom.participants = nextList;
            this.connectToPeerP2P(msg.user);
            if (this.onUserJoined) {
              this.onUserJoined(msg.user, nextList);
            }
          }

          // Sync active media to newcomer
          if (this.currentMediaState.currentVideo || this.currentMediaState.queue.length > 0) {
            this.publishMeshMessage({
              type: 'media_state_sync',
              roomId: this.currentRoom.id,
              state: this.currentMediaState,
            });
          }
        }
        break;
      }

      case 'presence_sync':
      case 'presence_beacon':
      case 'user_joined': {
        if (msg.user && msg.user.id !== this.currentUser.id && msg.user.name?.trim().toLowerCase() !== selfName) {
          const existingIdx = this.currentRoom.participants.findIndex(
            (p) => p.id === msg.user.id || (p.name && msg.user.name && p.name.trim().toLowerCase() === msg.user.name.trim().toLowerCase())
          );
          if (existingIdx === -1) {
            const nextList = this.deduplicateParticipants([...this.currentRoom.participants, msg.user]);
            this.currentRoom.participants = nextList;
            this.connectToPeerP2P(msg.user);
            if (this.onUserJoined) {
              this.onUserJoined(msg.user, nextList);
            }

            // Sync active media to newly joined peer
            if (this.currentMediaState.currentVideo || this.currentMediaState.queue.length > 0) {
              this.publishMeshMessage({
                type: 'media_state_sync',
                roomId: this.currentRoom.id,
                state: this.currentMediaState,
              });
            }
          } else {
            // Update participant details if changed
            const updated = [...this.currentRoom.participants];
            updated[existingIdx] = { ...updated[existingIdx], ...msg.user };
            this.currentRoom.participants = this.deduplicateParticipants(updated);
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

      case 'media_state_sync': {
        if (msg.state && typeof msg.state === 'object') {
          this.currentMediaState = { ...msg.state };
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        }
        break;
      }

      case 'media_queue_add': {
        const item = msg.item as VideoQueueItem;
        if (item) {
          if (!this.currentMediaState.currentVideo) {
            this.currentMediaState = {
              ...this.currentMediaState,
              currentVideo: item,
              isPlaying: true,
              playbackTime: 0,
              lastSyncTimestamp: Date.now(),
              syncedByUserId: item.addedByUserId,
            };
          } else if (!this.currentMediaState.queue.some((q) => q.id === item.id)) {
            this.currentMediaState = {
              ...this.currentMediaState,
              queue: [...this.currentMediaState.queue, item],
            };
          }
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        } else if (msg.state) {
          this.currentMediaState = { ...msg.state };
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        }
        break;
      }

      case 'media_queue_remove': {
        if (msg.itemId) {
          this.currentMediaState = {
            ...this.currentMediaState,
            queue: this.currentMediaState.queue.filter((q) => q.id !== msg.itemId),
          };
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        }
        break;
      }

      case 'media_queue_skip': {
        const nextQueue = [...this.currentMediaState.queue];
        const nextVideo = nextQueue.shift() || null;
        this.currentMediaState = {
          ...this.currentMediaState,
          currentVideo: nextVideo,
          queue: nextQueue,
          isPlaying: !!nextVideo,
          playbackTime: 0,
          lastSyncTimestamp: Date.now(),
        };
        if (this.onMediaStateChanged) {
          this.onMediaStateChanged({ ...this.currentMediaState });
        }
        break;
      }

      case 'request_media_sync': {
        if (this.currentMediaState.currentVideo || this.currentMediaState.queue.length > 0) {
          this.publishMeshMessage({
            type: 'media_state_sync',
            roomId: this.currentRoom?.id,
            state: this.currentMediaState,
          });
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
        if (this.currentRoom) {
          this.currentRoom.participants = this.currentRoom.participants.map((p) => {
            if (p.id === msg.targetUserId) {
              const updated = { ...p, isMuted: !!msg.isMuted };
              if (this.onUserUpdated) this.onUserUpdated(updated);
              return updated;
            }
            return p;
          });
          this.updateRemoteAudioMuteState(msg.targetUserId, !!msg.isMuted);
        }
        if (msg.targetUserId === this.currentUser?.id) {
          if (this.currentUser) this.currentUser.isMuted = !!msg.isMuted;
          if (this.onForceMute) {
            this.onForceMute(!!msg.isMuted);
          }
        }
        break;
      }

      case 'force_mute_all': {
        if (this.currentRoom) {
          this.currentRoom.isAllMuted = !!msg.isMuted;
          this.currentRoom.participants = this.currentRoom.participants.map((p) => {
            if (p.role !== 'admin') {
              const updated = { ...p, isMuted: !!msg.isMuted };
              if (this.onUserUpdated) this.onUserUpdated(updated);
              return updated;
            }
            return p;
          });
          this.updateAllRemoteAudioMuteState(!!msg.isMuted);
        }
        if (this.currentUser && this.currentUser.role !== 'admin') {
          if (this.currentUser) this.currentUser.isMuted = !!msg.isMuted;
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
            this.onKicked(msg.reason || 'Has sido expulsado del espacio');
          }
        }
        break;
      }

      case 'whiteboard_stroke': {
        if (msg.stroke && msg.stroke.userId !== this.currentUser?.id) {
          if (this.onWhiteboardStroke) {
            this.onWhiteboardStroke(msg.stroke);
          }
        }
        break;
      }

      case 'whiteboard_clear': {
        if (this.onWhiteboardClear) {
          this.onWhiteboardClear();
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
        .on('broadcast', { event: 'media_state_sync' }, ({ payload }) => {
          if (payload && payload.state) {
            this.currentMediaState = { ...payload.state };
            if (this.onMediaStateChanged) {
              this.onMediaStateChanged(this.currentMediaState);
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
          if (this.currentRoom) {
            this.currentRoom.participants = this.currentRoom.participants.map((p) => {
              if (p.id === payload.targetUserId) {
                const updated = { ...p, isMuted: !!payload.isMuted };
                if (this.onUserUpdated) this.onUserUpdated(updated);
                return updated;
              }
              return p;
            });
            this.updateRemoteAudioMuteState(payload.targetUserId, !!payload.isMuted);
          }
          if (payload.targetUserId === this.currentUser?.id) {
            if (this.currentUser) this.currentUser.isMuted = !!payload.isMuted;
            if (this.onForceMute) this.onForceMute(!!payload.isMuted);
          }
        })
        .on('broadcast', { event: 'force_mute_all' }, ({ payload }) => {
          if (this.currentRoom) {
            this.currentRoom.isAllMuted = !!payload.isMuted;
            this.currentRoom.participants = this.currentRoom.participants.map((p) => {
              if (p.role !== 'admin') {
                const updated = { ...p, isMuted: !!payload.isMuted };
                if (this.onUserUpdated) this.onUserUpdated(updated);
                return updated;
              }
              return p;
            });
            this.updateAllRemoteAudioMuteState(!!payload.isMuted);
          }
          if (this.currentUser && this.currentUser.role !== 'admin') {
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
        .on('broadcast', { event: 'whiteboard_stroke' }, ({ payload }) => {
          if (payload && payload.stroke && payload.stroke.userId !== this.currentUser?.id) {
            if (this.onWhiteboardStroke) {
              this.onWhiteboardStroke(payload.stroke);
            }
          }
        })
        .on('broadcast', { event: 'whiteboard_clear' }, () => {
          if (this.onWhiteboardClear) {
            this.onWhiteboardClear();
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
    if (this.currentRoom) {
      this.currentRoom.participants = this.currentRoom.participants.map((p) => {
        if (p.id === targetUserId) {
          const updated = { ...p, isMuted: muteState };
          if (this.onUserUpdated) this.onUserUpdated(updated);
          return updated;
        }
        return p;
      });
      this.updateRemoteAudioMuteState(targetUserId, muteState);
    }

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

  adminMuteAll(muteState: boolean) {
    if (this.currentRoom) {
      this.currentRoom.isAllMuted = muteState;
      this.currentRoom.participants = this.currentRoom.participants.map((p) => {
        if (p.role !== 'admin') {
          const updated = { ...p, isMuted: muteState };
          if (this.onUserUpdated) this.onUserUpdated(updated);
          return updated;
        }
        return p;
      });
      this.updateAllRemoteAudioMuteState(muteState);
    }

    this.publishMeshMessage({
      type: 'force_mute_all',
      roomId: this.currentRoom?.id,
      isMuted: muteState,
    });

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'force_mute_all',
      payload: { isMuted: muteState },
    });

    this.socket?.emit('admin_mute_all', { muteState });

    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_force_mute_all',
        roomId: this.currentRoom.id,
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
        reason: reason || 'Expulsado del espacio',
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

  // --- 4. MEDIA / YOUTUBE THEATER SYNCHRONIZATION ---
  syncMediaState(newState: RoomMediaState) {
    this.currentMediaState = { ...newState };
    if (this.onMediaStateChanged) {
      this.onMediaStateChanged(this.currentMediaState);
    }

    // 1. Direct WebRTC DataChannels to all connected peers
    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({
            type: 'media_state_sync',
            state: this.currentMediaState,
          });
        } catch (_) {}
      }
    });

    // 2. Global Real-time Mesh (MQTT)
    this.publishMeshMessage({
      type: 'media_state_sync',
      roomId: this.currentRoom?.id,
      state: this.currentMediaState,
    });

    // 3. Supabase Realtime
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'media_state_sync',
      payload: { state: this.currentMediaState },
    });

    // 4. Socket.io
    this.socket?.emit('media_state_sync', this.currentMediaState);

    // 5. Cross-tab BroadcastChannel
    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_media_state_sync',
        roomId: this.currentRoom.id,
        state: this.currentMediaState,
      });
    }
  }

  addMediaQueueItem(item: VideoQueueItem) {
    const isFirstVideo = !this.currentMediaState.currentVideo;
    let nextCurrent = this.currentMediaState.currentVideo;
    let nextQueue = [...this.currentMediaState.queue];

    if (isFirstVideo) {
      nextCurrent = item;
    } else {
      if (!nextQueue.some((it) => it.id === item.id)) {
        nextQueue.push(item);
      }
    }

    const nextState: RoomMediaState = {
      ...this.currentMediaState,
      currentVideo: nextCurrent,
      queue: nextQueue,
      isPlaying: isFirstVideo ? true : this.currentMediaState.isPlaying,
      playbackTime: isFirstVideo ? 0 : this.currentMediaState.playbackTime,
      lastSyncTimestamp: Date.now(),
      syncedByUserId: this.currentUser?.id || '',
    };

    this.currentMediaState = { ...nextState };
    if (this.onMediaStateChanged) {
      this.onMediaStateChanged({ ...this.currentMediaState });
    }

    const payload = {
      type: 'media_queue_add',
      roomId: this.currentRoom?.id,
      item,
      state: nextState,
    };

    // 1. Direct WebRTC DataChannels to all peers
    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
          conn.send({ type: 'media_state_sync', state: nextState });
        } catch (_) {}
      }
    });

    // 2. Global MQTT Mesh
    this.publishMeshMessage(payload);

    // 3. Supabase Realtime
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'media_queue_add',
      payload: { item, state: nextState },
    });

    // 4. Socket.io
    this.socket?.emit('media_queue_add', { item, state: nextState });
    this.socket?.emit('media_state_sync', nextState);

    // 5. BroadcastChannel
    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_media_queue_add',
        roomId: this.currentRoom.id,
        item,
        state: nextState,
      });
    }
  }

  removeMediaQueueItem(itemId: string) {
    const nextQueue = this.currentMediaState.queue.filter((it) => it.id !== itemId);
    const nextState: RoomMediaState = {
      ...this.currentMediaState,
      queue: nextQueue,
      lastSyncTimestamp: Date.now(),
      syncedByUserId: this.currentUser?.id || '',
    };

    this.currentMediaState = { ...nextState };
    if (this.onMediaStateChanged) {
      this.onMediaStateChanged({ ...this.currentMediaState });
    }

    const payload = {
      type: 'media_queue_remove',
      roomId: this.currentRoom?.id,
      itemId,
      state: nextState,
    };

    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
          conn.send({ type: 'media_state_sync', state: nextState });
        } catch (_) {}
      }
    });

    this.publishMeshMessage(payload);

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'media_queue_remove',
      payload: { itemId, state: nextState },
    });

    this.socket?.emit('media_queue_remove', { itemId, state: nextState });
    this.socket?.emit('media_state_sync', nextState);

    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_media_queue_remove',
        roomId: this.currentRoom.id,
        itemId,
        state: nextState,
      });
    }
  }

  skipCurrentMedia() {
    const nextQueue = [...this.currentMediaState.queue];
    const nextVideo = nextQueue.shift() || null;
    const nextState: RoomMediaState = {
      ...this.currentMediaState,
      currentVideo: nextVideo,
      queue: nextQueue,
      isPlaying: !!nextVideo,
      playbackTime: 0,
      lastSyncTimestamp: Date.now(),
      syncedByUserId: this.currentUser?.id || '',
    };

    this.currentMediaState = { ...nextState };
    if (this.onMediaStateChanged) {
      this.onMediaStateChanged({ ...this.currentMediaState });
    }

    const payload = {
      type: 'media_queue_skip',
      roomId: this.currentRoom?.id,
      state: nextState,
    };

    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(payload);
          conn.send({ type: 'media_state_sync', state: nextState });
        } catch (_) {}
      }
    });

    this.publishMeshMessage(payload);

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'media_queue_skip',
      payload: { state: nextState },
    });

    this.socket?.emit('media_queue_skip', { state: nextState });
    this.socket?.emit('media_state_sync', nextState);

    if (this.currentRoom) {
      this.broadcastChannel?.postMessage({
        type: 'tab_media_queue_skip',
        roomId: this.currentRoom.id,
        state: nextState,
      });
    }
  }

  requestMediaSync() {
    if (!this.currentRoom) return;

    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({ type: 'request_media_sync' });
        } catch (_) {}
      }
    });

    this.publishMeshMessage({
      type: 'request_media_sync',
      roomId: this.currentRoom.id,
      userId: this.currentUser?.id,
    });

    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'request_media_sync',
      payload: { roomId: this.currentRoom.id },
    });

    this.socket?.emit('request_media_sync');

    this.broadcastChannel?.postMessage({
      type: 'tab_request_media_sync',
      roomId: this.currentRoom.id,
    });
  }

  toggleMediaPlayback(isPlaying: boolean, currentTime: number) {
    this.syncMediaState({
      ...this.currentMediaState,
      isPlaying,
      playbackTime: Math.max(0, currentTime),
      lastSyncTimestamp: Date.now(),
      syncedByUserId: this.currentUser?.id || '',
    });
  }

  seekMedia(currentTime: number) {
    this.syncMediaState({
      ...this.currentMediaState,
      playbackTime: Math.max(0, currentTime),
      lastSyncTimestamp: Date.now(),
      syncedByUserId: this.currentUser?.id || '',
    });
  }

  // --- 5. WHITEBOARD SYNCHRONIZATION ---
  broadcastWhiteboardStroke(stroke: WhiteboardStroke) {
    if (!this.currentRoom) return;

    // 1. PeerJS WebRTC DataChannels
    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({
            type: 'whiteboard_stroke',
            stroke,
          });
        } catch (_) {}
      }
    });

    // 2. Global MQTT Mesh
    this.publishMeshMessage({
      type: 'whiteboard_stroke',
      roomId: this.currentRoom.id,
      stroke,
    });

    // 3. Supabase Realtime
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'whiteboard_stroke',
      payload: { stroke },
    });

    // 4. Socket.io
    if (this.socket?.connected) {
      this.socket.emit('whiteboard_stroke', stroke);
    }

    // 5. Cross-tab BroadcastChannel
    this.broadcastChannel?.postMessage({
      type: 'tab_whiteboard_stroke',
      roomId: this.currentRoom.id,
      stroke,
    });
  }

  broadcastWhiteboardClear() {
    if (!this.currentRoom) return;

    // 1. PeerJS WebRTC DataChannels
    this.peerDataConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send({
            type: 'whiteboard_clear',
            roomId: this.currentRoom?.id,
          });
        } catch (_) {}
      }
    });

    // 2. Global MQTT Mesh
    this.publishMeshMessage({
      type: 'whiteboard_clear',
      roomId: this.currentRoom.id,
    });

    // 3. Supabase Realtime
    this.supabaseChannel?.send({
      type: 'broadcast',
      event: 'whiteboard_clear',
      payload: {},
    });

    // 4. Socket.io
    if (this.socket?.connected) {
      this.socket.emit('whiteboard_clear');
    }

    // 5. Cross-tab BroadcastChannel
    this.broadcastChannel?.postMessage({
      type: 'tab_whiteboard_clear',
      roomId: this.currentRoom.id,
    });
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
        const selfName = (this.currentUser.name || '').trim().toLowerCase();
        const incomingName = (msg.user?.name || '').trim().toLowerCase();
        if (msg.user && msg.user.id !== this.currentUser.id && incomingName !== selfName) {
          this.broadcastChannel?.postMessage({
            type: 'tab_sync_presence',
            roomId: this.currentRoom.id,
            user: this.currentUser,
          });

          const exists = this.currentRoom.participants.some(
            (p) => p.id === msg.user.id || (p.name && incomingName && p.name.trim().toLowerCase() === incomingName)
          );
          if (!exists) {
            const nextList = this.deduplicateParticipants([...this.currentRoom.participants, msg.user]);
            this.currentRoom.participants = nextList;
            if (this.onUserJoined) {
              this.onUserJoined(msg.user, nextList);
            }
          }

          // Sync media across tabs to newcomer
          if (this.currentMediaState.currentVideo || this.currentMediaState.queue.length > 0) {
            this.broadcastChannel?.postMessage({
              type: 'tab_media_state_sync',
              roomId: this.currentRoom.id,
              state: this.currentMediaState,
            });
          }
        }
        break;
      }

      case 'tab_sync_presence':
      case 'tab_user_joined': {
        const selfName = (this.currentUser.name || '').trim().toLowerCase();
        const incomingName = (msg.user?.name || '').trim().toLowerCase();
        if (msg.user && msg.user.id !== this.currentUser.id && incomingName !== selfName) {
          const exists = this.currentRoom.participants.some(
            (p) => p.id === msg.user.id || (p.name && incomingName && p.name.trim().toLowerCase() === incomingName)
          );
          if (!exists) {
            const nextList = this.deduplicateParticipants([...this.currentRoom.participants, msg.user]);
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

      case 'tab_media_state_sync': {
        if (msg.state && typeof msg.state === 'object') {
          this.currentMediaState = { ...msg.state };
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        }
        break;
      }

      case 'tab_media_queue_add': {
        const item = msg.item as VideoQueueItem;
        if (item) {
          if (!this.currentMediaState.currentVideo) {
            this.currentMediaState = {
              ...this.currentMediaState,
              currentVideo: item,
              isPlaying: true,
              playbackTime: 0,
              lastSyncTimestamp: Date.now(),
              syncedByUserId: item.addedByUserId,
            };
          } else if (!this.currentMediaState.queue.some((q) => q.id === item.id)) {
            this.currentMediaState = {
              ...this.currentMediaState,
              queue: [...this.currentMediaState.queue, item],
            };
          }
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        } else if (msg.state) {
          this.currentMediaState = { ...msg.state };
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        }
        break;
      }

      case 'tab_media_queue_remove': {
        if (msg.itemId) {
          this.currentMediaState = {
            ...this.currentMediaState,
            queue: this.currentMediaState.queue.filter((q) => q.id !== msg.itemId),
          };
          if (this.onMediaStateChanged) {
            this.onMediaStateChanged({ ...this.currentMediaState });
          }
        }
        break;
      }

      case 'tab_media_queue_skip': {
        const nextQueue = [...this.currentMediaState.queue];
        const nextVideo = nextQueue.shift() || null;
        this.currentMediaState = {
          ...this.currentMediaState,
          currentVideo: nextVideo,
          queue: nextQueue,
          isPlaying: !!nextVideo,
          playbackTime: 0,
          lastSyncTimestamp: Date.now(),
        };
        if (this.onMediaStateChanged) {
          this.onMediaStateChanged({ ...this.currentMediaState });
        }
        break;
      }

      case 'tab_request_media_sync': {
        if (this.currentMediaState.currentVideo || this.currentMediaState.queue.length > 0) {
          this.broadcastChannel?.postMessage({
            type: 'tab_media_state_sync',
            roomId: this.currentRoom?.id,
            state: this.currentMediaState,
          });
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
        if (this.currentRoom) {
          this.currentRoom.participants = this.currentRoom.participants.map((p) => {
            if (p.id === msg.targetUserId) {
              const updated = { ...p, isMuted: !!msg.isMuted };
              if (this.onUserUpdated) this.onUserUpdated(updated);
              return updated;
            }
            return p;
          });
          this.updateRemoteAudioMuteState(msg.targetUserId, !!msg.isMuted);
        }
        if (msg.targetUserId === this.currentUser?.id) {
          if (this.currentUser) this.currentUser.isMuted = !!msg.isMuted;
          if (this.onForceMute) {
            this.onForceMute(!!msg.isMuted);
          }
        }
        break;
      }

      case 'tab_force_mute_all': {
        if (this.currentRoom) {
          this.currentRoom.isAllMuted = !!msg.isMuted;
          this.currentRoom.participants = this.currentRoom.participants.map((p) => {
            if (p.role !== 'admin') {
              const updated = { ...p, isMuted: !!msg.isMuted };
              if (this.onUserUpdated) this.onUserUpdated(updated);
              return updated;
            }
            return p;
          });
          this.updateAllRemoteAudioMuteState(!!msg.isMuted);
        }
        if (this.currentUser && this.currentUser.role !== 'admin') {
          if (this.currentUser) this.currentUser.isMuted = !!msg.isMuted;
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
            this.onKicked(msg.reason || 'Has sido expulsado del espacio');
          }
        }
        break;
      }

      case 'tab_whiteboard_stroke': {
        if (msg.stroke && msg.stroke.userId !== this.currentUser?.id) {
          if (this.onWhiteboardStroke) {
            this.onWhiteboardStroke(msg.stroke);
          }
        }
        break;
      }

      case 'tab_whiteboard_clear': {
        if (this.onWhiteboardClear) {
          this.onWhiteboardClear();
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
    this.currentMediaState = {
      currentVideo: null,
      queue: [],
      isPlaying: false,
      playbackTime: 0,
      lastSyncTimestamp: 0,
      syncedByUserId: '',
    };
  }
}

export const networkServiceSingleton = new NetworkService();
