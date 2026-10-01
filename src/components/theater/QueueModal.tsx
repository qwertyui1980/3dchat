import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Play,
  Trash2,
  SkipForward,
  Clock,
  Sparkles,
  Tv,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { RoomMediaState, VideoQueueItem, User } from '../../types';
import { extractYouTubeVideoId, fetchYouTubeVideoInfo } from '../../utils/youtube';

interface QueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaState: RoomMediaState;
  currentUser: User;
  onAddVideo: (item: VideoQueueItem) => void;
  onRemoveVideo: (itemId: string) => void;
  onSkipVideo: () => void;
  onRequestSync?: () => void;
}

export const QueueModal: React.FC<QueueModalProps> = ({
  isOpen,
  onClose,
  mediaState,
  currentUser,
  onAddVideo,
  onRemoveVideo,
  onSkipVideo,
  onRequestSync,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && onRequestSync) {
      onRequestSync();
    }
  }, [isOpen, onRequestSync]);

  if (!isOpen) return null;

  const currentVideo = mediaState.currentVideo;
  const queue = mediaState.queue;

  // Determine user's turn in the cue / playlist
  const isUserPlayingNow = currentVideo?.addedByUserId === currentUser.id;
  const userQueueIndex = queue.findIndex((item) => item.addedByUserId === currentUser.id);
  const hasVideoInQueue = userQueueIndex !== -1;
  const userTurnNumber = hasVideoInQueue ? userQueueIndex + 1 : null;

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const videoId = extractYouTubeVideoId(urlInput);
    if (!videoId) {
      setErrorMsg('El enlace no es un video válido de YouTube. Ejemplo: https://www.youtube.com/watch?v=...');
      return;
    }

    setIsLoadingInfo(true);
    try {
      const info = await fetchYouTubeVideoInfo(urlInput);
      if (!info) {
        setErrorMsg('No se pudo obtener información del video. Por favor verifica el enlace.');
        setIsLoadingInfo(false);
        return;
      }

      const newItem: VideoQueueItem = {
        id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url: info.cleanUrl,
        videoId: info.videoId,
        title: info.title,
        thumbnailUrl: info.thumbnailUrl,
        addedByUserId: currentUser.id,
        addedByUserName: currentUser.name,
        addedAt: Date.now(),
      };

      onAddVideo(newItem);
      setUrlInput('');
      setErrorMsg(null);
    } catch (_) {
      setErrorMsg('Error al conectar con YouTube. Intenta nuevamente.');
    } finally {
      setIsLoadingInfo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-xl rounded-2xl bg-[#0c0c16] border border-white/[0.12] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#10101c]/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Playlist Home Theater</span>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-black uppercase">
                  Sincronizado
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                Comparte videos de YouTube para ver en grupo en tiempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          {/* Personal Turn Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-center gap-3 ${
              isUserPlayingNow
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : hasVideoInQueue
                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                : 'bg-white/[0.04] border-white/[0.08] text-neutral-300'
            }`}
          >
            {isUserPlayingNow ? (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                <Play className="w-4 h-4 text-emerald-400 fill-current" />
              </div>
            ) : hasVideoInQueue ? (
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 font-black text-xs text-cyan-300">
                #{userTurnNumber}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-neutral-400" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {isUserPlayingNow
                  ? '¡Tu video se está reproduciendo ahora!'
                  : hasVideoInQueue
                  ? `Tu turno en la playlist: Puesto #${userTurnNumber}`
                  : 'Turno disponible'}
              </h4>
              <p className="text-[11px] text-neutral-400 truncate">
                {isUserPlayingNow
                  ? 'Todos en el espacio están viendo tu video en vivo.'
                  : hasVideoInQueue
                  ? userTurnNumber === 1
                    ? 'Tu video es el siguiente en reproducirse al terminar el actual.'
                    : `Faltan ${userTurnNumber} videos antes de que inicie el tuyo.`
                  : 'Pega un enlace de YouTube para agregar tu video al final de la cola.'}
              </p>
            </div>
          </div>

          {/* Add YouTube URL Input Form */}
          <form onSubmit={handleAddUrl} className="space-y-2">
            <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
              <span>Agregar video de YouTube a la cola</span>
              <span className="text-[10px] text-cyan-400 font-mono">Pega el link o ID</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
              />
              <button
                type="submit"
                disabled={isLoadingInfo || !urlInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {isLoadingInfo ? (
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </>
                )}
              </button>
            </div>
            {errorMsg && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </p>
            )}
          </form>

          {/* Current Video Section */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5 flex items-center justify-between">
              <span>Reproduciéndose Ahora</span>
              {currentVideo && (
                <button
                  type="button"
                  onClick={onSkipVideo}
                  className="text-[11px] font-semibold text-neutral-400 hover:text-amber-300 flex items-center gap-1 transition"
                  title="Saltar al siguiente video"
                >
                  <SkipForward className="w-3 h-3" />
                  <span>Saltar</span>
                </button>
              )}
            </h4>

            {currentVideo ? (
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center gap-3">
                <img
                  src={currentVideo.thumbnailUrl}
                  alt={currentVideo.title}
                  className="w-20 h-12 object-cover rounded-lg shrink-0 border border-white/10"
                />
                <div className="min-w-0 flex-1">
                  <h5 className="text-xs font-bold text-white truncate leading-snug">
                    {currentVideo.title}
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-0.5 truncate flex items-center gap-1">
                    <span>Agregado por:</span>
                    <strong className="text-cyan-300">{currentVideo.addedByUserName}</strong>
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center text-xs text-neutral-500">
                La pantalla está libre. ¡Sé el primero en agregar un video!
              </div>
            )}
          </div>

          {/* Up Next / Playlist Queue List */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2.5 flex items-center justify-between">
              <span>Próximos en Lista ({queue.length})</span>
            </h4>

            {queue.length === 0 ? (
              <p className="text-xs text-neutral-500 italic p-3 text-center bg-white/[0.01] rounded-xl border border-white/5">
                No hay más videos en cola.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {queue.map((item, index) => {
                  const isMine = item.addedByUserId === currentUser.id;
                  const canDelete = isMine || currentUser.role === 'admin';

                  return (
                    <div
                      key={item.id}
                      className={`p-2.5 rounded-xl border flex items-center gap-3 transition ${
                        isMine
                          ? 'bg-cyan-950/20 border-cyan-500/30'
                          : 'bg-white/[0.03] border-white/[0.06] hover:border-white/15'
                      }`}
                    >
                      <span className="w-5 text-center font-bold text-xs text-neutral-400 shrink-0">
                        #{index + 1}
                      </span>
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-16 h-10 object-cover rounded-md shrink-0 border border-white/10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-white truncate leading-snug">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
                          Por: <span className="text-cyan-300">{item.addedByUserName}</span>
                          {isMine && <span className="ml-1 text-cyan-400 font-bold">(Tú)</span>}
                        </p>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onRemoveVideo(item.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer shrink-0"
                          title="Quitar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
