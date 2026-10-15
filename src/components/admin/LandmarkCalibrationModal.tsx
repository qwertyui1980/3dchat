/**
 * Landmark Calibration Modal for XStreamX 3D Masks Studio
 * Origin: Originally created and developed by XStreamX
 * 
 * Interactive 2D photo calibration tool allowing users to:
 * 1. Select point density for tracking & animation (16, 32, 68, or 478 points)
 * 2. Interactively drag key facial pins directly over their photo
 * 3. Use micro-adjustment sliders (Eye spacing, Eye Y, Brow Y, Mouth width, Mouth Y, Chin)
 * 4. Apply smooth Gaussian RBF warping to all 478 canonical vertices
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  RotateCcw,
  Check,
  Eye,
  Smile,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  HelpCircle,
} from 'lucide-react';
import {
  Point3D,
  LandmarkDensity,
  KEY_CALIBRATION_PINS,
  KeyPinDefinition,
  DENSITY_INDICES,
  LandmarkMicroAdjustments,
  DEFAULT_MICRO_ADJUSTMENTS,
  applyLandmarkCalibration,
} from '../../services/face3d/landmarkCalibrationService';

interface LandmarkCalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  baseLandmarks: Point3D[];
  initialDensity?: LandmarkDensity;
  initialPinDeltas?: Record<number, { dx: number; dy: number }>;
  initialAdjustments?: LandmarkMicroAdjustments;
  themeColor?: string;
  onApply: (params: {
    calibratedLandmarks: Point3D[];
    density: LandmarkDensity;
    pinDeltas: Record<number, { dx: number; dy: number }>;
    microAdjustments: LandmarkMicroAdjustments;
    activeIndices: number[];
  }) => void;
}

export const LandmarkCalibrationModal: React.FC<LandmarkCalibrationModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  baseLandmarks,
  initialDensity = 32,
  initialPinDeltas = {},
  initialAdjustments = DEFAULT_MICRO_ADJUSTMENTS,
  themeColor = '#06b6d4',
  onApply,
}) => {
  // Density state
  const [density, setDensity] = useState<LandmarkDensity>(initialDensity);

  // Pin deltas (index -> { dx, dy } in normalized coordinates 0 to 1)
  const [pinDeltas, setPinDeltas] = useState<Record<number, { dx: number; dy: number }>>(initialPinDeltas);

  // Micro adjustments sliders
  const [adjustments, setAdjustments] = useState<LandmarkMicroAdjustments>(initialAdjustments);

  // Active dragged pin
  const [draggingPinIndex, setDraggingPinIndex] = useState<number | null>(null);
  const [hoveredPinIndex, setHoveredPinIndex] = useState<number | null>(null);

  // Viewport Zoom & Pan
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Display toggles
  const [showAllDensityDots, setShowAllDensityDots] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [activeGroupFilter, setActiveGroupFilter] = useState<'all' | 'eyes' | 'mouth' | 'brows' | 'nose' | 'jaw'>('all');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Reset state when opening with new props
  useEffect(() => {
    if (isOpen) {
      setDensity(initialDensity);
      setPinDeltas(initialPinDeltas || {});
      setAdjustments(initialAdjustments || DEFAULT_MICRO_ADJUSTMENTS);
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, initialDensity, initialPinDeltas, initialAdjustments]);

  // Recalculate 478 calibrated landmarks with RBF warping in real time
  const calibratedLandmarks = useMemo(() => {
    if (!baseLandmarks || baseLandmarks.length === 0) return [];
    return applyLandmarkCalibration(baseLandmarks, pinDeltas, adjustments);
  }, [baseLandmarks, pinDeltas, adjustments]);

  // Active indices based on chosen density
  const activeIndices = useMemo(() => {
    return DENSITY_INDICES[density] || DENSITY_INDICES[32];
  }, [density]);

  // Filtered key pins based on group
  const visiblePins = useMemo(() => {
    if (activeGroupFilter === 'all') return KEY_CALIBRATION_PINS;
    return KEY_CALIBRATION_PINS.filter((p) => p.group === activeGroupFilter);
  }, [activeGroupFilter]);

  // Normalized coordinate to SVG ViewBox (0..1000)
  const normToSvg = useCallback((pt: { x: number; y: number }) => {
    return {
      x: pt.x * 1000,
      y: pt.y * 1000,
    };
  }, []);

  // SVG coordinate to normalized (0..1)
  const clientToNorm = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x: nx, y: ny };
  }, []);

  // Dragging event handlers
  const handlePointerDownPin = (e: React.PointerEvent, pin: KeyPinDefinition) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingPinIndex(pin.index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingPinIndex !== null) {
      const norm = clientToNorm(e.clientX, e.clientY);
      if (!norm || !baseLandmarks[draggingPinIndex]) return;

      const base = baseLandmarks[draggingPinIndex];
      const dx = norm.x - base.x;
      const dy = norm.y - base.y;

      setPinDeltas((prev) => ({
        ...prev,
        [draggingPinIndex]: { dx, dy },
      }));
    } else if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingPinIndex !== null) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
      setDraggingPinIndex(null);
    }
    if (isPanning) {
      setIsPanning(false);
    }
  };

  // Pan canvas when clicking on background
  const handleBgPointerDown = (e: React.PointerEvent) => {
    if (e.button === 0 && draggingPinIndex === null) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  // Reset all pins and sliders to automatic MediaPipe detection
  const handleReset = () => {
    setPinDeltas({});
    setAdjustments(DEFAULT_MICRO_ADJUSTMENTS);
    setDensity(32);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Apply calibration to avatar
  const handleApply = () => {
    onApply({
      calibratedLandmarks,
      density,
      pinDeltas,
      microAdjustments: adjustments,
      activeIndices,
    });
    onClose();
  };

  if (!isOpen) return null;

  // Helper to build SVG path data for contour
  const buildSvgPath = (indices: number[], closed = false) => {
    if (!calibratedLandmarks || calibratedLandmarks.length === 0) return '';
    let d = '';
    indices.forEach((idx, i) => {
      const pt = calibratedLandmarks[idx];
      if (!pt) return;
      const svgPt = normToSvg(pt);
      if (i === 0) {
        d += `M ${svgPt.x.toFixed(1)} ${svgPt.y.toFixed(1)} `;
      } else {
        d += `L ${svgPt.x.toFixed(1)} ${svgPt.y.toFixed(1)} `;
      }
    });
    if (closed && d) d += 'Z';
    return d;
  };

  // Key Contours definition
  const outerLipsPath = buildSvgPath([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146], true);
  const innerLipsPath = buildSvgPath([78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95], true);
  const eyeLeftPath = buildSvgPath([33, 7, 163, 144, 145, 153, 154, 133, 173, 157, 158, 159, 160, 161, 246], true);
  const eyeRightPath = buildSvgPath([362, 382, 381, 380, 374, 373, 390, 263, 466, 388, 387, 386, 385, 384, 398], true);
  const browLeftPath = buildSvgPath([70, 63, 105, 66, 107]);
  const browRightPath = buildSvgPath([300, 293, 334, 296, 336]);
  const noseBridgePath = buildSvgPath([168, 6, 197, 195, 5, 4, 1]);
  const jawlinePath = buildSvgPath([234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 454]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative flex flex-col w-full max-w-7xl h-[92vh] bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Calibrador Manual de Puntos Facial & Densidad
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {density} Puntos Activos
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Selecciona cuántos puntos usar y arrastra los marcadores sobre tu foto para alinear la animación 1:1 con tu rostro.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
              title="Restablecer puntos a la detección automática de MediaPipe"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Canvas Left + Tuning Panel Right */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Main Visual Canvas Overlay */}
          <div
            ref={containerRef}
            className="flex-1 relative bg-slate-950 flex items-center justify-center overflow-hidden cursor-crosshair select-none"
            onPointerDown={handleBgPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {/* Viewport Zoom / Pan Wrapper */}
            <div
              className="relative transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              {/* Source Photo */}
              <img
                src={imageUrl}
                alt="Rostro para calibración"
                className="max-h-[75vh] max-w-[85vw] object-contain rounded-lg shadow-2xl pointer-events-none"
                draggable={false}
              />

              {/* Interactive SVG Overlay on top of Photo */}
              <svg
                ref={svgRef}
                viewBox="0 0 1000 1000"
                className="absolute inset-0 w-full h-full pointer-events-auto"
                style={{ overflow: 'visible' }}
              >
                {/* 1. Anatomical Contours */}
                {showContours && (
                  <g className="transition-opacity duration-150">
                    {/* Jawline */}
                    <path d={jawlinePath} fill="none" stroke="#a855f7" strokeWidth="2.5" strokeOpacity="0.75" strokeDasharray="6,4" />
                    {/* Eyebrows */}
                    <path d={browLeftPath} fill="none" stroke="#06b6d4" strokeWidth="3" strokeOpacity="0.85" />
                    <path d={browRightPath} fill="none" stroke="#06b6d4" strokeWidth="3" strokeOpacity="0.85" />
                    {/* Nose Bridge */}
                    <path d={noseBridgePath} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.8" />
                    {/* Eyes Outlines */}
                    <path d={eyeLeftPath} fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" strokeWidth="2.5" strokeOpacity="0.9" />
                    <path d={eyeRightPath} fill="rgba(56, 189, 248, 0.08)" stroke="#38bdf8" strokeWidth="2.5" strokeOpacity="0.9" />
                    {/* Lips Outlines */}
                    <path d={outerLipsPath} fill="rgba(244, 63, 94, 0.08)" stroke="#f43f5e" strokeWidth="3" strokeOpacity="0.9" />
                    <path d={innerLipsPath} fill="rgba(251, 113, 133, 0.12)" stroke="#fb7185" strokeWidth="2.2" strokeOpacity="0.95" />
                  </g>
                )}

                {/* 2. Density Active Dots (subtle dots for all active points) */}
                {showAllDensityDots && (
                  <g>
                    {activeIndices.map((idx) => {
                      const pt = calibratedLandmarks[idx];
                      if (!pt) return null;
                      const { x, y } = normToSvg(pt);
                      return (
                        <circle
                          key={`dot_${idx}`}
                          cx={x}
                          cy={y}
                          r="3"
                          fill="#22d3ee"
                          fillOpacity="0.8"
                          className="pointer-events-none"
                        />
                      );
                    })}
                  </g>
                )}

                {/* 3. Draggable Key Anatomical Pins */}
                <g>
                  {visiblePins.map((pin) => {
                    const pt = calibratedLandmarks[pin.index];
                    if (!pt) return null;
                    const { x, y } = normToSvg(pt);
                    const isDragging = draggingPinIndex === pin.index;
                    const isHovered = hoveredPinIndex === pin.index;

                    return (
                      <g
                        key={`pin_${pin.id}`}
                        transform={`translate(${x}, ${y})`}
                        className="cursor-grab active:cursor-grabbing transition-transform"
                        onPointerDown={(e) => handlePointerDownPin(e, pin)}
                        onPointerEnter={() => setHoveredPinIndex(pin.index)}
                        onPointerLeave={() => setHoveredPinIndex(null)}
                      >
                        {/* Outer Glow Halo */}
                        <circle
                          r={isDragging ? 22 : isHovered ? 18 : 14}
                          fill={pin.color}
                          fillOpacity={isDragging ? 0.45 : isHovered ? 0.35 : 0.20}
                          className="transition-all duration-150 animate-pulse"
                        />
                        {/* Middle Ring */}
                        <circle
                          r={isDragging ? 10 : 8}
                          fill={pin.color}
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          className="shadow-lg"
                        />
                        {/* Inner Core Dot */}
                        <circle r="3.5" fill="#ffffff" />

                        {/* Interactive Tooltip Label */}
                        {(isHovered || isDragging) && (
                          <g transform="translate(0, -22)" className="pointer-events-none">
                            <rect
                              x={-pin.label.length * 4.5}
                              y="-16"
                              width={pin.label.length * 9}
                              height="20"
                              rx="6"
                              fill="#090d16"
                              stroke={pin.color}
                              strokeWidth="1.5"
                            />
                            <text
                              textAnchor="middle"
                              y="-3"
                              fill="#ffffff"
                              fontSize="11"
                              fontWeight="bold"
                              fontFamily="sans-serif"
                            >
                              {pin.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* Bottom-left Canvas Floating View Controls */}
            <div className="absolute bottom-4 left-4 flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/60 shadow-xl">
              <button
                onClick={() => setZoom((z) => Math.min(3.0, z + 0.25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Acercar (Zoom In)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Alejar (Zoom Out)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setZoom(1.0);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Centrar Vista"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-4 bg-slate-700 mx-1" />

              <button
                onClick={() => setShowContours((c) => !c)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors font-medium ${
                  showContours ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Contornos
              </button>
              <button
                onClick={() => setShowAllDensityDots((d) => !d)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors font-medium ${
                  showAllDensityDots ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Malla Puntos
              </button>
            </div>
          </div>

          {/* Right Tuning & Density Sidebar */}
          <div className="w-full lg:w-96 flex flex-col bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 shrink-0 overflow-y-auto">
            <div className="p-5 space-y-6">
              {/* Density Preset Selector */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    Densidad de Puntos de Animación
                  </label>
                  <span className="text-[11px] text-slate-400">{activeIndices.length} puntos</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 16, label: '16 Puntos Clave', desc: 'Boca y Ojos Esenciales' },
                    { id: 32, label: '32 Puntos (Recomendado)', desc: 'Expresión Óptima' },
                    { id: 68, label: '68 Puntos Estándar', desc: 'Norma FACS Facial' },
                  ].map((preset) => {
                    const isSelected = density === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setDensity(preset.id as LandmarkDensity)}
                        className={`p-2.5 text-left rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-cyan-950/60 border-cyan-500/60 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                            : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                            {preset.id} Puntos {preset.id === 32 ? '★' : ''}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">{preset.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 ml-1.5 shrink-0" />}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pin Filter Tabs */}
              <div>
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
                  Filtrar Marcadores por Zona
                </label>
                <div className="flex flex-wrap gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'eyes', label: 'Ojos' },
                    { id: 'mouth', label: 'Boca' },
                    { id: 'brows', label: 'Cejas' },
                    { id: 'nose', label: 'Nariz' },
                    { id: 'jaw', label: 'Mandíbula' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveGroupFilter(tab.id as any)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                        activeGroupFilter === tab.id
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Micro-Adjustment Sliders */}
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    Micro-Calibradores Simétricos
                  </label>
                  <button
                    onClick={() => setAdjustments(DEFAULT_MICRO_ADJUSTMENTS)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                  >
                    Reset Sliders
                  </button>
                </div>

                {/* Eye Spacing */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-sky-400" /> Separación Ojos
                    </span>
                    <span className="text-sky-400 font-mono text-[11px]">
                      {(adjustments.eyeSpacing * 1000).toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.04"
                    max="0.04"
                    step="0.002"
                    value={adjustments.eyeSpacing}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, eyeSpacing: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Eye Y Offset */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-sky-400" /> Altura Ojos (Y)
                    </span>
                    <span className="text-sky-400 font-mono text-[11px]">
                      {(adjustments.eyeOffsetY * 1000).toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.04"
                    max="0.04"
                    step="0.002"
                    value={adjustments.eyeOffsetY}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, eyeOffsetY: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                {/* Eye Opening (Palpebral aperture) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" /> Apertura de Ojos (Párpados)
                    </span>
                    <span className="text-cyan-400 font-mono text-[11px]">
                      {((adjustments.eyeOpening || 0) * 1000).toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.03"
                    max="0.05"
                    step="0.002"
                    value={adjustments.eyeOpening || 0}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, eyeOpening: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Brow Y Offset */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Altura Cejas (Y)</span>
                    <span className="text-cyan-400 font-mono text-[11px]">
                      {(adjustments.browOffsetY * 1000).toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.05"
                    max="0.05"
                    step="0.002"
                    value={adjustments.browOffsetY}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, browOffsetY: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                  />
                </div>

                {/* Mouth Width Scale */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Smile className="w-3.5 h-3.5 text-rose-400" /> Ancho de Boca
                    </span>
                    <span className="text-rose-400 font-mono text-[11px]">
                      {adjustments.mouthWidthScale.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.80"
                    max="1.25"
                    step="0.01"
                    value={adjustments.mouthWidthScale}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, mouthWidthScale: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                  />
                </div>

                {/* Mouth Y Offset */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 flex items-center gap-1">
                      <Smile className="w-3.5 h-3.5 text-rose-400" /> Posición Boca (Y)
                    </span>
                    <span className="text-rose-400 font-mono text-[11px]">
                      {(adjustments.mouthOffsetY * 1000).toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.05"
                    max="0.05"
                    step="0.002"
                    value={adjustments.mouthOffsetY}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, mouthOffsetY: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                  />
                </div>

                {/* Chin Y Offset */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Largo Mentón / Barbilla</span>
                    <span className="text-purple-400 font-mono text-[11px]">
                      {(adjustments.chinOffsetY * 1000).toFixed(0)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.05"
                    max="0.05"
                    step="0.002"
                    value={adjustments.chinOffsetY}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, chinOffsetY: parseFloat(e.target.value) }))
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                </div>
              </div>

              {/* Informative Guidance Card */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>Deformación Elástica RBF</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Al mover los marcadores sobre la foto, los 478 vértices de la malla 3D se ajustan elásticamente. La animación en el Lobby y la Sala respetará tus puntos calibrados sin desfasarse.
                </p>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-5 mt-auto border-t border-slate-800 bg-slate-950/80 flex items-center gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Aplicar Calibración
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
