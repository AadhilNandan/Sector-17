import React from 'react';
import { ModalDialog } from '../../../components/ui/ModalDialog';
import { GameButton } from '../../../components/ui/GameButton';
import { sounds } from '../../../utils/soundEffects';
import { ShieldAlert, Compass } from 'lucide-react';

export interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="EXPEDITION RECORD // MISSION CREDITS"
      subtitle="Autonomous deep-space systems architecture and astrodynamics"
      maxWidth="md"
      footer={
        <div className="flex justify-end w-full">
          <GameButton
            variant="glass"
            size="sm"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
          >
            Close Credits
          </GameButton>
        </div>
      }
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Project Intro */}
        <div className="p-3 bg-[#0D1116] border border-[#2B3642] rounded space-y-1.5">
          <div className="flex items-center gap-2 text-[#E6E2D6] font-semibold">
            <Compass size={14} className="text-[#7FB7D4]" />
            <span>SECTOR 17 // THE LAST EXPEDITION</span>
          </div>
          <p className="text-[11px] text-[#A9B0B5] leading-relaxed">
            A high-fidelity interplanetary exploration and scientific mission architecture simulator.
            Governed by deterministic astrodynamics, link budgets, and authoritative campaign progression.
          </p>
        </div>

        {/* Roles & Credits */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2.5 bg-[#151B22] border border-[#2B3642] rounded">
            <div className="text-[#6B757D] text-[10px] uppercase tracking-wider">Mission Architecture</div>
            <div className="text-[#E6E2D6] font-medium pt-0.5">Deep Space Systems Group</div>
          </div>
          <div className="p-2.5 bg-[#151B22] border border-[#2B3642] rounded">
            <div className="text-[#6B757D] text-[10px] uppercase tracking-wider">Astrodynamics & Simulation</div>
            <div className="text-[#E6E2D6] font-medium pt-0.5">Orbital Mechanics Engine</div>
          </div>
          <div className="p-2.5 bg-[#151B22] border border-[#2B3642] rounded">
            <div className="text-[#6B757D] text-[10px] uppercase tracking-wider">Visual & UI Production</div>
            <div className="text-[#E6E2D6] font-medium pt-0.5">The Expedition Record</div>
          </div>
          <div className="p-2.5 bg-[#151B22] border border-[#2B3642] rounded">
            <div className="text-[#6B757D] text-[10px] uppercase tracking-wider">Sound Design & Synthesis</div>
            <div className="text-[#E6E2D6] font-medium pt-0.5">Web Audio Synthesizer</div>
          </div>
        </div>

        {/* Scientific References */}
        <div className="p-3 bg-[#151B22] border border-[#2B3642] rounded space-y-1">
          <div className="text-[#7FB7D4] text-[11px] font-semibold">SCIENTIFIC REFERENCES & INSPIRATION</div>
          <p className="text-[#A9B0B5] text-[10px] leading-relaxed">
            Astrodynamic constants, Jovian gravity fields, and surface thermal models derived from published
            planetary survey data from the NASA Europa Clipper, Galileo Orbiter, and Cassini-Huygens missions.
          </p>
        </div>

        {/* Legal Disclaimer matching Reference HUD */}
        <div className="p-3 bg-[#0D1116] border border-[#D8503F]/30 rounded space-y-1">
          <div className="flex items-center gap-1.5 text-[#D8503F] text-[11px] font-semibold">
            <ShieldAlert size={13} />
            <span>LEGAL & TRADEMARK NOTICE</span>
          </div>
          <p className="text-[#A9B0B5] text-[10px] leading-relaxed">
            SECTOR 17 is an independent project. NASA does not endorse SECTOR 17. All trademarks and project names
            belong to their respective holders.
          </p>
        </div>
      </div>
    </ModalDialog>
  );
};
