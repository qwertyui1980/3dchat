import React, { useEffect, useRef, useState } from 'react';
import { RoomMediaState, VideoQueueItem } from '../../types';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipForward,
  Volume2,
  Volume1,
  VolumeX,
  AlertCircle,
  Shield,
  Search,
  Plus,
} from 'lucide-react';
import { extractYouTubeVideoId, fetchYouTubeVideoInfo } from '../../utils/youtube';

interface YouTubeSyncPlayerProps {
  mediaState: RoomMediaState;
  currentUserRole?: 'admin' | 'participant';
  onTogglePlayback: (isPlaying: boolean, currentTime: number) => void;
  onSeek: (currentTime: number) => void;
  onVideoEnded: () => void;
  onSkip?: () => void;
  onAddVideo?: (item: VideoQueueItem) => void;
  volume?: number;
  isMuted?: boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiLoadedPromise: Promise<void> | null = null;

function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject();
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (apiLoadedPromise) {
    return apiLoadedPromise;
  }

  apiLoadedPromise = new Promise((resolve) => {
    const existingScript = document.getElementById('yt-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevOnReady) prevOnReady();
      resolve();
    };

    // Fallback interval check
    const checkInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 200);
  });

  return apiLoadedPromise;
}

function formatTime(seconds: number): string {
  const s = Math.floor(seconds || 0);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const YouTubeSyncPlayer: React.FC<YouTubeSyncPlayerProps> = ({
  mediaState,
  currentUserRole = 'participant',
  onTogglePlayback,
  onSeek,
  onVideoEnded,
  onSkip,
  onAddVideo,
  volume = 80,
  isMuted = false,
}) => {
  const containerId = useRef(`yt_player_${Math.random().toString(36).substring(2, 9)}`);
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [needsAutoplayInteraction, setNeedsAutoplayInteraction] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isHoveringControls, setIsHoveringControls] = useState(false);
  const [quickSearchUrl, setQuickSearchUrl] = useState('');
  const [isAddingQuickVideo, setIsAddingQuickVideo] = useState(false);

  const lastTargetVideoIdRef = useRef<string | null>(null);
  const isSyncingInternalRef = useRef(false);

  const currentVideo = mediaState.currentVideo;
  const isAdmin = currentUserRole === 'admin';

  // Initialize YT Player once API is ready
  useEffect(() => {
    let isMounted = true;

    loadYouTubeIframeApi().then(() => {
      if (!isMounted) return;

      const player = new window.YT.Player(containerId.current, {
        host: 'https://www.youtube-nocookie.com',
        height: '100%',
        width: '100%',
        videoId: currentVideo?.videoId || '',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
          widget_referrer: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            if (!isMounted) return;
            playerRef.current = event.target;
            setIsPlayerReady(true);
            lastTargetVideoIdRef.current = currentVideo?.videoId || null;

            // Compute elapsed time from sync timestamp
            if (mediaState.currentVideo) {
              const elapsed = mediaState.isPlaying
                ? Math.max(0, (Date.now() - mediaState.lastSyncTimestamp) / 1000 + mediaState.playbackTime)
                : mediaState.playbackTime;
              event.target.seekTo(elapsed, true);
              if (mediaState.isPlaying) {
                const playPromise = event.target.playVideo();
                if (playPromise && typeof playPromise.catch === 'function') {
                  playPromise.catch(() => setNeedsAutoplayInteraction(true));
                }
              } else {
                event.target.pauseVideo();
              }

              try {
                if (isMuted || volume === 0) {
                  event.target.mute();
                } else {
                  event.target.unMute();
                  event.target.setVolume(Math.min(100, Math.max(0, volume)));
                }
              } catch (_) {}
            }
          },
          onStateChange: (event: any) => {
            if (isSyncingInternalRef.current) return;

            // Video ended -> Trigger cue next video
            if (event.data === window.YT.PlayerState.ENDED) {
              onVideoEnded();
            } else if (event.data === window.YT.PlayerState.PLAYING) {
              setNeedsAutoplayInteraction(false);
              const curTime = event.target.getCurrentTime() || 0;
              setCurrentTime(curTime);
              if (!mediaState.isPlaying) {
                onTogglePlayback(true, curTime);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              const curTime = event.target.getCurrentTime() || 0;
              setCurrentTime(curTime);
              if (mediaState.isPlaying) {
                onTogglePlayback(false, curTime);
              }
            }
          },
          onError: (err: any) => {
            console.warn('[YouTubeSyncPlayer] Player error:', err);
            // If video is restricted or cannot embed, auto-skip after 2.5s
            setTimeout(() => {
              onVideoEnded();
            }, 2500);
          },
        },
      });
    });

    return () => {
      isMounted = false;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (_) {}
      }
    };
  }, []);

  // Handle changing video ID
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    const player = playerRef.current;
    const targetVideoId = currentVideo?.videoId || null;

    if (targetVideoId && targetVideoId !== lastTargetVideoIdRef.current) {
      lastTargetVideoIdRef.current = targetVideoId;
      isSyncingInternalRef.current = true;

      const elapsed = mediaState.isPlaying
        ? Math.max(0, (Date.now() - mediaState.lastSyncTimestamp) / 1000 + mediaState.playbackTime)
        : mediaState.playbackTime;

      player.loadVideoById({
        videoId: targetVideoId,
        startSeconds: Math.floor(elapsed),
      });

      if (mediaState.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }

      setTimeout(() => {
        isSyncingInternalRef.current = false;
      }, 800);
    } else if (!targetVideoId) {
      player.stopVideo();
      lastTargetVideoIdRef.current = null;
    }
  }, [currentVideo?.videoId, isPlayerReady]);

  // Real-time Drift Sync Interval & Time Polling (every 500ms)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !currentVideo) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const actualTime = player.getCurrentTime() || 0;
      setCurrentTime(actualTime);

      const d = player.getDuration() || 0;
      if (d > 0 && d !== duration) {
        setDuration(d);
      }

      const expectedTime = mediaState.isPlaying
        ? Math.max(0, (Date.now() - mediaState.lastSyncTimestamp) / 1000 + mediaState.playbackTime)
        : mediaState.playbackTime;

      // If drift is greater than 2.2 seconds, gently seekTo
      if (Math.abs(actualTime - expectedTime) > 2.2) {
        isSyncingInternalRef.current = true;
        player.seekTo(expectedTime, true);
        setTimeout(() => {
          isSyncingInternalRef.current = false;
        }, 500);
      }

      // Check play/pause state consistency
      const playerState = player.getPlayerState();
      if (mediaState.isPlaying && playerState === window.YT.PlayerState.PAUSED) {
        player.playVideo();
      } else if (!mediaState.isPlaying && playerState === window.YT.PlayerState.PLAYING) {
        player.pauseVideo();
      }
    }, 600);

    return () => clearInterval(interval);
  }, [isPlayerReady, mediaState, currentVideo, duration]);

  // Real-time local volume & mute controller
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;
    try {
      if (isMuted || volume === 0) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(Math.min(100, Math.max(0, volume)));
      }
    } catch (_) {}
  }, [isPlayerReady, volume, isMuted]);

  const handleManualPlayAudio = () => {
    if (playerRef.current) {
      try {
        if (!isMuted && volume > 0) {
          playerRef.current.unMute();
          playerRef.current.setVolume(Math.min(100, Math.max(0, volume)));
        }
      } catch (_) {}
      playerRef.current.playVideo();
      setNeedsAutoplayInteraction(false);
    }
  };

  // Playback Control Handlers (Admin Control)
  const handleTogglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin && currentUserRole !== 'admin') return;
    const targetState = !mediaState.isPlaying;
    if (playerRef.current) {
      if (targetState) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    }
    onTogglePlayback(targetState, currentTime);
  };

  const handleRewind = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin && currentUserRole !== 'admin') return;
    const target = Math.max(0, currentTime - 10);
    if (playerRef.current) {
      playerRef.current.seekTo(target, true);
    }
    onSeek(target);
  };

  const handleForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin && currentUserRole !== 'admin') return;
    const target = Math.min(duration || currentTime + 10, currentTime + 10);
    if (playerRef.current) {
      playerRef.current.seekTo(target, true);
    }
    onSeek(target);
  };

  const handleSeekSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    setCurrentTime(target);
    if (playerRef.current) {
      playerRef.current.seekTo(target, true);
    }
    onSeek(target);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearchUrl.trim() || !onAddVideo) return;
    const videoId = extractYouTubeVideoId(quickSearchUrl);
    if (!videoId) return;

    setIsAddingQuickVideo(true);
    try {
      const info = await fetchYouTubeVideoInfo(quickSearchUrl);
      if (info) {
        onAddVideo({
          id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          url: info.cleanUrl,
          videoId: info.videoId,
          title: info.title,
          thumbnailUrl: info.thumbnailUrl,
          addedByUserId: 'admin',
          addedByUserName: 'Administrador',
          addedAt: Date.now(),
        });
        setQuickSearchUrl('');
      }
    } catch (_) {}
    setIsAddingQuickVideo(false);
  };

  return (
    <div
      onMouseEnter={() => setIsHoveringControls(true)}
      onMouseLeave={() => setIsHoveringControls(false)}
      className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center select-none group/player"
    >
      {/* Target container for YT.Player iframe */}
      <div id={containerId.current} className="w-full h-full pointer-events-none" />

      {/* Autoplay / Unmute Prompt Overlay (browser policy) */}
      {needsAutoplayInteraction && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center animate-fade-in">
          <AlertCircle className="w-8 h-8 text-amber-400 mb-2 animate-bounce" />
          <p className="text-white text-sm font-semibold mb-1">
            Transmisión en vivo sincronizada
          </p>
          <p className="text-neutral-400 text-xs mb-4 max-w-xs">
            Haz clic para activar el audio de YouTube y sincronizarte con la sala.
          </p>
          <button
            onClick={handleManualPlayAudio}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/30 transition active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Sincronizar y Activar Audio</span>
          </button>
        </div>
      )}

      {/* Empty State when no video is playing */}
      {!currentVideo && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#09090f] p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-3 shadow-inner">
            <Play className="w-6 h-6 text-neutral-500 ml-0.5" />
          </div>
          <h4 className="text-white text-sm font-bold mb-1">
            Home Theater en Espera
          </h4>
          <p className="text-neutral-400 text-xs max-w-sm">
            No hay ningún video en reproducción. Usa el botón de <strong className="text-cyan-300">Playlist</strong> para pegar un enlace de YouTube.
          </p>
        </div>
      )}

      {/* ADMIN & ROOM PLAYBACK CONTROL BAR (HUD OVERLAY) */}
      {currentVideo && (
        <div
          className={`absolute inset-x-0 bottom-0 z-30 p-2 sm:p-3 bg-gradient-to-t from-black/95 via-black/80 to-transparent transition-opacity duration-300 ${
            isHoveringControls || !mediaState.isPlaying ? 'opacity-100' : 'opacity-0 hover:opacity-100'
          }`}
        >
          {/* Progress Seek Scrubber Bar */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono text-neutral-300 min-w-[32px]">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              disabled={!isAdmin && currentUserRole !== 'admin'}
              onChange={handleSeekSlider}
              className={`flex-1 h-1.5 bg-white/20 rounded-lg accent-cyan-400 ${
                isAdmin ? 'cursor-pointer hover:h-2 transition-all' : 'cursor-default opacity-80'
              }`}
              title={isAdmin ? 'Arrastrar para buscar / retroceder en el video' : 'Posición de video'}
            />
            <span className="text-[10px] font-mono text-neutral-400 min-w-[32px] text-right">
              {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Left Controls: Play/Pause, Rewind -10s, Forward +10s, Skip */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Play / Pause Toggle */}
              <button
                type="button"
                onClick={handleTogglePlayPause}
                disabled={!isAdmin && currentUserRole !== 'admin'}
                className={`p-2 rounded-xl border transition active:scale-95 flex items-center justify-center ${
                  isAdmin
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 border-cyan-400 cursor-pointer shadow-md shadow-cyan-500/20'
                    : 'bg-white/10 text-neutral-400 border-white/10 cursor-not-allowed opacity-60'
                }`}
                title={
                  isAdmin
                    ? mediaState.isPlaying
                      ? 'Pausar video (Admin)'
                      : 'Reanudar video (Admin)'
                    : 'Solo el administrador puede pausar/reproducir'
                }
              >
                {mediaState.isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Rewind -10s */}
              <button
                type="button"
                onClick={handleRewind}
                disabled={!isAdmin && currentUserRole !== 'admin'}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10 text-white border border-white/10 transition active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                title="Retroceder 10 segundos (Admin)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">10s</span>
              </button>

              {/* Forward +10s */}
              <button
                type="button"
                onClick={handleForward}
                disabled={!isAdmin && currentUserRole !== 'admin'}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-white/10 text-white border border-white/10 transition active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                title="Adelantar 10 segundos (Admin)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">10s</span>
              </button>

              {/* Skip to Next Video */}
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={!isAdmin && currentUserRole !== 'admin'}
                  className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 transition active:scale-95 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                  title="Saltar al siguiente video de la playlist (Admin)"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Saltar</span>
                </button>
              )}
            </div>

            {/* Right: Quick URL Search Input for Admin & Status Badge */}
            <div className="flex items-center gap-2">
              {isAdmin && onAddVideo && (
                <form onSubmit={handleQuickAddSubmit} className="hidden sm:flex items-center gap-1">
                  <input
                    type="text"
                    value={quickSearchUrl}
                    onChange={(e) => setQuickSearchUrl(e.target.value)}
                    placeholder="Pegar link YouTube..."
                    className="w-36 lg:w-44 px-2 py-1 rounded-lg bg-black/60 border border-white/15 text-[11px] text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="submit"
                    disabled={isAddingQuickVideo || !quickSearchUrl.trim()}
                    className="p-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition cursor-pointer"
                    title="Reproducir / Agregar video a la cola"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
