import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  Eraser,
  Square,
  Circle,
  Minus,
  ArrowUpRight,
  Triangle,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  X,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { WhiteboardStroke, User } from '../../types';

export type DrawingTool = 'pencil' | 'eraser' | 'rect' | 'circle' | 'line' | 'arrow' | 'triangle';

interface WhiteboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onBroadcastStroke?: (stroke: WhiteboardStroke) => void;
  onBroadcastClear?: () => void;
  remoteStroke?: WhiteboardStroke | null;
  remoteClearTimestamp?: number;
}

const PRIMARY_COLORS = [
  { name: 'Rojo', hex: '#ef4444' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Amarillo', hex: '#eab308' },
  { name: 'Blanco', hex: '#ffffff' },
  { name: 'Verde', hex: '#10b981' },
  { name: 'Negro', hex: '#0f172a' },
];

const THICKNESS_OPTIONS = [
  { label: 'Extra fino', size: 2 },
  { label: 'Fino', size: 4 },
  { label: 'Medio', size: 8 },
  { label: 'Grueso', size: 14 },
  { label: 'Muy grueso', size: 24 },
];

export const WhiteboardPanel: React.FC<WhiteboardPanelProps> = ({
  isOpen,
  onClose,
  currentUser,
  onBroadcastStroke,
  onBroadcastClear,
  remoteStroke,
  remoteClearTimestamp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Tools state
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('pencil');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444'); // Default primary red
  const [lineWidth, setLineWidth] = useState<number>(4);
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  // Drawing state
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<Array<{ x: number; y: number }>>([]);
  const snapshotBeforeDragRef = useRef<ImageData | null>(null);

  // Undo / Redo history
  const undoStackRef = useRef<ImageData[]>([]);
  const redoStackRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const saveHistorySnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    try {
      const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStackRef.current.push(snap);
      if (undoStackRef.current.length > 25) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } catch (_) {}
  }, []);

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    redoStackRef.current.push(currentSnap);

    const prevSnap = undoStackRef.current.pop();
    if (prevSnap) {
      ctx.putImageData(prevSnap, 0, 0);
    }
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  };

  const handleRedo = () => {
    const canvas = canvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(currentSnap);

    const nextSnap = redoStackRef.current.pop();
    if (nextSnap) {
      ctx.putImageData(nextSnap, 0, 0);
    }
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveHistorySnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onBroadcastClear?.();
  };

  // Resize canvas according to container dimensions without losing drawing
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(300, Math.floor(rect.width));
    const height = Math.max(300, Math.floor(rect.height));

    if (canvas.width !== width || canvas.height !== height) {
      const ctx = canvas.getContext('2d');
      let tempImage: ImageData | null = null;
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        try {
          tempImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (_) {}
      }

      canvas.width = width;
      canvas.height = height;

      if (ctx && tempImage) {
        ctx.putImageData(tempImage, 0, 0);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      resizeCanvas();
      const timer = setTimeout(resizeCanvas, 150);
      window.addEventListener('resize', resizeCanvas);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [isOpen, isMaximized, resizeCanvas]);

  // Coordinate helper: normalizes coordinates to canvas space
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Drawing routines for geometric shapes & tools
  const drawStrokeOnCtx = (
    ctx: CanvasRenderingContext2D,
    tool: DrawingTool,
    color: string,
    width: number,
    points: Array<{ x: number; y: number }>
  ) => {
    if (points.length === 0) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      if (points.length === 1) {
        ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    const start = points[0];
    const end = points[points.length - 1];

    switch (tool) {
      case 'pencil': {
        ctx.beginPath();
        if (points.length === 1) {
          ctx.arc(start.x, start.y, width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.moveTo(start.x, start.y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
        }
        break;
      }

      case 'rect': {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        ctx.strokeRect(x, y, w, h);
        break;
      }

      case 'circle': {
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        const cx = Math.min(start.x, end.x) + rx;
        const cy = Math.min(start.y, end.y) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'line': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }

      case 'arrow': {
        // Draw line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Draw arrow head
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = Math.max(12, width * 2.2);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLength * Math.cos(angle - Math.PI / 6),
          end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLength * Math.cos(angle + Math.PI / 6),
          end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
      }

      case 'triangle': {
        const midX = (start.x + end.x) / 2;
        ctx.beginPath();
        ctx.moveTo(midX, start.y);
        ctx.lineTo(start.x, end.y);
        ctx.lineTo(end.x, end.y);
        ctx.closePath();
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  };

  // Pointer event listeners
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveHistorySnapshot();
    isDrawingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const pt = getCanvasCoords(e);
    currentPointsRef.current = [pt];

    // For geometric shapes, remember canvas state before drag so preview works
    if (selectedTool !== 'pencil' && selectedTool !== 'eraser') {
      try {
        snapshotBeforeDragRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (_) {}
    } else {
      drawStrokeOnCtx(ctx, selectedTool, selectedColor, lineWidth, [pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasCoords(e);

    if (selectedTool === 'pencil' || selectedTool === 'eraser') {
      currentPointsRef.current.push(pt);
      const points = currentPointsRef.current;
      // Draw segment
      const lastPt = points[points.length - 2];
      drawStrokeOnCtx(ctx, selectedTool, selectedColor, lineWidth, [lastPt, pt]);
    } else {
      // Shape preview: restore snapshot then draw current drag bounding
      if (snapshotBeforeDragRef.current) {
        ctx.putImageData(snapshotBeforeDragRef.current, 0, 0);
      }
      currentPointsRef.current = [currentPointsRef.current[0], pt];
      drawStrokeOnCtx(ctx, selectedTool, selectedColor, lineWidth, currentPointsRef.current);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasCoords(e);
    if (selectedTool !== 'pencil' && selectedTool !== 'eraser') {
      if (snapshotBeforeDragRef.current) {
        ctx.putImageData(snapshotBeforeDragRef.current, 0, 0);
        snapshotBeforeDragRef.current = null;
      }
      currentPointsRef.current = [currentPointsRef.current[0], pt];
      drawStrokeOnCtx(ctx, selectedTool, selectedColor, lineWidth, currentPointsRef.current);
    }

    // Broadcast stroke to peers in room
    if (currentPointsRef.current.length > 0 && onBroadcastStroke) {
      const strokeData: WhiteboardStroke = {
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tool: selectedTool,
        color: selectedColor,
        lineWidth,
        points: currentPointsRef.current,
        userId: currentUser.id,
      };
      onBroadcastStroke(strokeData);
    }

    currentPointsRef.current = [];
  };

  // Handle incoming remote stroke from peer
  useEffect(() => {
    if (!remoteStroke || !canvasRef.current) return;
    if (remoteStroke.userId === currentUser.id) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    drawStrokeOnCtx(
      ctx,
      remoteStroke.tool,
      remoteStroke.color,
      remoteStroke.lineWidth,
      remoteStroke.points
    );
  }, [remoteStroke, currentUser.id]);

  // Handle incoming remote clear
  useEffect(() => {
    if (!remoteClearTimestamp || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, [remoteClearTimestamp]);

  // Download whiteboard drawing as PNG
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a temporary canvas with solid background so export isn't transparent
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    exportCtx.fillStyle = isDarkTheme ? '#090d16' : '#ffffff';
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `pizarra_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 md:relative md:inset-auto flex flex-col h-full z-50 md:z-20 shrink-0 transition-all duration-200 border-l border-white/[0.08] ${
        isMaximized
          ? 'w-full md:w-full md:absolute md:inset-0 md:z-30'
          : 'w-full md:w-[420px] lg:w-[480px] xl:w-[560px]'
      } ${isDarkTheme ? 'bg-[#0a0d14]/98 text-white' : 'bg-slate-50/98 text-slate-900'} backdrop-blur-2xl shadow-2xl select-none`}
    >
      {/* 1. Header Bar */}
      <div
        className={`h-14 px-3 sm:px-4 border-b flex items-center justify-between shrink-0 ${
          isDarkTheme ? 'border-white/[0.08] bg-[#0e121d]/90' : 'border-slate-200 bg-white/90'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/20 shrink-0">
            <PenTool className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold truncate">Pizarra Interactiva</h3>
            <p className="text-[10px] text-neutral-400 truncate">Lápiz, borrador y figuras</p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Theme switcher */}
          <button
            type="button"
            onClick={() => setIsDarkTheme(!isDarkTheme)}
            className={`p-1.5 rounded-lg border text-xs transition active:scale-95 cursor-pointer ${
              isDarkTheme
                ? 'border-white/10 text-amber-300 hover:bg-white/[0.08]'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title={isDarkTheme ? 'Cambiar a pizarra clara' : 'Cambiar a pizarra oscura'}
          >
            {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            className={`p-1.5 rounded-lg border text-xs transition active:scale-95 cursor-pointer ${
              isDarkTheme
                ? 'border-white/10 text-cyan-300 hover:bg-white/[0.08]'
                : 'border-slate-200 text-cyan-700 hover:bg-slate-100'
            }`}
            title="Descargar dibujo en PNG"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Maximize toggle */}
          <button
            type="button"
            onClick={() => setIsMaximized(!isMaximized)}
            className={`p-1.5 rounded-lg border text-xs transition active:scale-95 cursor-pointer hidden md:flex ${
              isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title={isMaximized ? 'Restaurar panel' : 'Maximizar pizarra'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-95 cursor-pointer"
            title="Cerrar pizarra"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Top Toolbar (Tools, Shapes, Colors, Stroke Width, Actions) */}
      <div
        className={`px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 ${
          isDarkTheme ? 'border-white/[0.06] bg-[#0c1018]' : 'border-slate-200 bg-slate-100/90'
        }`}
      >
        {/* Left: Tools (Pencil, Eraser, 4 Geometric Shapes) */}
        <div className="flex items-center gap-1 flex-wrap">
          {/* Lápiz */}
          <button
            type="button"
            onClick={() => setSelectedTool('pencil')}
            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
              selectedTool === 'pencil'
                ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm'
                : isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
            title="Lápiz / Dibujo libre"
          >
            <PenTool className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Lápiz</span>
          </button>

          {/* Borrador */}
          <button
            type="button"
            onClick={() => setSelectedTool('eraser')}
            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
              selectedTool === 'eraser'
                ? 'bg-rose-500 text-white font-bold border-rose-400 shadow-sm'
                : isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
            title="Borrador"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">Borrador</span>
          </button>

          {/* Divisor */}
          <div className="h-5 w-[1px] bg-white/10 mx-0.5" />

          {/* 4 Figuras Geométricas Básicas */}
          {/* 1. Rectángulo */}
          <button
            type="button"
            onClick={() => setSelectedTool('rect')}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              selectedTool === 'rect'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
            title="Figura: Rectángulo"
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          {/* 2. Círculo */}
          <button
            type="button"
            onClick={() => setSelectedTool('circle')}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              selectedTool === 'circle'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
            title="Figura: Círculo"
          >
            <Circle className="w-3.5 h-3.5" />
          </button>

          {/* 3. Línea */}
          <button
            type="button"
            onClick={() => setSelectedTool('line')}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              selectedTool === 'line'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
            title="Figura: Línea recta"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* 4. Flecha */}
          <button
            type="button"
            onClick={() => setSelectedTool('arrow')}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              selectedTool === 'arrow'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
            title="Figura: Flecha"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          {/* Triángulo adicional */}
          <button
            type="button"
            onClick={() => setSelectedTool('triangle')}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              selectedTool === 'triangle'
                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                : isDarkTheme
                ? 'border-white/10 text-neutral-300 hover:bg-white/[0.08]'
                : 'border-slate-300 text-slate-700 hover:bg-white'
            }`}
            title="Figura: Triángulo"
          >
            <Triangle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: History (Undo, Redo, Clear) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-lg border transition ${
              canUndo
                ? 'text-neutral-200 hover:bg-white/[0.08] cursor-pointer'
                : 'text-neutral-600 opacity-40 cursor-not-allowed border-transparent'
            }`}
            title="Deshacer (Undo)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-lg border transition ${
              canRedo
                ? 'text-neutral-200 hover:bg-white/[0.08] cursor-pointer'
                : 'text-neutral-600 opacity-40 cursor-not-allowed border-transparent'
            }`}
            title="Rehacer (Redo)"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-600/20 transition cursor-pointer"
            title="Borrar toda la pizarra"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. Sub-toolbar: Primary Colors Palette & 5 Thickness Options */}
      <div
        className={`px-3 py-1.5 border-b flex items-center justify-between gap-2 shrink-0 ${
          isDarkTheme ? 'border-white/[0.06] bg-[#080b12]' : 'border-slate-200 bg-white'
        }`}
      >
        {/* Paleta con Colores Primarios */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-400 font-semibold mr-1">Color:</span>
          {PRIMARY_COLORS.map((col) => (
            <button
              key={col.hex}
              type="button"
              onClick={() => {
                setSelectedColor(col.hex);
                if (selectedTool === 'eraser') setSelectedTool('pencil');
              }}
              style={{ backgroundColor: col.hex }}
              className={`w-5 h-5 rounded-full transition-transform active:scale-90 cursor-pointer ${
                selectedColor === col.hex && selectedTool !== 'eraser'
                  ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black scale-110'
                  : 'hover:scale-105 border border-white/20'
              }`}
              title={`Color: ${col.name}`}
            />
          ))}
        </div>

        {/* 5 Grosores de trazo */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-400 font-semibold mr-1 hidden sm:inline">Grosor:</span>
          {THICKNESS_OPTIONS.map((opt) => (
            <button
              key={opt.size}
              type="button"
              onClick={() => setLineWidth(opt.size)}
              className={`w-6 h-6 rounded-lg flex items-center justify-center transition active:scale-90 cursor-pointer border ${
                lineWidth === opt.size
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : isDarkTheme
                  ? 'border-white/10 text-neutral-400 hover:bg-white/[0.06]'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title={`${opt.label} (${opt.size}px)`}
            >
              <span
                style={{
                  width: `${Math.min(16, Math.max(3, opt.size * 0.7))}px`,
                  height: `${Math.min(16, Math.max(3, opt.size * 0.7))}px`,
                  backgroundColor: selectedTool === 'eraser' ? '#cbd5e1' : selectedColor,
                }}
                className="rounded-full shrink-0"
              />
            </button>
          ))}
        </div>
      </div>

      {/* 4. Canvas Viewport Area */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden touch-none cursor-crosshair ${
          isDarkTheme ? 'bg-[#090d16]' : 'bg-[#fafafa]'
        }`}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
};
