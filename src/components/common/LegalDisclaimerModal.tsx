import React from 'react';
import { ShieldCheck, ShieldAlert, X, Scale, FileText, Lock, Cpu } from 'lucide-react';

interface LegalDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LegalDisclaimerModal: React.FC<LegalDisclaimerModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-2xl max-h-[92vh] bg-[#0c0c12] border border-white/[0.12] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#08080c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                Licencia Apache 2.0 y Cláusula de Privacidad por Diseño
              </h3>
              <p className="text-[11px] text-neutral-400">
                Términos legales, arquitectura de protección de datos y descargo de responsabilidad
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs leading-relaxed text-neutral-300 font-sans">
          
          {/* Privacy-by-Design Technical & Legal Clause */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-indigo-950/30 border border-emerald-500/30 text-emerald-100 space-y-2">
            <div className="font-bold flex items-center gap-2 text-emerald-300 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="uppercase tracking-wider">Especificación Legal de Privacidad y Flujo de Blendshapes</span>
            </div>
            <p className="text-[11px] text-emerald-100/90 leading-relaxed">
              La mayor prioridad de esta plataforma es la <strong>estricta privacidad de los usuarios</strong>. La arquitectura del software cumple con los siguientes principios técnicos y jurídicos garantizados:
            </p>
            <div className="space-y-1.5 pt-1 text-[11px] text-neutral-200">
              <div className="flex items-start gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Ejecución 100% Lado Cliente (Edge AI):</strong> El rastreo facial, la detección de landmarks anatómicos y el cálculo de expresiones se procesan de manera local y exclusiva dentro del navegador web del dispositivo del usuario.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Cero Transmisión de Video Real:</strong> No se captura, transmite ni almacena señal de video, grabación de cámara ni buffers de píxeles biométricos sin procesar hacia ningún servidor ni participantes remotos para la representación del avatar.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Flujo Ultraligero de Blendshapes:</strong> Únicamente se envía a través de la red una secuencia numérica ligera de coeficientes blendshapes y ángulos de rotación (unos <strong>pocos cientos de bytes por fotograma</strong>).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Renderizado Local por Cada Espectador:</strong> Cada receptor reconstruye y renderiza el avatar 3D localmente con Three.js en su propio dispositivo, lo que mantiene los costos de servidor e infraestructura prácticamente en cero, optimiza radicalmente el ancho de banda y escala de manera ilimitada sin vulnerar la privacidad biométrica.
                </span>
              </div>
            </div>
          </div>

          {/* Apache License 2.0 Grant */}
          <div className="p-3.5 rounded-xl bg-[#08080a] border border-white/[0.08] space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 text-cyan-300">
              <Scale className="w-4 h-4 text-cyan-400" />
              1. Concesión de Licencia Apache 2.0 (Apache License, Version 2.0)
            </h4>
            <p className="text-neutral-300 leading-normal">
              Este proyecto de software libre está sujeto a los términos de la <strong>Apache License, Version 2.0</strong>. Se concede a cualquier persona o entidad el derecho perpetuo, mundial, sin regalías y no exclusivo para reproducir, preparar trabajos derivados, exhibir públicamente, sublicenciar y distribuir el Software en código fuente o binario.
            </p>
          </div>

          {/* Origin Section */}
          <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-cyan-300 text-xs">
              <FileText className="w-3.5 h-3.5" />
              <span>2. Atribución Obligatoria de Origen (Sección 4c)</span>
            </div>
            <p className="text-[11px] leading-normal text-cyan-100/90 font-mono">
              <strong>Origen del Proyecto:</strong> Creado y desarrollado originalmente por{' '}
              <strong className="text-white">XStreamX</strong>.
            </p>
            <p className="text-[11px] text-cyan-300/80">
              Conforme a la Sección 4(c) de la Licencia Apache 2.0, toda copia, bifurcación, distribución, implementación alojada o trabajo derivado debe conservar esta mención expresa de origen y autoría.
            </p>
          </div>

          {/* 3. Total Exception of Liability */}
          <div className="p-3.5 rounded-xl bg-[#08080a] border border-white/[0.08] space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              3. Exención Total de Garantías y "AS IS" (Sección 7)
            </h4>
            <p className="text-neutral-300">
              El Software se distribuye <strong className="text-white">"TAL CUAL" ("AS IS")</strong> y <strong className="text-white">"SEGÚN DISPONIBILIDAD"</strong>, sin garantías ni condiciones de ningún tipo, ya sean expresas o implícitas, incluidas, entre otras, garantías de comerciabilidad, idoneidad para un fin determinado o ausencia de errores. El usuario asume todos los riesgos inherentes a su uso o redistribución.
            </p>
          </div>

          {/* 4. Limitation of Liability */}
          <div className="p-3.5 rounded-xl bg-[#08080a] border border-white/[0.08] space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              4. Limitación Total de Responsabilidad (Sección 8)
            </h4>
            <p className="text-neutral-300">
              En ningún caso y bajo ninguna teoría legal, ya sea extracontractual (incluida negligencia), contractual o de otro tipo, los autores, colaboradores o titulares de derechos de autor serán responsables por daños directos, indirectos, incidentales, especiales o consecuenciales derivados del uso, funcionamiento o imposibilidad de uso del software.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.08] bg-[#08080c] flex items-center justify-between">
          <span className="text-[10px] text-neutral-400 font-mono">
            Licencia: Apache-2.0 • Origin: XStreamX
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-100 hover:bg-white text-neutral-950 font-bold text-xs transition cursor-pointer"
          >
            Entendido y Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};
