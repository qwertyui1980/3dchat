/**
 * DiagnosticLogService - Sistema de Telemetría, Detección de Errores y Diagnóstico IA para Producción
 * 
 * Captura y centraliza todos los fallos en cliente:
 * - Excepciones no capturadas (window.onerror)
 * - Rechazos de promesas no manejados (unhandledrejection)
 * - Intercepción de console.error y console.warn críticos (Three.js, WebGL, MediaPipe, WebRTC, Audio)
 * - Breadcrumbs de acciones recientes del usuario para reconstruir la secuencia de fallos
 * - Deduplicación de errores recurrentes (evita desbordamientos en bucles a 60 FPS)
 * - Almacenamiento local en IndexedDB y transmisión automática al servidor (/api/logs/telemetry)
 * - Generador de reporte estructurado en Markdown formateado específicamente para consumo de IA
 */

export type ErrorSeverity = 'fatal' | 'error' | 'warn' | 'info';

export type ErrorCategory =
  | 'webgl'
  | 'webrtc'
  | 'mediapipe'
  | 'audio'
  | 'network'
  | 'model3d'
  | 'react'
  | 'storage'
  | 'general';

export interface Breadcrumb {
  timestamp: number;
  category: string;
  message: string;
  data?: Record<string, any>;
}

export interface TelemetryLogEntry {
  id: string;
  timestamp: number;
  isoTime: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  count: number;
  firstSeen: number;
  lastSeen: number;
  route: string;
  hash: string;
  context: {
    userId?: string;
    userName?: string;
    userRole?: string;
    roomId?: string;
    avatarId?: string;
    trackingMode?: string;
    isMicActive?: boolean;
    isCameraActive?: boolean;
    deviceInfo: {
      userAgent: string;
      platform: string;
      screenResolution: string;
      pixelRatio: number;
      hardwareConcurrency?: number;
      memoryLimitMB?: number;
      gpuVendor?: string;
      gpuRenderer?: string;
      connectionType?: string;
    };
  };
  breadcrumbs: Breadcrumb[];
}

class DiagnosticLogService {
  private logs: TelemetryLogEntry[] = [];
  private breadcrumbs: Breadcrumb[] = [];
  private readonly maxLogs = 150;
  private readonly maxBreadcrumbs = 25;
  private isInitialized = false;
  private flushTimer: any = null;
  private pendingFlush: TelemetryLogEntry[] = [];
  private listeners = new Set<(entry: TelemetryLogEntry) => void>();

  // Contexto dinámico de la sesión
  private currentContext: {
    userId?: string;
    userName?: string;
    userRole?: string;
    roomId?: string;
    avatarId?: string;
    trackingMode?: string;
    isMicActive?: boolean;
    isCameraActive?: boolean;
  } = {};

  private gpuInfoCache: { vendor: string; renderer: string } | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // 1. Captura de errores globales no manejados
    window.addEventListener('error', (event: ErrorEvent) => {
      this.recordError({
        message: event.message || 'Error no controlado de JavaScript',
        stack: event.error?.stack,
        sourceFile: event.filename,
        lineNumber: event.lineno,
        columnNumber: event.colno,
        severity: 'error',
        category: this.classifyError(event.message, event.error?.stack),
      });
    });

    // 2. Captura de promesas rechazadas no manejadas
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let msg = 'Unhandled Promise Rejection';
      let stack: string | undefined;

      if (reason instanceof Error) {
        msg = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        msg = reason;
      } else if (reason && typeof reason === 'object') {
        try {
          msg = JSON.stringify(reason);
        } catch (_) {
          msg = String(reason);
        }
      }

