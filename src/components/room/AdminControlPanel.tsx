import React from 'react';
import {
  Shield,
  X,
  VolumeX,
  Volume2,
  UserX,
  Lock,
  Unlock,
  Radio,
  Cpu,
  Zap,
} from 'lucide-react';
import { RoomInfo, User } from '../../types';

interface AdminControlPanelProps {
  room: RoomInfo;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  onAdminMute: (userId: string, state: boolean) => void;
  onAdminKick: (userId: string) => void;
  onToggleLock: (locked: boolean) => void;
  onMuteAll: () => void;
}

export const AdminControlPanel: React.FC<AdminControlPanelProps> = ({
  room,
  currentUser,
  isOpen,
  onClose,
  onAdminMute,
  onAdminKick,
  onToggleLock,
  onMuteAll,
}) => {
  if (!isOpen) return null;

  const otherParticipants = room.participants.filter((p) => p.id !== currentUser.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Panel de Administración</h3>
              <p className="text-xs text-slate-400">
                Sala <span className="font-mono text-cyan-400 uppercase font-semibold">{room.id}</span> • Moderación en vivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          {/* Quick Global Actions Bar */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Acciones Globales de Sala
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {/* Mute All */}
              <button
                onClick={onMuteAll}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition active:scale-98"
              >
                <VolumeX className="w-4 h-4 text-rose-400" />
                <span>Silenciar a Todos</span>
              </button>

              {/* Toggle Lock */}
              <button
                onClick={() => onToggleLock(!room.isLocked)}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition active:scale-98 ${
                  room.isLocked
                    ? 'bg-rose-950/80 border-rose-700 text-rose-300 hover:bg-rose-900'
                    : 'bg-emerald-950/80 border-emerald-700 text-emerald-300 hover:bg-emerald-900'
                }`}
              >
                {room.isLocked ? (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Desbloquear Sala</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>Bloquear Acceso</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Participants List & Moderation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Participantes Conectados ({room.participants.length})
              </h4>
            </div>

            <div className="space-y-2">
              {/* Current Admin (Self) */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-amber-500/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <div>
                    <span className="text-xs font-bold text-white">{currentUser.name} (Tú)</span>
                    <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                      Admin Anfitrión
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Control total</span>
              </div>

              {/* Other Participants */}
              {otherParticipants.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-slate-500 text-xs">
                  No hay otros participantes en la sala aún. Comparte el código de sala con otros usuarios.
                </div>
              ) : (
                otherParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          participant.isMuted ? 'bg-rose-400' : 'bg-emerald-400'
                        }`}
                      />
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-200 truncate">{participant.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Avatar: {participant.avatarId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Mute/Unmute */}
                      <button
                        onClick={() => onAdminMute(participant.id, !participant.isMuted)}
                        className={`p-2 rounded-lg border text-xs transition ${
                          participant.isMuted
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                        title={participant.isMuted ? 'Desmutear usuario' : 'Silenciar micrófono'}
                      >
                        {participant.isMuted ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Kick */}
                      <button
                        onClick={() => onAdminKick(participant.id)}
                        className="p-2 rounded-lg bg-rose-950/50 hover:bg-rose-900/70 text-rose-400 border border-rose-800/60 transition"
                        title="Expulsar participante de la sala"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Privacy & Performance Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-800/40 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 text-xs font-bold">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Eficiencia y Privacidad XStreamX</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              En lugar de transmitir video a 2-5 Mbps por usuario, cada participante transmite paquetes vectoriales comprimidos de menos de <strong className="text-cyan-300">3 KB/s</strong>. Máxima privacidad: la cámara física procesa los landmarks localmente en el navegador y nunca se expone a terceros.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
};
