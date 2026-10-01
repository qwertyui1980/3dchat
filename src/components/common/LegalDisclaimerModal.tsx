import React from 'react';
import { ShieldAlert, X, Scale, FileText, ExternalLink } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#0c0c12] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between bg-[#08080c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                Licencia, Origen y Excepción Total de Responsabilidad
              </h3>
              <p className="text-[11px] text-neutral-400">
                Términos legales de uso, descarga y ejecución del software
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
          {/* Origin Section */}
          <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-cyan-300 text-xs">
              <FileText className="w-3.5 h-3.5" />
              <span>Declaración Obligatoria de Origen y Atribución</span>
            </div>
            <p className="text-[11px] leading-normal text-cyan-100/90 font-mono">
              <strong>Origen del Proyecto:</strong> Creado y desarrollado originalmente por{' '}
              <strong className="text-white">XStreamX</strong>.
            </p>
            <p className="text-[11px] text-cyan-300/80">
              Cualquier copia, bifurcación (fork), distribución, implementación alojada o trabajo derivado debe conservar esta mención expresa de origen.
            </p>
          </div>

          {/* 1. Total Exception of Liability */}
          <div className="p-3.5 rounded-xl bg-[#08080a] border border-white/[0.08] space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 text-amber-300">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              1. Excepción Total de Funcionamiento y Garantía ("TAL CUAL")
            </h4>
            <p className="text-neutral-300">
              Este software se distribuye y proporciona <strong className="text-white">"TAL CUAL" ("AS IS")</strong> y <strong className="text-white">"SEGÚN DISPONIBILIDAD"</strong>, con todos sus posibles defectos, sin garantía de ninguna clase, expresa o implícita, incluidas, entre otras, garantías de comerciabilidad, idoneidad para un fin determinado, seguridad, compatibilidad o funcionamiento continuo e ininterrumpido.
            </p>
            <p className="text-neutral-400">
              No se garantiza que el rastreo facial, la transmisión de datos WebRTC o los cálculos gráficos operen sin fallas, latencia o interrupciones.
            </p>
          </div>

          {/* 2. Complete Personal Responsibility */}
          <div className="p-3.5 rounded-xl bg-[#08080a] border border-white/[0.08] space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              2. Responsabilidad Personal Exclusiva y Asunción de Riesgos
            </h4>
            <p className="text-neutral-300">
              Cualquier persona o entidad que descargue, clone, aloje, ejecute, modifique, integre o utilice este software lo hace bajo su <strong className="text-amber-300">ÚNICA, EXCLUSIVA Y TOTAL RESPONSABILIDAD PERSONAL</strong>.
            </p>
            <ul className="list-disc list-inside space-y-1 text-neutral-400 text-[11px]">
              <li>El usuario asume todos los riesgos derivados del uso, prueba o implementación.</li>
              <li>El usuario es el único responsable del cumplimiento de las leyes, normas de privacidad y regulaciones locales sobre cámaras, micrófonos y comunicaciones en su jurisdicción.</li>
            </ul>
          </div>

          {/* 3. Total Limitation of Liability */}
          <div className="p-3.5 rounded-xl bg-[#08080a] border border-white/[0.08] space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              3. Limitación Total de Responsabilidad de los Autores
            </h4>
            <p className="text-neutral-300">
              En ningún caso los creadores, autores, desarrolladores o colaboradores serán legal o económicamente responsables de reclamo alguno, daño directo, indirecto, incidental, consecuencial, especial o punitivo (incluyendo pérdida de datos, lucro cesante o interrupciones de negocio) que surja del uso o imposibilidad de uso del software.
            </p>
          </div>

          {/* 4. Permissive License */}
          <div className="p-3.5 rounded-xl bg-[#08080a] border border-white/[0.08] space-y-2">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              4. Licencia de Libre Uso y Modificación
            </h4>
            <p className="text-neutral-300">
              Se autoriza a cualquier persona a descargar, utilizar, estudiar, modificar, redistribuir y publicar este software para cualquier fin, siempre que se acepte la total excepción de responsabilidad y se incluya la mención de origen correspondiente.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.08] bg-[#08080c] flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 font-mono">
            Origin: XStreamX Project
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