      this.recordError({
        message: msg,
        stack,
        severity: 'error',
        category: this.classifyError(msg, stack),
      });
    });

    // 3. Intercepción prudente de console.error para capturar fallos de Three.js, MediaPipe y WebGL
    const originalConsoleError = console.error.bind(console);
    console.error = (...args: any[]) => {
      try {
        const errorMsg = args
          .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'object' ? JSON.stringify(a) : String(a)))
          .join(' ');

        // Evitar bucles infinitos de telemetría si el logger mismo escribe a consola
        if (!errorMsg.includes('[Telemetry]') && !errorMsg.includes('[DiagnosticLogService]')) {
          const firstErr = args.find((a) => a instanceof Error);
          this.recordError({
            message: errorMsg.slice(0, 800),
            stack: firstErr?.stack,
            severity: 'error',
            category: this.classifyError(errorMsg, firstErr?.stack),
          });
        }
      } catch (_) {}
      originalConsoleError(...args);
    };

    // 4. Intercepción de console.warn para advertencias críticas
    const originalConsoleWarn = console.warn.bind(console);
    console.warn = (...args: any[]) => {
      try {
        const warnMsg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
        // Capturar solo warnings críticos que impactan renderizado 3D o audio
        if (
          warnMsg.includes('WebGL') ||
          warnMsg.includes('MediaPipe') ||
          warnMsg.includes('WebRTC') ||
          warnMsg.includes('AudioContext') ||
          warnMsg.includes('transcoder') ||
          warnMsg.includes('Custom model load')
        ) {
          this.recordError({
            message: warnMsg.slice(0, 600),
            severity: 'warn',
            category: this.classifyError(warnMsg),
          });
        }
      } catch (_) {}
      originalConsoleWarn(...args);
    };

    // 5. Envío de telemetría pendiente al cerrar o descargar la página
    window.addEventListener('pagehide', () => {
      this.flushToServer(true);
    });

    // 6. Recuperar logs previos de IndexedDB/localStorage
    this.restoreLocalLogs();

    this.addBreadcrumb('system', 'Sistema de telemetría de errores iniciado');
  }

  /**
   * Actualiza el contexto actual (usuario, sala, avatar, hardware)
   */
  public updateContext(ctx: Partial<typeof this.currentContext>) {
    this.currentContext = { ...this.currentContext, ...ctx };
  }

  /**
   * Registra un breadcrumb (hito de navegación o acción del usuario)
   */
  public addBreadcrumb(category: string, message: string, data?: Record<string, any>) {
    const crumb: Breadcrumb = {
      timestamp: Date.now(),
      category,
      message,
      data,
    };
    this.breadcrumbs.push(crumb);
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Clasifica automáticamente la categoría técnica del error
   */
  private classifyError(message: string = '', stack: string = ''): ErrorCategory {
    const combined = `${message} ${stack}`.toLowerCase();
    if (combined.includes('webgl') || combined.includes('three') || combined.includes('shader') || combined.includes('context lost')) {
      return 'webgl';
    }
    if (combined.includes('webrtc') || combined.includes('peer') || combined.includes('dataconnection') || combined.includes('mediaconnection')) {
      return 'webrtc';
    }
    if (combined.includes('mediapipe') || combined.includes('vision') || combined.includes('landmarker') || combined.includes('wasm')) {
      return 'mediapipe';
    }
    if (combined.includes('audio') || combined.includes('mic') || combined.includes('audiocontext')) {
      return 'audio';
    }
    if (combined.includes('socket') || combined.includes('mqtt') || combined.includes('fetch') || combined.includes('network') || combined.includes('supabase')) {
      return 'network';
    }
    if (combined.includes('gltf') || combined.includes('glb') || combined.includes('obj') || combined.includes('stl') || combined.includes('model')) {
      return 'model3d';
    }
    if (combined.includes('react') || combined.includes('minified react error') || combined.includes('usestate') || combined.includes('useeffect')) {
      return 'react';
    }
    if (combined.includes('indexeddb') || combined.includes('quota') || combined.includes('localstorage')) {
      return 'storage';
    }
    return 'general';
  }

  /**
   * Obtiene información acelerada por hardware de la GPU (vía WebGL debug info)
   */
  private getGpuInfo(): { vendor: string; renderer: string } {
    if (this.gpuInfoCache) return this.gpuInfoCache;
    if (typeof document === 'undefined') return { vendor: 'unknown', renderer: 'unknown' };

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          this.gpuInfoCache = {
            vendor: (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown',
            renderer: (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown',
          };
          return this.gpuInfoCache;
        }
      }
    } catch (_) {}

    this.gpuInfoCache = { vendor: 'Generic', renderer: 'WebGL' };
    return this.gpuInfoCache;
  }

  /**
   * Registra un nuevo error con deduplicación y contexto extendido
   */
  public recordError(params: {
    message: string;
    stack?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    severity?: ErrorSeverity;
    category?: ErrorCategory;
  }) {
    const now = Date.now();
    const cleanMsg = (params.message || 'Error desconocido').trim();
    const cleanStack = params.stack ? params.stack.trim() : undefined;
    const severity = params.severity || 'error';
    const category = params.category || this.classifyError(cleanMsg, cleanStack);

    // Clave de firma para deduplicar errores idénticos recurrentes
    const signature = `${category}:${cleanMsg.slice(0, 150)}:${params.sourceFile || ''}:${params.lineNumber || 0}`;

    const existing = this.logs.find((entry) => `${entry.category}:${entry.message.slice(0, 150)}:${entry.sourceFile || ''}:${entry.lineNumber || 0}` === signature);

    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
      if (cleanStack && !existing.stack) existing.stack = cleanStack;
      this.scheduleFlush(existing);
      return existing;
    }

    const gpu = this.getGpuInfo();
    const nav = typeof navigator !== 'undefined' ? navigator : ({} as any);

    const entry: TelemetryLogEntry = {
      id: `err_${now}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now,
      isoTime: new Date(now).toISOString(),
      severity,
      category,
      message: cleanMsg,
      stack: cleanStack,
      sourceFile: params.sourceFile,
      lineNumber: params.lineNumber,
      columnNumber: params.columnNumber,
      count: 1,
      firstSeen: now,
      lastSeen: now,
      route: typeof window !== 'undefined' ? window.location.pathname : '/',
      hash: typeof window !== 'undefined' ? window.location.hash : '',
      context: {
        ...this.currentContext,
        deviceInfo: {
          userAgent: nav.userAgent || 'Unknown',
          platform: nav.platform || 'Unknown',
          screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
          pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
          hardwareConcurrency: nav.hardwareConcurrency,
          memoryLimitMB: (nav as any).deviceMemory ? (nav as any).deviceMemory * 1024 : undefined,
          gpuVendor: gpu.vendor,
          gpuRenderer: gpu.renderer,
          connectionType: (nav as any).connection?.effectiveType,
        },
      },
      breadcrumbs: [...this.breadcrumbs],
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Persistir en memoria local
    this.persistLocalLogs();

    // Notificar listeners reactivos (ej. modal en vivo de administración)
    this.notifyListeners(entry);

    // Programar envío al servidor
    this.scheduleFlush(entry);

    return entry;
  }

  private scheduleFlush(entry: TelemetryLogEntry) {
    if (!this.pendingFlush.some((e) => e.id === entry.id)) {
      this.pendingFlush.push(entry);
    }

    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushToServer(false);
    }, 1500);
  }

  /**
   * Envía los errores acumulados al servidor (/api/logs/telemetry)
   */
  public async flushToServer(isUnloading = false) {
    if (this.pendingFlush.length === 0 || typeof window === 'undefined') return;

    const payload = [...this.pendingFlush];
    this.pendingFlush = [];

    const url = '/api/logs/telemetry';
    const bodyStr = JSON.stringify({
      clientTimestamp: Date.now(),
      batchSize: payload.length,
      errors: payload,
    });

    if (isUnloading && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([bodyStr], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
      } catch (_) {}
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true,
      });
    } catch (_) {
      // Re-encolar si falló el envío y no es descarga de página
      if (!isUnloading) {
        this.pendingFlush.push(...payload);
      }
    }
  }

  private persistLocalLogs() {
    if (typeof localStorage === 'undefined') return;
    try {
      const serialized = JSON.stringify(this.logs.slice(0, 30));
      localStorage.setItem('xstreamx_error_telemetry', serialized);
    } catch (_) {}
  }

  private restoreLocalLogs() {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem('xstreamx_error_telemetry');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.logs = parsed;
        }
      }
    } catch (_) {}
  }

  public getLogs(): TelemetryLogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
    this.pendingFlush = [];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('xstreamx_error_telemetry');
    }
  }

  public subscribe(fn: (entry: TelemetryLogEntry) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notifyListeners(entry: TelemetryLogEntry) {
    this.listeners.forEach((fn) => {
      try {
        fn(entry);
      } catch (_) {}
    });
  }

  /**
   * Genera un reporte exhaustivo estructurado en Markdown listo para ser copiado o consultado por la IA
   */
  public generateAiDiagnosticReport(): string {
    const total = this.logs.length;
    const categories: Record<string, number> = {};
    const severities: Record<string, number> = {};

    this.logs.forEach((log) => {
      categories[log.category] = (categories[log.category] || 0) + log.count;
      severities[log.severity] = (severities[log.severity] || 0) + log.count;
    });

    const now = new Date().toISOString();
    let md = `# Reporte de Diagnóstico y Telemetría de Errores (XStreamX AI Diagnostic)\n\n`;
    md += `> **Generado el:** ${now}  \n`;
    md += `> **Total de Incidentes Registrados:** ${total} eventos agrupados  \n`;
    md += `> **Estado de Producción:** ${total === 0 ? '🟢 Saludable (Sin Errores Detectados)' : severities['fatal'] ? '🔴 Crítico' : '🟡 Alertas Activas'}  \n\n`;

    md += `## 1. Resumen Ejecutivo por Categoría y Severidad\n\n`;
    md += `| Categoría | Ocurrencias | Severidad | Impacto en Sistema |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    Object.keys(categories).forEach((cat) => {
      const count = categories[cat];
      const sev = this.logs.find((l) => l.category === cat)?.severity || 'error';
      const impactDesc =
        cat === 'webgl'
          ? 'Renderizado 3D y Shaders'
          : cat === 'webrtc'
          ? 'Mesh P2P y Audio en Vivo'
          : cat === 'mediapipe'
          ? 'Visión Artificial y Blendshapes'
          : cat === 'audio'
          ? 'Captura de Micrófono Web Audio'
          : cat === 'network'
          ? 'Socket.io, MQTT y Supabase'
          : cat === 'model3d'
          ? 'Carga de GLB/OBJ/STL de Avatares'
          : 'Ejecución General de Aplicación';
      md += `| **${cat.toUpperCase()}** | ${count} | \`${sev}\` | ${impactDesc} |\n`;
    });

    md += `\n---\n\n## 2. Errores Recientes y Clústeres de Fallo para la IA\n\n`;

    if (this.logs.length === 0) {
      md += `*No hay errores registrados en la sesión actual. El entorno opera con normalidad.*\n`;
    } else {
      this.logs.slice(0, 15).forEach((log, index) => {
        md += `### [${index + 1}] [${log.severity.toUpperCase()}] [${log.category.toUpperCase()}] ${log.message.slice(0, 120)}\n\n`;
        md += `* **Ocurrencias:** ${log.count} vez(ces)  \n`;
        md += `* **Primera Detección:** ${new Date(log.firstSeen).toLocaleTimeString()} | **Última:** ${new Date(log.lastSeen).toLocaleTimeString()}  \n`;
        md += `* **Ruta Activa:** \`${log.route}${log.hash}\`  \n`;
        md += `* **Usuario / Sala:** \`${log.context.userName || 'Anónimo'} (${log.context.userRole || 'invitado'})\` en sala \`${log.context.roomId || 'ninguna'}\`  \n`;
        md += `* **Avatar Activo:** \`${log.context.avatarId || 'ninguno'}\` | **Modo Tracking:** \`${log.context.trackingMode || 'ninguno'}\`  \n`;
        md += `* **Hardware:** \`${log.context.deviceInfo.platform} | ${log.context.deviceInfo.screenResolution} | GPU: ${log.context.deviceInfo.gpuRenderer || 'N/A'}\`  \n`;

        if (log.sourceFile) {
          md += `* **Archivo:** \`${log.sourceFile}:${log.lineNumber || 0}:${log.columnNumber || 0}\`  \n`;
        }

        if (log.stack) {
          md += `\n**Stack Trace:**\n\`\`\`text\n${log.stack.slice(0, 800)}\n\`\`\`\n`;
        }

        if (log.breadcrumbs && log.breadcrumbs.length > 0) {
          md += `\n**Secuencia de Acciones Previas (Breadcrumbs):**\n`;
          log.breadcrumbs.slice(-5).forEach((b) => {
            md += `- \`[${new Date(b.timestamp).toLocaleTimeString()}] [${b.category}]\` ${b.message}\n`;
          });
        }
        md += `\n`;
      });
    }

    md += `---\n\n## 3. Instrucciones de Análisis para la IA\n\n`;
    md += `1. **Identificar Causa Raíz:** Compara el mensaje de error con el componente involucrado (Three.js, MediaPipe, AudioService, NetworkService, etc.).\n`;
    md += `2. **Verificar Estado de Red:** Comprueba si el fallo se originó por desconexión de Socket.io, broker MQTT no accesible o caída de Supabase.\n`;
    md += `3. **Comprobar Recursos 3D:** Si el fallo es en \`model3d\` o \`webgl\`, revisa si el formato del archivo es válido o si faltan texturas/materiales.\n`;

    return md;
  }
}

export const diagnosticLogServiceSingleton = new DiagnosticLogService();
