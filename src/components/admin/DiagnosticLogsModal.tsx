import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Bug,
  Check,
  Copy,
  Download,
  Filter,
  RefreshCw,
  Search,
  Trash2,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Cpu,
  Monitor,
  Flame,
  FileCode,
} from 'lucide-react';
import {
  diagnosticLogServiceSingleton,
  TelemetryLogEntry,
  ErrorCategory,
  ErrorSeverity,
} from '../../services/telemetry/diagnosticLogService';

interface DiagnosticLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiagnosticLogsModal: React.FC<DiagnosticLogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<TelemetryLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadLogs = async () => {
    setIsRefreshing(true);
    // 1. Obtener logs en memoria local
    const clientLogs = diagnosticLogServiceSingleton.getLogs();

    // 2. Intentar consultar logs agregados del servidor
    try {
      const res = await fetch('/api/logs/raw?limit=150');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          // Unir y deduplicar por id
          const idMap = new Map<string, TelemetryLogEntry>();
          [...clientLogs, ...data.logs].forEach((l) => {
            if (l && l.id) idMap.set(l.id, l);
          });
          const merged = Array.from(idMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
          setLogs(merged);
          setIsRefreshing(false);
          return;
        }
      }
    } catch (_) {}

    setLogs(clientLogs);
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
      const unsub = diagnosticLogServiceSingleton.subscribe(() => {
        loadLogs();
      });
      return unsub;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtrado reactivo
  const filteredLogs = logs.filter((log) => {
    if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && log.severity !== selectedSeverity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const msgMatch = log.message.toLowerCase().includes(q);
      const stackMatch = (log.stack || '').toLowerCase().includes(q);
      const fileMatch = (log.sourceFile || '').toLowerCase().includes(q);
      const userMatch = (log.context?.userName || '').toLowerCase().includes(q);
      return msgMatch || stackMatch || fileMatch || userMatch;
    }
    return true;
  });

  // Estadísticas globales
  const categoryCounts = logs.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.count;
    return acc;
  }, {} as Record<string, number>);

  const fatalCount = logs.filter((l) => l.severity === 'fatal').reduce((acc, l) => acc + l.count, 0);
  const errorCount = logs.filter((l) => l.severity === 'error').reduce((acc, l) => acc + l.count, 0);
  const warnCount = logs.filter((l) => l.severity === 'warn').reduce((acc, l) => acc + l.count, 0);

  const handleCopyAiReport = () => {
    const report = diagnosticLogServiceSingleton.generateAiDiagnosticReport();
    navigator.clipboard.writeText(report).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    });
  };

  const handleDownloadReport = () => {
    const report = diagnosticLogServiceSingleton.generateAiDiagnosticReport();
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xstreamx_ai_diagnostic_${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xstreamx_logs_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = async () => {
    if (confirm('¿Limpiar todos los registros de errores locales y del servidor?')) {
      diagnosticLogServiceSingleton.clearLogs();
      try {
        await fetch('/api/logs/clear', { method: 'POST' });
      } catch (_) {}
      setLogs([]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full h-full max-w-6xl max-h-[92vh] rounded-2xl bg-[#090b14] border border-cyan-500/40 shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-[#0e1220] border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-wide">
                  Diagnóstico y Telemetría IA
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider">
                  PRODUCCIÓN
                </span>
                {logs.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                    {logs.length} Eventos
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Detección exhaustiva de fallos en Three.js, WebGL, MediaPipe, WebRTC y red preparados para análisis de IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Copy report for AI button */}
            <button
              type="button"
              onClick={handleCopyAiReport}
              className={`py-1.5 px-3 rounded-xl border text-xs font-bold transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm ${
                copiedReport
                  ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                  : 'bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 text-white border-cyan-400/50 hover:brightness-110'
              }`}
              title="Copiar reporte Markdown completo para consultar con el Asistente IA"
            >
              {copiedReport ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>¡Copiado para la IA!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Reporte para IA</span>
                </>
              )}
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-rose-500/20 hover:text-rose-400 text-neutral-400 border border-white/[0.08] flex items-center justify-center transition cursor-pointer"
              title="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Health Metric Badges */}
        <div className="px-4 py-2.5 bg-[#0a0d18] border-b border-white/[0.06] flex items-center gap-2 sm:gap-4 overflow-x-auto shrink-0 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121626] border border-white/[0.08] text-neutral-200">
            <span className="text-neutral-400">Total Incidentes:</span>
            <span className="font-bold text-white">{logs.reduce((acc, l) => acc + l.count, 0)}</span>
          </div>

          {fatalCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Fatales: <strong>{fatalCount}</strong></span>
            </div>
          )}

          {errorCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-950/60 border border-orange-500/40 text-orange-300">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <span>Errores: <strong>{errorCount}</strong></span>
            </div>
          )}

          {warnCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-950/60 border border-yellow-500/40 text-yellow-300">
              <Bug className="w-3.5 h-3.5 text-yellow-400" />
              <span>Warnings: <strong>{warnCount}</strong></span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={loadLogs}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer"
              title="Refrescar telemetría"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={handleDownloadReport}
              className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white transition active:scale-95 cursor-pointer"
              title="Descargar reporte en Markdown (.md)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleClearLogs}
              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 transition active:scale-95 cursor-pointer"
              title="Limpiar telemetría de errores"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-3 bg-[#0c1020] border-b border-white/[0.06] flex flex-wrap items-center gap-2 shrink-0 text-xs">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar en mensajes, archivo, stack trace o usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#14192b] border border-white/[0.08] text-white placeholder-neutral-500 text-xs focus:outline-none focus:border-cyan-500/60"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-white/[0.06] text-neutral-300 hover:bg-white/[0.1]'
              }`}
            >
              Todos ({logs.length})
            </button>
            {(['webgl', 'mediapipe', 'webrtc', 'audio', 'network', 'model3d', 'react', 'server'] as ErrorCategory[]).map((cat) => {
              const count = categoryCounts[cat] || 0;
              if (count === 0 && selectedCategory !== cat) return null;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1 rounded-lg font-bold text-[11px] uppercase tracking-wider transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-white/[0.06] text-neutral-300 hover:bg-white/[0.1]'
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-2 py-1.5 rounded-xl bg-[#14192b] border border-white/[0.08] text-neutral-300 text-xs focus:outline-none cursor-pointer"
          >
            <option value="all">Todas las severidades</option>
            <option value="fatal">Fatales</option>
            <option value="error">Errores</option>
            <option value="warn">Advertencias</option>
          </select>
        </div>

        {/* Logs List Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredLogs.length === 0 ? (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center p-6 text-neutral-400">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {logs.length === 0
                  ? 'No se han detectado errores en producción'
                  : 'Ningún error coincide con los filtros aplicados'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-md">
                El sistema de telemetría monitorea activamente excepciones globales, WebGL, WebRTC y modelos 3D en segundo plano.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const sevBadgeColor =
                log.severity === 'fatal'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-600'
                  : log.severity === 'error'
                  ? 'bg-orange-950/80 text-orange-300 border-orange-600'
                  : 'bg-yellow-950/80 text-yellow-300 border-yellow-600';

              const catBadgeColor =
                log.category === 'webgl'
                  ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                  : log.category === 'mediapipe'
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                  : log.category === 'webrtc'
                  ? 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                  : log.category === 'audio'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700';

              return (
                <div
                  key={log.id}
                  className="rounded-xl bg-[#0f1324] border border-white/[0.08] hover:border-white/[0.14] transition overflow-hidden"
                >
                  {/* Summary Header */}
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="p-3 flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        className="text-neutral-500 hover:text-white mt-0.5 shrink-0"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${sevBadgeColor}`}>
                            {log.severity}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${catBadgeColor}`}>
                            {log.category}
                          </span>
                          {log.count > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/50 text-[10px] font-bold">
                              x{log.count}
                            </span>
                          )}
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {new Date(log.lastSeen).toLocaleTimeString()}
                          </span>
                          {log.sourceFile && (
                            <span className="text-[10px] text-neutral-400 font-mono truncate max-w-[220px]">
                              {log.sourceFile.split('/').pop()?.split('\\').pop()}:{log.lineNumber}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-neutral-200 font-mono break-all line-clamp-2">
                          {log.message}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-neutral-500 font-mono block">
                        Ruta: {log.route || '/'}
                      </span>
                      {log.context?.userName && (
                        <span className="text-[10px] text-cyan-400 font-semibold block truncate max-w-[120px]">
                          @{log.context.userName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/[0.06] bg-[#0b0e1b] space-y-2 text-xs animate-in fade-in">
                      {/* Context row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-1 text-[11px] text-neutral-400">
                        <div>
                          <span className="block text-neutral-500">Avatar / Tracking</span>
                          <span className="text-white font-mono">{log.context?.avatarId || 'N/A'} ({log.context?.trackingMode || 'auto'})</span>
                        </div>
                        <div>
                          <span className="block text-neutral-500">GPU / Pantalla</span>
                          <span className="text-white font-mono truncate block" title={log.context?.deviceInfo?.gpuRenderer}>
                            {log.context?.deviceInfo?.gpuRenderer || 'N/A'} ({log.context?.deviceInfo?.screenResolution || 'N/A'})
                          </span>
                        </div>
                        <div>
                          <span className="block text-neutral-500">Plataforma</span>
                          <span className="text-white font-mono">{log.context?.deviceInfo?.platform || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="block text-neutral-500">Primera vez</span>
                          <span className="text-white font-mono">{new Date(log.firstSeen).toLocaleTimeString()}</span>
                        </div>
                      </div>

                      {/* Stack Trace */}
                      {log.stack && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 flex items-center gap-1">
                            <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                            Stack Trace
                          </span>
                          <pre className="p-2.5 rounded-lg bg-[#070912] border border-white/[0.06] text-neutral-300 font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed select-text">
                            {log.stack}
                          </pre>
                        </div>
                      )}

                      {/* Breadcrumbs sequence */}
                      {log.breadcrumbs && log.breadcrumbs.length > 0 && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">
                            Secuencia de Pasos Previos (Breadcrumbs)
                          </span>
                          <div className="p-2 rounded-lg bg-[#070912] border border-white/[0.06] space-y-1">
                            {log.breadcrumbs.slice(-6).map((b, i) => (
                              <div key={i} className="flex items-center gap-2 text-[11px] text-neutral-300">
                                <span className="text-neutral-500 font-mono text-[10px]">
                                  {new Date(b.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="px-1 py-0.2 rounded bg-white/[0.06] text-neutral-400 text-[9px] uppercase font-bold">
                                  {b.category}
                                </span>
                                <span className="truncate">{b.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-[#0a0d18] border-t border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span>Endpoint API:</span>
            <a
              href="/api/logs/ai-summary"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
            >
              /api/logs/ai-summary <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadJson}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-200 text-xs font-semibold transition cursor-pointer"
            >
              Exportar JSON
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-md shadow-cyan-500/20"
            >
              Listo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
