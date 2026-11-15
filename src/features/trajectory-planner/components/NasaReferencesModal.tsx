import React from 'react';
import { ExternalLink, X, BookOpen, ShieldCheck, Database, Compass, Globe } from 'lucide-react';

export interface NasaReferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NasaReferencesModal: React.FC<NasaReferencesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nasa-references-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl bg-[#0B0F14] border border-[#2B3642] rounded-xs shadow-2xl overflow-hidden font-sans text-[#E6E2D6]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#11161D] border-b border-[#2B3642] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen size={16} className="text-[#7FB7D4]" />
            <h2 id="nasa-references-title" className="font-mono text-xs uppercase tracking-[0.16em] text-[#E6E2D6] font-bold">
              NASA / JPL Scientific Resources & Ephemeris Attribution
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#6B757D] hover:text-[#E6E2D6] transition-colors p-1 rounded-xs cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto font-mono text-xs text-[#A9B0B5] leading-relaxed">
          <div className="p-3 bg-[#151B22] border border-[#2B3642] rounded-xs text-[#E6E2D6]">
            <p className="text-[11px] text-[#7FB7D4] font-semibold mb-1">
              INDEPENDENT SCIENTIFIC SIMULATION NOTE
            </p>
            <p className="text-[11px] text-[#A9B0B5]">
              SECTOR 17 is an independent educational space simulation. NASA does not endorse SECTOR 17.
              The orbital mechanics, trajectory calculations, and visualizations are inspired by official NASA/JPL
              mission design architectures and publicly available planetary datasets.
            </p>
          </div>

          {/* Reference 1: NASA Eyes */}
          <div className="p-3.5 bg-[#0D1116] border border-[#1F2733] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#E6E2D6] font-bold flex items-center gap-1.5">
                <Globe size={13} className="text-[#7FB7D4]" /> NASA Eyes on the Solar System
              </span>
              <a
                href="https://science.nasa.gov/eyes/"
                target="_blank"
                rel="noreferrer"
                className="text-[#7FB7D4] hover:underline flex items-center gap-1 text-[11px]"
              >
                science.nasa.gov/eyes <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-[11px]">
              Visual presentation concepts for planetary systems, coordinate grids, camera follow modes, and
              interactive trajectory timeline views are inspired by NASA Eyes on the Solar System and the
              NASA Eyes Trajectory View architecture.
            </p>
          </div>

          {/* Reference 2: JPL Horizons */}
          <div className="p-3.5 bg-[#0D1116] border border-[#1F2733] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#E6E2D6] font-bold flex items-center gap-1.5">
                <Database size={13} className="text-[#F5A623]" /> JPL Horizons On-Line Solar System Data Service
              </span>
              <a
                href="https://ssd.jpl.nasa.gov/horizons/"
                target="_blank"
                rel="noreferrer"
                className="text-[#7FB7D4] hover:underline flex items-center gap-1 text-[11px]"
              >
                ssd.jpl.nasa.gov <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-[11px]">
              Planetary and lunar orbital constants (Jupiter barycenter NAIF ID 599, Europa NAIF ID 502) utilize
              authoritative IAU/JPL reference ephemerides. Deterministic offline fallback tables ensure complete
              testability and zero network latency.
            </p>
          </div>

          {/* Reference 3: NAIF SPICE */}
          <div className="p-3.5 bg-[#0D1116] border border-[#1F2733] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#E6E2D6] font-bold flex items-center gap-1.5">
                <Compass size={13} className="text-[#31C48D]" /> NASA NAIF SPICE Toolkit Architecture
              </span>
              <a
                href="https://naif.jpl.nasa.gov/"
                target="_blank"
                rel="noreferrer"
                className="text-[#7FB7D4] hover:underline flex items-center gap-1 text-[11px]"
              >
                naif.jpl.nasa.gov <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-[11px]">
              Inertial coordinate frames (J2000 ecliptic and planetocentric IAU_JUPITER reference bodies) adhere
              to NASA Navigation and Ancillary Information Facility (NAIF) geometric standards for multi-body flybys.
            </p>
          </div>

          {/* Reference 4: GMAT */}
          <div className="p-3.5 bg-[#0D1116] border border-[#1F2733] rounded-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#E6E2D6] font-bold flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-[#A5B1C2]" /> General Mission Analysis Tool (GMAT)
              </span>
              <a
                href="https://gmat.gsfc.nasa.gov/"
                target="_blank"
                rel="noreferrer"
                className="text-[#7FB7D4] hover:underline flex items-center gap-1 text-[11px]"
              >
                gmat.gsfc.nasa.gov <ExternalLink size={10} />
              </a>
            </div>
            <p className="text-[11px]">
              Mission design workflows for delta-V allocation, finite burn modeling, and gravity assist orbital shaping
              reference Goddard Space Flight Center's open-source GMAT astrodynamics system.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-[#11161D] border-t border-[#2B3642] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xs bg-[#1C242D] hover:bg-[#2B3642] border border-[#2B3642] text-[#E6E2D6] font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close References
          </button>
        </div>
      </div>
    </div>
  );
};
