import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, EyeOff, ChevronDown, ChevronUp, ScanFace, GripHorizontal, Maximize2, Shield, Lock } from 'lucide-react';
import { AvatarId, FaceFeatures } from '../../types';
import { getAvatarTrackingProfile, transformAvatarLandmark } from '../avatars/avatarTrackingProfiles';
import { FaceTrackingVisionModule } from '../tracking/FaceTrackingVisionModule';

interface CameraPreviewPipProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  cameraStream?: MediaStream | null;
  features: FaceFeatures;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
  isCameraActive: boolean;
  avatarId?: AvatarId;
}

export const CameraPreviewPip: React.FC<CameraPreviewPipProps> = ({
  videoRef,
  cameraStream,
  features,
  landmarks,
  isCameraActive,
  avatarId,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMesh, setShowMesh] = useState(true);
  const [isVisionModuleOpen, setIsVisionModuleOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 16,
    posY: 0,
  });

  // Initialize position to bottom-left if not set yet
  useEffect(() => {
    if (position === null && typeof window !== 'undefined') {
      const initialY = Math.max(16, window.innerHeight - 260);
      setPosition({ x: 16, y: initialY });
    }
  }, [position]);

  // Constrain position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev || !containerRef.current) return prev;
        const rect = containerRef.current.getBoundingClientRect();
        const maxX = Math.max(8, window.innerWidth - rect.width - 8);
        const maxY = Math.max(8, window.innerHeight - rect.height - 8);
        return {
          x: Math.max(8, Math.min(maxX, prev.x)),
          y: Math.max(8, Math.min(maxY, prev.y)),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dragging handlers with PointerCapture for robust desktop + touch support
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only primary button
    const target = e.target as HTMLElement;
    if (target.closest('button')) return; // Ignore drag if button clicked

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const curX = position?.x ?? 16;
    const curY = position?.y ?? (window.innerHeight - 260);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: curX,
      posY: curY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width || 190;
    const height = rect?.height || 180;

    const maxX = Math.max(8, window.innerWidth - width - 8);
    const maxY = Math.max(8, window.innerHeight - height - 8);

    const nextX = Math.max(8, Math.min(maxX, dragStartRef.current.posX + deltaX));
    const nextY = Math.max(8, Math.min(maxY, dragStartRef.current.posY + deltaY));

    setPosition({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Safe ignore
      }
    }
  };

  // Toggle Collapse with automatic bottom viewport clamp when expanding
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const willBeCollapsed = !prev;
      if (!willBeCollapsed && position) {
        const estimatedHeight = 180;
        const maxY = window.innerHeight - estimatedHeight - 8;
        if (position.y > maxY) {
          setPosition({ x: position.x, y: Math.max(8, maxY) });
        }
      }
      return willBeCollapsed;
    });
  }, [position]);

  // Draw 2D Face Landmark Mesh
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !landmarks || !showMesh || !isCameraActive || isCollapsed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    const profile = getAvatarTrackingProfile(avatarId);

    // Helper to get mirrored coordinate with avatar-specific anatomical morphing
    const getPoint = (index: number) => {
      const rawPt = landmarks[index];
      if (!rawPt) return null;
      const pt = transformAvatarLandmark(profile, index, rawPt, landmarks);
      return {
        x: (1 - pt.x) * w,
        y: pt.y * h,
      };
    };

    // Draw connected path of points with fine hairline stroke
    const drawPath = (indices: number[], color: string, lineWidth = 0.75, isClosed = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      let hasStarted = false;
      for (const idx of indices) {
        const pt = getPoint(idx);
        if (!pt) continue;
        if (!hasStarted) {
          ctx.moveTo(pt.x, pt.y);
          hasStarted = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      if (isClosed && hasStarted) {
        ctx.closePath();
      }
      ctx.stroke();
    };

    // Draw single indicator dot (ultra-fine delicate subpixel dot)
    const drawDot = (p: { x: number; y: number } | null, color: string, radius = 0.85, haloColor?: string) => {
      if (!p) return;
      if (haloColor) {
        ctx.fillStyle = haloColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    // 1. Contours defined specifically for this avatar (delicate hairline)
    profile.contours.forEach((contour) => {
      drawPath(contour.indices, contour.color || profile.color, 0.75, contour.isClosed || false);
    });

    // 2. Active landmark points defined specifically for this avatar (very thin dots)
    profile.activeIndices.forEach((idx) => {
      const pt = getPoint(idx);
      if (!pt) return;
      if (idx === 468 || idx === 473) {
        // Pupils
        drawDot(pt, '#ffffff', 1.2, profile.glowColor || 'rgba(34, 211, 238, 0.25)');
      } else if (idx === 1) {
        // Nose tip
        drawDot(pt, profile.dotColor, 1.0, profile.glowColor);
      } else {
        drawDot(pt, profile.dotColor, 0.85);
      }
    });

    // 3. Smile vectors on mouth corners if applicable
    const cornerL = getPoint(61);
    const cornerR = getPoint(291);
    const smile = features.mouthSmile || 0;
    if (cornerL && cornerR && Math.abs(smile) > 0.1) {
      ctx.strokeStyle = smile > 0 ? '#34d399' : '#f87171';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(cornerL.x, cornerL.y);
      ctx.lineTo(cornerL.x - 6, cornerL.y - smile * 8);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cornerR.x, cornerR.y);
      ctx.lineTo(cornerR.x + 6, cornerR.y - smile * 8);
      ctx.stroke();
    }
  }, [landmarks, showMesh, isCameraActive, isCollapsed, features.mouthSmile, avatarId]);

  const profile = getAvatarTrackingProfile(avatarId);

  if (!isCameraActive) return null;

  return (
    <div
      ref={containerRef}
      style={{
        left: position ? `${position.x}px` : '16px',
        top: position ? `${position.y}px` : 'auto',
        bottom: position ? 'auto' : '96px',
      }}
      className={`fixed z-40 select-none transition-shadow ${
        isDragging ? 'shadow-2xl shadow-cyan-500/30 ring-2 ring-cyan-400/80 scale-[1.02]' : ''
      }`}
    >
      <div className="rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl overflow-hidden transition-all duration-200">
        
        {/* Draggable Header bar */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={toggleCollapse}
          title="Arrastra para mover • Doble clic para colapsar/expandir"
          className={`px-3 py-2 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-2.5 cursor-grab active:cursor-grabbing touch-none select-none transition-colors ${
            isDragging ? 'bg-slate-900 border-cyan-500/50' : 'hover:bg-slate-900/80'
          }`}
        >
          {/* Left Title & Status */}
          <div className="flex items-center gap-1.5 min-w-0">
            <GripHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200 truncate">
              <ScanFace className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Tracking</span>
            </div>

            {/* Dynamic avatar points badge */}
            <span
              className="text-[10px] font-mono px-1.5 py-0.2 rounded border truncate font-bold"
              style={{
                color: profile.dotColor,
                borderColor: `${profile.color}55`,
                backgroundColor: `${profile.color}15`,
              }}
              title={profile.description}
            >
              {profile.badge}
            </span>

            {/* Compact status dot */}
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                features.isFaceDetected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
              title={features.isFaceDetected ? 'Rostro detectado' : 'Sin rostro'}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {!isCollapsed && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMesh(!showMesh);
                  }}
                  title={showMesh ? 'Ocultar malla de puntos' : 'Mostrar malla de puntos'}
                  className={`p-1 rounded text-xs transition cursor-pointer ${
                    showMesh ? 'text-cyan-400 bg-cyan-950/60' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {showMesh ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVisionModuleOpen(true);
                  }}
                  title="Abrir HUD visión detallada"
                  className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer hover:bg-slate-800"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse();
              }}
              title={isCollapsed ? 'Expandir visor' : 'Colapsar visor'}
              className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer hover:bg-slate-800"
            >
              {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Biometric Mesh View (Visible when expanded) - 100% Privacy Protected, Zero Camera Video Rendered */}
        {!isCollapsed && (
          <div className="p-2">
            <div className="relative w-44 h-32 rounded-xl bg-slate-950 overflow-hidden border border-cyan-900/60 shadow-inner">
              {/* Privacy Cyber Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:10px_10px] opacity-70 pointer-events-none" />
              <canvas
                ref={canvasRef}
                width={176}
                height={128}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/85 backdrop-blur text-[8px] font-mono text-cyan-300 pointer-events-none flex items-center gap-1 border border-cyan-800/50 shadow-sm">
                <Shield className="w-2.5 h-2.5 text-emerald-400" />
                <span>SOLO MALLA</span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Full Face Tracking Vision HUD Modal */}
      <FaceTrackingVisionModule
        isOpen={isVisionModuleOpen}
        onClose={() => setIsVisionModuleOpen(false)}
        videoRef={videoRef}
        cameraStream={cameraStream}
        features={features}
        landmarks={landmarks}
        isCameraActive={isCameraActive}
        avatarId={avatarId}
      />
    </div>
  );
};
