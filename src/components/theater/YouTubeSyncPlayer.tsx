import React, { useEffect, useRef, useState } from 'react';
import { RoomMediaState } from '../../types';
import { Play, AlertCircle } from 'lucide-react';

interface YouTubeSyncPlayerProps {
  mediaState: RoomMediaState;
  currentUserRole?: 'admin' | 'participant';
  onTogglePlayback: (isPlaying: boolean, currentTime: number) => void;
  onSeek: (currentTime: number) => void;
  onVideoEnded: () => void;
  onSkip?: () => void;
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

export const YouTubeSyncPlayer: React.FC<YouTubeSyncPlayerProps> = ({
  mediaState,
  currentUserRole = 'participant',
  onTogglePlayback,
  onSeek,
  onVideoEnded,
  onSkip,
  volume = 80,
  isMuted = false,
}) => {
  const containerId = useRef(`yt_player_${Math.random().toString(36).substring(2, 9)}`);
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [needsAutoplayInteraction, setNeedsAutoplayInteraction] = useState(false);
  const lastTargetVideoIdRef = useRef<string | null>(null);
  const isSyncingInternalRef = useRef(false);

  const currentVideo = mediaState.currentVideo;

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
              if (!mediaState.isPlaying) {
                onTogglePlayback(true, curTime);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              const curTime = event.target.getCurrentTime() || 0;
              if (mediaState.isPlaying) {
                onTogglePlayback(false, curTime);
              }
            }
          },
          onError: (err: any) => {
            console.warn('[YouTubeSyncPlayer] Player error:', err);
            // If video is restricted or cannot embed, auto-skip after 2s
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

  // Real-time Drift Sync Interval (every 1.5 seconds)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !currentVideo) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const expectedTime = mediaState.isPlaying
        ? Math.max(0, (Date.now() - mediaState.lastSyncTimestamp) / 1000 + mediaState.playbackTime)
        : mediaState.playbackTime;

      const actualTime = player.getCurrentTime();

      // If drift is greater than 2 seconds, gently seekTo
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
    }, 1500);

    return () => clearInterval(interval);
  }, [isPlayerReady, mediaState, currentVideo]);

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

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center select-none">
      {/* Target container for YT.Player iframe */}
      <div id={containerId.current} className="w-full h-full pointer-events-none" />

      {/* Transparent shield overlay completely blocking click/tap interaction on the video player */}
      <div className="absolute inset-0 z-10 pointer-events-auto bg-transparent" />

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
            No hay ningún video en reproducción. Usa el botón de <strong className="text-cyan-300">Playlist</strong> para pegar un enlace de YouTube y tomar tu turno.
          </p>
        </div>
      )}
    </div>
  );
};
